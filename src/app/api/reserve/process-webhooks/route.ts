import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReserveGatewayClient } from "@/lib/reserve/client";
import {
  refreshReserveEvents,
  refreshReserveEventImportData,
} from "@/lib/reserve/data-refresh";
import { executeReserveImport } from "@/lib/reserve/import";

const PROCESSING_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cron-triggered webhook queue processor.
 * Processes queued webhook events older than 5 minutes,
 * refreshes Reserve data, and runs auto-import if enabled.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - PROCESSING_DELAY_MS);

  // Find unprocessed webhook events older than the delay
  const pendingEvents = await prisma.reserveWebhookEvent.findMany({
    where: {
      processedAt: null,
      receivedAt: { lte: cutoff },
    },
    orderBy: { receivedAt: "asc" },
  });

  if (pendingEvents.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Group by organization
  const byOrg = new Map<string, typeof pendingEvents>();
  for (const event of pendingEvents) {
    const existing = byOrg.get(event.organizationId) ?? [];
    existing.push(event);
    byOrg.set(event.organizationId, existing);
  }

  const results = [];

  for (const [orgId, events] of byOrg) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org || !org.reserveEnabled) {
      // Mark as processed even if org is disabled
      await prisma.reserveWebhookEvent.updateMany({
        where: { id: { in: events.map((e) => e.id) } },
        data: { processedAt: new Date() },
      });
      continue;
    }

    try {
      const client = new ReserveGatewayClient({
        username: org.reserveGatewayUsername,
        password: org.reserveGatewayPassword,
        siteName: org.reserveSiteName,
      });

      // Refresh Reserve data for the affected events
      const affectedUniqueIds = [
        ...new Set(events.map((e) => e.reserveUniqueId).filter(Boolean)),
      ];

      await refreshReserveEvents(orgId, client, org.reserveEventIdFieldName);

      for (const uid of affectedUniqueIds) {
        await refreshReserveEventImportData(orgId, client, {
          eventUniqueId: uid,
        });
      }

      // Run auto-import if enabled
      let importResult = null;
      if (org.reserveImportMode === "automatic") {
        importResult = await executeReserveImport(orgId, affectedUniqueIds);
      }

      // Mark as processed
      await prisma.reserveWebhookEvent.updateMany({
        where: { id: { in: events.map((e) => e.id) } },
        data: { processedAt: new Date() },
      });

      results.push({
        orgId,
        eventsProcessed: events.length,
        importResult,
      });
    } catch (error) {
      console.error(`Reserve: webhook processing failed for org ${orgId}`, error);
      results.push({
        orgId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ processed: pendingEvents.length, results });
}
