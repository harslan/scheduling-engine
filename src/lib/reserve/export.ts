import { prisma } from "@/lib/prisma";
import {
  ReserveGatewayClient,
  formatDateForReserve,
  formatTimeForReserve,
  extractEventUniqueId,
} from "./client";
import { resolveContact } from "./contact-resolver";
import type { ReservePutRequestData, ReserveSyncResult } from "./types";

const EXPORT_HORIZON_DAYS = 60;

/**
 * Validate that all preconditions for Reserve export are met.
 * Returns an array of error messages (empty = all good).
 */
export async function validateExportPreconditions(
  organizationId: string
): Promise<string[]> {
  const errors: string[] = [];

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return ["Organization not found"];

  if (!org.reserveEnabled) errors.push("Reserve integration is not enabled");
  if (!org.reserveExportEnabled) errors.push("Reserve export is not enabled");
  if (!org.reserveGatewayUsername) errors.push("Gateway username is required");
  if (!org.reserveGatewayPassword) errors.push("Gateway password is required");
  if (!org.reserveSiteName) errors.push("Site name is required");
  if (!org.reserveOwnerUsername) errors.push("Owner username is required");
  if (!org.reserveSalespersonUsername) errors.push("Salesperson username is required");
  if (!org.reserveLifecycleStage) errors.push("Lifecycle stage is required");
  if (!org.reserveEventIdFieldName) errors.push("Event ID field name is required");

  // Check that all active rooms have a Reserve location name
  const roomsWithoutLocation = await prisma.room.count({
    where: {
      organizationId,
      active: true,
      reserveLocationName: "",
    },
  });
  if (roomsWithoutLocation > 0) {
    errors.push(`${roomsWithoutLocation} active room(s) missing Reserve location name`);
  }

  // Check that all config types have a Reserve setup style
  const configTypesWithoutStyle = await prisma.roomConfigurationType.count({
    where: {
      organizationId,
      reserveSetupStyle: "",
    },
  });
  if (configTypesWithoutStyle > 0) {
    errors.push(
      `${configTypesWithoutStyle} configuration type(s) missing Reserve setup style`
    );
  }

  // Check that all event types have a Reserve function type
  const eventTypesWithoutFunction = await prisma.eventType.count({
    where: {
      organizationId,
      reserveFunctionType: "",
    },
  });
  if (eventTypesWithoutFunction > 0) {
    errors.push(
      `${eventTypesWithoutFunction} event type(s) missing Reserve function type`
    );
  }

  return errors;
}

/**
 * Export approved events from the scheduling engine to Reserve.
 * Processes events in the next EXPORT_HORIZON_DAYS that aren't yet in ReserveEvent.
 */
export async function exportEventsToReserve(
  organizationId: string
): Promise<ReserveSyncResult> {
  const errors: string[] = [];
  let eventsProcessed = 0;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return { success: false, eventsProcessed: 0, errors: ["Organization not found"] };

  // Validate preconditions
  const preconditionErrors = await validateExportPreconditions(organizationId);
  if (preconditionErrors.length > 0) {
    return { success: false, eventsProcessed: 0, errors: preconditionErrors };
  }

  const client = new ReserveGatewayClient({
    username: org.reserveGatewayUsername,
    password: org.reserveGatewayPassword,
    siteName: org.reserveSiteName,
  });

  const now = new Date();
  const horizon = new Date(now.getTime() + EXPORT_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  // Find approved events in the horizon that aren't already exported
  const existingReserveEventIds = await prisma.reserveEvent.findMany({
    where: { organizationId, eventId: { not: null } },
    select: { eventId: true },
  });
  const exportedEventIds = new Set(
    existingReserveEventIds.map((e) => e.eventId).filter(Boolean)
  );

  const events = await prisma.event.findMany({
    where: {
      organizationId,
      deleted: false,
      status: "APPROVED",
      isExternal: false,
      startDateTime: { gte: now, lte: horizon },
    },
    include: {
      room: true,
      roomConfigurationType: true,
      eventType: true,
      instances: {
        where: { deleted: false },
        orderBy: { startDateTime: "asc" },
      },
    },
  });

  // Load mapping data
  const rooms = await prisma.room.findMany({
    where: { organizationId, active: true },
  });
  const configTypes = await prisma.roomConfigurationType.findMany({
    where: { organizationId },
  });

  const roomLocationMap = new Map(rooms.map((r) => [r.id, r.reserveLocationName]));
  const configTypeStyleMap = new Map(
    configTypes.map((ct) => [ct.id, ct.reserveSetupStyle])
  );

  for (const event of events) {
    if (exportedEventIds.has(event.id)) continue;

    try {
      // Resolve contact
      const contact = await resolveContact(
        organizationId,
        event.contactName,
        event.contactEmail,
        event.eventOrganization,
        client,
        {
          contactPhone: event.contactPhone || undefined,
          ownerUsername: org.reserveOwnerUsername || undefined,
        }
      );

      const contactUniqueId = contact?.contactUniqueId ?? org.reserveHoldContactId;
      if (!contactUniqueId) {
        errors.push(`Event "${event.title}": Could not resolve contact`);
        continue;
      }

      // Validate room mapping — Reserve requires a location for each function
      if (!event.roomId || !roomLocationMap.get(event.roomId)) {
        errors.push(`Event "${event.title}": No Reserve location mapped for room`);
        continue;
      }

      // Build event header — exact dotted field paths per .NET reference
      const eventHeader = [
        "function.event.site",
        org.reserveEventIdFieldName,
        "function.event.name",
        "function.event.estimatedAttendance",
        org.reserveEventNotesFieldName,
        "function.event.contact.uniqueId",
        org.reserveEventOrgFieldName,
        "function.event.owner.username",
        "function.event.salesperson.username",
        "function.event.lifecycleState.stateType",
      ];

      const functionHeader = [
        "function.startDate",
        "function.startTime",
        "function.endTime",
        "function.locations",
        "function.setupStyle",
        "function.functionType",
        "function.estimatedAttendance",
        "function.setupMinutes",
        "function.teardownMinutes",
      ];

      const instances =
        event.instances.length > 0
          ? event.instances
          : event.startDateTime && event.endDateTime
            ? [{ startDateTime: event.startDateTime, endDateTime: event.endDateTime }]
            : [];

      // Max estimated attendance across all instances (matches .NET GetMaxEstimatedAttendanceForReserveExport)
      const maxAttendeeCount = instances.reduce((max, inst) => {
        const count = "expectedAttendeeCount" in inst ? (inst as { expectedAttendeeCount?: number | null }).expectedAttendeeCount ?? 0 : 0;
        return Math.max(max, count);
      }, event.expectedAttendeeCount ?? 0);

      // Build event data row
      const eventRow = [
        org.reserveSiteName,
        event.id,
        event.title || "Event",
        String(maxAttendeeCount),
        event.notes || "",
        contactUniqueId,
        event.eventOrganization || "",
        org.reserveOwnerUsername,
        org.reserveSalespersonUsername,
        org.reserveLifecycleStage,
      ];

      // Build function rows - one per instance/room combination
      const functionRows: string[][] = [];
      for (const instance of instances) {
        const locationName =
          event.roomId ? (roomLocationMap.get(event.roomId) ?? "") : "";
        const setupStyle =
          event.roomConfigurationTypeId
            ? (configTypeStyleMap.get(event.roomConfigurationTypeId) ?? "")
            : "";
        const functionType = event.eventType?.reserveFunctionType ?? "";

        functionRows.push([
          formatDateForReserve(new Date(instance.startDateTime)),
          formatTimeForReserve(new Date(instance.startDateTime)),
          formatTimeForReserve(new Date(instance.endDateTime)),
          locationName,
          setupStyle,
          functionType,
          String(event.expectedAttendeeCount ?? 0),
          "0",
          "0",
        ]);
      }

      // POST event + first function row (combined header)
      const firstPayload: ReservePutRequestData = {
        header: [...eventHeader, ...functionHeader],
        data: [[...eventRow, ...(functionRows[0] ?? [])]],
      };

      const result = await client.importEventFunction(firstPayload);
      const reserveUniqueId = extractEventUniqueId(result);

      // POST remaining function rows with event.uniqueId prepended
      if (functionRows.length > 1 && reserveUniqueId) {
        const additionalFunctionHeader = ["function.event.uniqueId", ...functionHeader];
        const remainingPayload: ReservePutRequestData = {
          header: additionalFunctionHeader,
          data: functionRows.slice(1).map((row) => [reserveUniqueId, ...row]),
        };
        await client.importEventFunction(remainingPayload);
      }

      // Store the Reserve event reference
      if (reserveUniqueId) {
        await prisma.reserveEvent.create({
          data: {
            organizationId,
            reserveUniqueId,
            eventId: event.id,
            generalData: { exportedAt: now.toISOString() },
          },
        });
      }

      // Log activity
      await prisma.eventActivity.create({
        data: {
          eventId: event.id,
          action: "EVENT_EXPORTED_TO_RESERVE",
          details: { reserveUniqueId },
        },
      });

      eventsProcessed++;
    } catch (error) {
      errors.push(
        `Event "${event.title}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Update org timestamps
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      reserveLastExportAt: now,
      reserveLastSyncAt: now,
    },
  });

  // Log sync
  const status =
    errors.length === 0 ? "success" : eventsProcessed > 0 ? "partial" : "error";

  await prisma.reserveSyncLog.create({
    data: {
      organizationId,
      direction: "export",
      status,
      eventsProcessed,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
      summary: { eventsProcessed, errors },
    },
  });

  return { success: errors.length === 0, eventsProcessed, errors };
}
