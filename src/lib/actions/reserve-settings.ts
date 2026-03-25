"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { ReserveGatewayClient } from "@/lib/reserve/client";
import { refreshReserveAccounts, refreshReserveContacts } from "@/lib/reserve/data-refresh";
import { exportEventsToReserve, validateExportPreconditions } from "@/lib/reserve/export";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ReserveSettingsSchema = z.object({
  reserveEnabled: z.coerce.boolean().optional(),
  reserveExportEnabled: z.coerce.boolean().optional(),
  reserveImportMode: z.string().optional().nullable(),
  reserveGatewayUsername: z.string().optional(),
  reserveGatewayPassword: z.string().optional(),
  reserveWebhookSecret: z.string().optional(),
  reserveSiteName: z.string().optional(),
  reserveEventIdFieldName: z.string().optional(),
  reserveEventNotesFieldName: z.string().optional(),
  reserveEventOrgFieldName: z.string().optional(),
  reserveOwnerUsername: z.string().optional(),
  reserveSalespersonUsername: z.string().optional(),
  reserveLifecycleStage: z.string().optional(),
  reserveHoldFunctionType: z.string().optional(),
  reserveHoldContactId: z.string().optional(),
});

export async function updateReserveSettings(orgId: string, formData: FormData) {
  await requireOrgRole(orgId, ["ADMIN"]);

  const raw = Object.fromEntries(formData.entries());

  // Handle unchecked checkboxes
  for (const field of ["reserveEnabled", "reserveExportEnabled"]) {
    if (!(field in raw)) raw[field] = "false";
  }

  // Handle empty import mode
  if (!raw.reserveImportMode || raw.reserveImportMode === "off") {
    raw.reserveImportMode = "";
  }

  const parsed = ReserveSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Organization not found" };

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      reserveEnabled: data.reserveEnabled ?? org.reserveEnabled,
      reserveExportEnabled: data.reserveExportEnabled ?? org.reserveExportEnabled,
      reserveImportMode: data.reserveImportMode || null,
      reserveGatewayUsername: data.reserveGatewayUsername ?? org.reserveGatewayUsername,
      reserveGatewayPassword: data.reserveGatewayPassword ?? org.reserveGatewayPassword,
      reserveWebhookSecret: data.reserveWebhookSecret ?? org.reserveWebhookSecret,
      reserveSiteName: data.reserveSiteName ?? org.reserveSiteName,
      reserveEventIdFieldName: data.reserveEventIdFieldName ?? org.reserveEventIdFieldName,
      reserveEventNotesFieldName: data.reserveEventNotesFieldName ?? org.reserveEventNotesFieldName,
      reserveEventOrgFieldName: data.reserveEventOrgFieldName ?? org.reserveEventOrgFieldName,
      reserveOwnerUsername: data.reserveOwnerUsername ?? org.reserveOwnerUsername,
      reserveSalespersonUsername: data.reserveSalespersonUsername ?? org.reserveSalespersonUsername,
      reserveLifecycleStage: data.reserveLifecycleStage ?? org.reserveLifecycleStage,
      reserveHoldFunctionType: data.reserveHoldFunctionType ?? org.reserveHoldFunctionType,
      reserveHoldContactId: data.reserveHoldContactId ?? org.reserveHoldContactId,
    },
  });

  revalidatePath(`/${org.slug}/admin/reserve`);

  return { success: true };
}

export async function updateRoomReserveMapping(
  orgId: string,
  roomId: string,
  reserveLocationName: string
) {
  await requireOrgRole(orgId, ["ADMIN"]);

  await prisma.room.update({
    where: { id: roomId },
    data: { reserveLocationName },
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (org) revalidatePath(`/${org.slug}/admin/reserve`);

  return { success: true };
}

export async function updateConfigTypeReserveMapping(
  orgId: string,
  configTypeId: string,
  reserveSetupStyle: string
) {
  await requireOrgRole(orgId, ["ADMIN"]);

  await prisma.roomConfigurationType.update({
    where: { id: configTypeId },
    data: { reserveSetupStyle },
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (org) revalidatePath(`/${org.slug}/admin/reserve`);

  return { success: true };
}

export async function updateEventTypeReserveMapping(
  orgId: string,
  eventTypeId: string,
  reserveFunctionType: string
) {
  await requireOrgRole(orgId, ["ADMIN"]);

  await prisma.eventType.update({
    where: { id: eventTypeId },
    data: { reserveFunctionType },
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (org) revalidatePath(`/${org.slug}/admin/reserve`);

  return { success: true };
}

export async function testReserveConnection(orgId: string) {
  await requireOrgRole(orgId, ["ADMIN"]);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Organization not found" };

  if (!org.reserveGatewayUsername || !org.reserveGatewayPassword) {
    return { error: "Gateway credentials are not configured" };
  }

  const client = new ReserveGatewayClient({
    username: org.reserveGatewayUsername,
    password: org.reserveGatewayPassword,
    siteName: org.reserveSiteName,
  });

  const result = await client.testConnection();

  if (result.success) {
    return { success: true, message: "Connection successful" };
  }
  return { error: `Connection failed: ${result.error}` };
}

export async function triggerReserveSync(orgId: string) {
  await requireOrgRole(orgId, ["ADMIN"]);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Organization not found" };
  if (!org.reserveEnabled) return { error: "Reserve integration is not enabled" };
  if (!org.reserveGatewayUsername || !org.reserveGatewayPassword) {
    return { error: "Gateway credentials are not configured" };
  }

  const client = new ReserveGatewayClient({
    username: org.reserveGatewayUsername,
    password: org.reserveGatewayPassword,
    siteName: org.reserveSiteName,
  });

  try {
    const [accounts, contacts] = await Promise.all([
      refreshReserveAccounts(orgId, client),
      refreshReserveContacts(orgId, client),
    ]);

    await prisma.organization.update({
      where: { id: orgId },
      data: { reserveLastSyncAt: new Date() },
    });

    revalidatePath(`/${org.slug}/admin/reserve`);

    return {
      success: true,
      message: `Synced ${accounts} accounts and ${contacts} contacts`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

export async function triggerReserveExport(orgId: string) {
  await requireOrgRole(orgId, ["ADMIN"]);

  const preconditionErrors = await validateExportPreconditions(orgId);
  if (preconditionErrors.length > 0) {
    return { error: preconditionErrors.join("; ") };
  }

  const result = await exportEventsToReserve(orgId);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (org) revalidatePath(`/${org.slug}/admin/reserve`);

  return {
    success: result.success,
    message: `Exported ${result.eventsProcessed} events`,
    errors: result.errors,
  };
}
