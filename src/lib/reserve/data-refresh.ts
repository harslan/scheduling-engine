import { prisma } from "@/lib/prisma";
import { ReserveGatewayClient } from "./client";
import type {
  ReserveAccountData,
  ReserveContactData,
  ReserveEventGeneralData,
  ReserveFunctionData,
} from "./types";

/**
 * Pull and update the local cache of Reserve accounts.
 */
export async function refreshReserveAccounts(
  organizationId: string,
  client: ReserveGatewayClient
): Promise<number> {
  const rawAccounts = await client.fetchAccountData();
  let count = 0;

  for (const raw of rawAccounts) {
    const account = raw as ReserveAccountData;
    if (!account.uniqueId) continue;

    await prisma.reserveAccount.upsert({
      where: {
        organizationId_reserveUniqueId: {
          organizationId,
          reserveUniqueId: account.uniqueId,
        },
      },
      create: {
        organizationId,
        reserveUniqueId: account.uniqueId,
        name: account.name ?? "",
        reserveData: raw as object,
      },
      update: {
        name: account.name ?? "",
        reserveData: raw as object,
      },
    });
    count++;
  }

  return count;
}

/**
 * Pull and update the local cache of Reserve contacts.
 */
export async function refreshReserveContacts(
  organizationId: string,
  client: ReserveGatewayClient
): Promise<number> {
  const rawContacts = await client.fetchContactData();
  let count = 0;

  for (const raw of rawContacts) {
    const contact = raw as ReserveContactData;
    if (!contact.uniqueId) continue;

    await prisma.reserveContact.upsert({
      where: {
        organizationId_reserveUniqueId: {
          organizationId,
          reserveUniqueId: contact.uniqueId,
        },
      },
      create: {
        organizationId,
        reserveUniqueId: contact.uniqueId,
        name: contact.fullName ?? "",
        accountName: contact.account?.name ?? "",
        reserveData: raw as object,
      },
      update: {
        name: contact.fullName ?? "",
        accountName: contact.account?.name ?? "",
        reserveData: raw as object,
      },
    });
    count++;
  }

  return count;
}

/**
 * Pull and update the local cache of Reserve events (general data).
 */
export async function refreshReserveEvents(
  organizationId: string,
  client: ReserveGatewayClient,
  eventIdFieldName: string
): Promise<number> {
  const rawEvents = await client.fetchEventData();
  let count = 0;

  for (const raw of rawEvents) {
    const event = raw as ReserveEventGeneralData;
    if (!event.uniqueId) continue;

    // Extract the local event ID from the configured field
    let eventIdFieldValue: string | undefined;
    if (eventIdFieldName) {
      eventIdFieldValue = getNestedValue(raw, eventIdFieldName);
    }

    await prisma.reserveEvent.upsert({
      where: {
        organizationId_reserveUniqueId: {
          organizationId,
          reserveUniqueId: event.uniqueId,
        },
      },
      create: {
        organizationId,
        reserveUniqueId: event.uniqueId,
        eventId: eventIdFieldValue || null,
        generalData: raw as object,
      },
      update: {
        eventId: eventIdFieldValue || undefined,
        generalData: raw as object,
      },
    });
    count++;
  }

  return count;
}

/**
 * Pull and update Reserve function (room booking) data for import.
 * Groups functions by event uniqueId and stores as importData.
 */
export async function refreshReserveEventImportData(
  organizationId: string,
  client: ReserveGatewayClient,
  options: { endDateAfter?: Date; eventUniqueId?: string } = {}
): Promise<number> {
  const rawFunctions = await client.fetchFunctionData({
    endDateAfter: options.endDateAfter ?? new Date(),
    eventUniqueId: options.eventUniqueId,
  });

  // Group functions by event uniqueId
  const functionsByEvent = new Map<string, unknown[]>();
  for (const raw of rawFunctions) {
    const fn = raw as ReserveFunctionData;
    if (!fn.eventUniqueId) continue;

    const existing = functionsByEvent.get(fn.eventUniqueId) ?? [];
    existing.push(raw);
    functionsByEvent.set(fn.eventUniqueId, existing);
  }

  let count = 0;
  for (const [eventUniqueId, functions] of functionsByEvent) {
    await prisma.reserveEvent.upsert({
      where: {
        organizationId_reserveUniqueId: {
          organizationId,
          reserveUniqueId: eventUniqueId,
        },
      },
      create: {
        organizationId,
        reserveUniqueId: eventUniqueId,
        importData: functions as object[],
        importDataUpdatedAt: new Date(),
      },
      update: {
        importData: functions as object[],
        importDataUpdatedAt: new Date(),
      },
    });
    count++;
  }

  return count;
}

/** Get a nested value from an object using dot notation (e.g. "function.event.fieldName") */
function getNestedValue(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current != null ? String(current) : undefined;
}
