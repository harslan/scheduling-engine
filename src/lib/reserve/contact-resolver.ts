import { prisma } from "@/lib/prisma";
import { ReserveGatewayClient, extractUniqueId } from "./client";
import type { ReservePutRequestData } from "./types";

interface ResolvedContact {
  contactUniqueId: string;
  accountUniqueId: string;
}

/**
 * Name-based contact resolution against locally-cached Reserve accounts/contacts.
 * Replaces Bill's Selenium + Google Search approach with simple name matching.
 */
export async function resolveContact(
  organizationId: string,
  contactName: string,
  contactEmail: string,
  eventOrganization: string,
  client: ReserveGatewayClient,
  options?: { contactPhone?: string; ownerUsername?: string }
): Promise<ResolvedContact | null> {
  if (!contactName.trim()) return null;

  const nameParts = parseContactName(contactName);

  // 1. Try to match existing contact by name
  const existingContact = await findContactByName(
    organizationId,
    nameParts.firstName,
    nameParts.lastName
  );

  if (existingContact) {
    return existingContact;
  }

  // 2. Find or create account for the event organization
  const accountName = eventOrganization || contactName;
  const accountUniqueId = await findOrCreateAccount(
    organizationId,
    accountName,
    client,
    options?.ownerUsername
  );

  if (!accountUniqueId) return null;

  // 3. Create new contact under the account
  const contactUniqueId = await createContact(
    organizationId,
    nameParts,
    contactEmail,
    accountName,
    client,
    options?.contactPhone,
    options?.ownerUsername
  );

  if (!contactUniqueId) return null;

  return { contactUniqueId, accountUniqueId };
}

function parseContactName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function findContactByName(
  organizationId: string,
  firstName: string,
  lastName: string
): Promise<ResolvedContact | null> {
  if (!firstName && !lastName) return null;

  // Match by full name (case-insensitive) against cached contacts
  const contacts = await prisma.reserveContact.findMany({
    where: { organizationId },
  });

  const normalizedFirst = firstName.toLowerCase().trim();
  const normalizedLast = lastName.toLowerCase().trim();

  for (const contact of contacts) {
    const data = contact.reserveData as Record<string, unknown> | null;
    if (!data) continue;

    const cFirst = String(data.firstName ?? "").toLowerCase().trim();
    const cLast = String(data.lastName ?? "").toLowerCase().trim();

    // Exact match on first + last
    if (cFirst === normalizedFirst && cLast === normalizedLast) {
      const account = data.account as { uniqueId?: string } | undefined;
      return {
        contactUniqueId: contact.reserveUniqueId,
        accountUniqueId: account?.uniqueId ?? "",
      };
    }
  }

  // Fallback: match by the stored name field
  const nameMatch = await prisma.reserveContact.findFirst({
    where: {
      organizationId,
      name: {
        equals: `${firstName} ${lastName}`.trim(),
        mode: "insensitive",
      },
    },
  });

  if (nameMatch) {
    const data = nameMatch.reserveData as Record<string, unknown> | null;
    const account = data?.account as { uniqueId?: string } | undefined;
    return {
      contactUniqueId: nameMatch.reserveUniqueId,
      accountUniqueId: account?.uniqueId ?? "",
    };
  }

  return null;
}

async function findOrCreateAccount(
  organizationId: string,
  accountName: string,
  client: ReserveGatewayClient,
  ownerUsername?: string
): Promise<string | null> {
  if (!accountName.trim()) return null;

  // Check local cache first
  const existing = await prisma.reserveAccount.findFirst({
    where: {
      organizationId,
      name: { equals: accountName.trim(), mode: "insensitive" },
    },
  });

  if (existing) return existing.reserveUniqueId;

  // Create via gateway — matches .NET: ["account.name", "account.owner.username"]
  const header = ["account.name", "account.owner.username"];
  const data = [[accountName.trim(), ownerUsername ?? ""]];
  const payload: ReservePutRequestData = { header, data };

  try {
    const result = await client.importAccount(payload);
    const uniqueId = extractUniqueId(result);
    if (!uniqueId) return null;

    // Cache locally
    await prisma.reserveAccount.create({
      data: {
        organizationId,
        reserveUniqueId: uniqueId,
        name: accountName.trim(),
        reserveData: { uniqueId, name: accountName.trim() },
      },
    });

    return uniqueId;
  } catch (error) {
    console.error("Reserve: failed to create account", error);
    return null;
  }
}

async function createContact(
  organizationId: string,
  nameParts: { firstName: string; lastName: string },
  email: string,
  accountName: string,
  client: ReserveGatewayClient,
  phone?: string,
  ownerUsername?: string
): Promise<string | null> {
  // Matches .NET: ["contact.account.name", "contact.firstName", "contact.lastName",
  //                "contact.email", "contact.workPhone", "contact.owner.username"]
  const payload: ReservePutRequestData = {
    header: [
      "contact.account.name",
      "contact.firstName",
      "contact.lastName",
      "contact.email",
      "contact.workPhone",
      "contact.owner.username",
    ],
    data: [[accountName, nameParts.firstName, nameParts.lastName, email, phone ?? "", ownerUsername ?? ""]],
  };

  try {
    const result = await client.importContact(payload, true);
    const uniqueId = extractUniqueId(result);
    if (!uniqueId) return null;

    // Cache locally
    await prisma.reserveContact.create({
      data: {
        organizationId,
        reserveUniqueId: uniqueId,
        name: `${nameParts.firstName} ${nameParts.lastName}`.trim(),
        accountName,
        reserveData: {
          uniqueId,
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          fullName: `${nameParts.firstName} ${nameParts.lastName}`.trim(),
          email,
          account: { name: accountName },
        },
      },
    });

    return uniqueId;
  } catch (error) {
    console.error("Reserve: failed to create contact", error);
    return null;
  }
}

