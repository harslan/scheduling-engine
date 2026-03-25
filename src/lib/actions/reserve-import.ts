"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { ReserveGatewayClient } from "@/lib/reserve/client";
import {
  refreshReserveEvents,
  refreshReserveEventImportData,
} from "@/lib/reserve/data-refresh";
import {
  previewReserveImport,
  executeReserveImport,
} from "@/lib/reserve/import";
import { revalidatePath } from "next/cache";

export async function refreshAndPreviewImport(orgId: string) {
  await requireOrgRole(orgId, ["ADMIN"]);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });
  if (!org) return { error: "Organization not found" };

  if (!org.reserveEnabled) {
    return { error: "Reserve integration is not enabled" };
  }

  if (!org.reserveGatewayUsername || !org.reserveGatewayPassword) {
    return { error: "Reserve gateway credentials are not configured" };
  }

  const client = new ReserveGatewayClient({
    username: org.reserveGatewayUsername,
    password: org.reserveGatewayPassword,
    siteName: org.reserveSiteName,
  });

  try {
    // Refresh data from Reserve
    await refreshReserveEvents(orgId, client, org.reserveEventIdFieldName);
    await refreshReserveEventImportData(orgId, client);

    // Generate preview
    const preview = await previewReserveImport(orgId);

    return { success: true, preview };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to refresh Reserve data",
    };
  }
}

export async function applyReserveImport(
  orgId: string,
  selectedUniqueIds: string[]
) {
  await requireOrgRole(orgId, ["ADMIN"]);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true, reserveEnabled: true },
  });
  if (!org) return { error: "Organization not found" };
  if (!org.reserveEnabled) return { error: "Reserve integration is not enabled" };

  try {
    const result = await executeReserveImport(orgId, selectedUniqueIds);

    revalidatePath(`/${org.slug}`);
    revalidatePath(`/${org.slug}/admin`);

    return {
      success: result.success,
      eventsProcessed: result.eventsProcessed,
      errors: result.errors,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Import failed",
    };
  }
}
