import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ReserveGatewayClient,
  parseReserveDate,
  combineDateAndTime,
} from "./client";
import {
  refreshReserveEvents,
  refreshReserveEventImportData,
} from "./data-refresh";
import type { ReserveImportPreviewItem, ReserveSyncResult } from "./types";

/**
 * Preview what importing from Reserve would do.
 * Returns proposed new events, updates, and removals with conflict info.
 */
export async function previewReserveImport(
  organizationId: string
): Promise<ReserveImportPreviewItem[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return [];

  // Load mapping tables
  const rooms = await prisma.room.findMany({
    where: { organizationId, active: true },
  });
  const configTypes = await prisma.roomConfigurationType.findMany({
    where: { organizationId },
  });
  const eventTypes = await prisma.eventType.findMany({
    where: { organizationId },
  });

  const roomByLocation = new Map(
    rooms
      .filter((r) => r.reserveLocationName)
      .map((r) => [r.reserveLocationName.toLowerCase(), r])
  );
  const configTypeByStyle = new Map(
    configTypes
      .filter((ct) => ct.reserveSetupStyle)
      .map((ct) => [ct.reserveSetupStyle.toLowerCase(), ct])
  );
  const eventTypeByFunction = new Map(
    eventTypes
      .filter((et) => et.reserveFunctionType)
      .map((et) => [et.reserveFunctionType.toLowerCase(), et])
  );

  // Get all Reserve events with import data
  const reserveEvents = await prisma.reserveEvent.findMany({
    where: {
      organizationId,
      importData: { not: Prisma.JsonNull },
    },
  });

  const preview: ReserveImportPreviewItem[] = [];

  for (const re of reserveEvents) {
    const functions = re.importData as unknown[];
    if (!Array.isArray(functions) || functions.length === 0) continue;

    const generalData = re.generalData as Record<string, unknown> | null;
    const title =
      (generalData?.eventName as string) ??
      (generalData?.eventNumber as string) ??
      "Untitled Reserve Event";

    const now = new Date();
    const parsedFunctions = functions
      .map((fn) => {
        const f = fn as Record<string, unknown>;
        return {
          locationName: String(f.locationName ?? ""),
          setupStyle: String(f.setupStyle ?? ""),
          functionType: String(f.functionType ?? ""),
          startDate: String(f.startDate ?? ""),
          startTime: String(f.startTime ?? ""),
          endTime: String(f.endTime ?? ""),
          attendeeCount: Number(f.estimatedAttendance ?? 0),
        };
      })
      .filter((fn) => {
        // Filter future functions only
        const startDate = parseReserveDate(fn.startDate);
        return startDate ? startDate >= now : true;
      });

    if (parsedFunctions.length === 0) continue;

    // Map the first function for summary (primary room/type mapping)
    const primaryFn = parsedFunctions[0];
    const mappedRoom = primaryFn
      ? roomByLocation.get(resolveLocationName(primaryFn.locationName).toLowerCase())
      : undefined;
    const mappedConfigType = primaryFn
      ? configTypeByStyle.get(primaryFn.setupStyle.toLowerCase())
      : undefined;
    const mappedEventType = primaryFn
      ? eventTypeByFunction.get(primaryFn.functionType.toLowerCase())
      : undefined;

    // Check if this is a new event or an update
    const action = re.eventId ? "update" : "create";

    // Check for conflicts if we have enough data to map
    const conflicts: string[] = [];
    if (primaryFn && mappedRoom) {
      const startDate = parseReserveDate(primaryFn.startDate);
      if (startDate) {
        const start = combineDateAndTime(startDate, primaryFn.startTime);
        const end = combineDateAndTime(startDate, primaryFn.endTime);
        if (start && end) {
          const conflictingEvents = await prisma.event.findMany({
            where: {
              organizationId,
              roomId: mappedRoom.id,
              deleted: false,
              status: "APPROVED",
              id: { not: re.eventId ?? undefined },
              startDateTime: { lt: end },
              endDateTime: { gt: start },
            },
            select: { id: true, title: true },
            take: 5,
          });
          for (const ce of conflictingEvents) {
            conflicts.push(`Conflicts with "${ce.title || "Untitled"}"`);
          }
        }
      }
    }

    if (!mappedRoom && primaryFn?.locationName) {
      conflicts.push(
        `No room mapped for location "${primaryFn.locationName}"`
      );
    }

    preview.push({
      reserveUniqueId: re.reserveUniqueId,
      reserveEventNumber: generalData?.eventNumber as string | undefined,
      action,
      title,
      functions: parsedFunctions,
      mappedRoom: mappedRoom?.name,
      mappedConfigType: mappedConfigType?.name,
      mappedEventType: mappedEventType?.name,
      conflicts,
      existingEventId: re.eventId ?? undefined,
    });
  }

  return preview;
}

/**
 * Execute Reserve import for selected events.
 * Creates or updates local events based on Reserve data.
 */
export async function executeReserveImport(
  organizationId: string,
  selectedUniqueIds?: string[]
): Promise<ReserveSyncResult> {
  const errors: string[] = [];
  let eventsProcessed = 0;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return { success: false, eventsProcessed: 0, errors: ["Organization not found"] };

  // Load mapping tables
  const rooms = await prisma.room.findMany({
    where: { organizationId, active: true },
  });
  const configTypes = await prisma.roomConfigurationType.findMany({
    where: { organizationId },
  });
  const eventTypes = await prisma.eventType.findMany({
    where: { organizationId },
  });

  const roomByLocation = new Map(
    rooms
      .filter((r) => r.reserveLocationName)
      .map((r) => [r.reserveLocationName.toLowerCase(), r])
  );
  const configTypeByStyle = new Map(
    configTypes
      .filter((ct) => ct.reserveSetupStyle)
      .map((ct) => [ct.reserveSetupStyle.toLowerCase(), ct])
  );
  const eventTypeByFunction = new Map(
    eventTypes
      .filter((et) => et.reserveFunctionType)
      .map((et) => [et.reserveFunctionType.toLowerCase(), et])
  );

  // Get Reserve events to import
  const reserveEvents = await prisma.reserveEvent.findMany({
    where: {
      organizationId,
      importData: { not: Prisma.JsonNull },
      ...(selectedUniqueIds
        ? { reserveUniqueId: { in: selectedUniqueIds } }
        : {}),
    },
  });

  for (const re of reserveEvents) {
    const functions = re.importData as unknown[];
    if (!Array.isArray(functions) || functions.length === 0) continue;

    const generalData = re.generalData as Record<string, unknown> | null;
    const title =
      (generalData?.eventName as string) ??
      (generalData?.eventNumber as string) ??
      "";

    try {
      // Parse the first function for the primary event time
      const primaryFn = functions[0] as Record<string, unknown>;
      const rawLocationName = String(primaryFn?.locationName ?? "");
      const locationName = resolveLocationName(rawLocationName);
      const setupStyle = String(primaryFn?.setupStyle ?? "");
      const functionType = String(primaryFn?.functionType ?? "");
      const startDateStr = String(primaryFn?.startDate ?? "");
      const startTimeStr = String(primaryFn?.startTime ?? "");
      const endTimeStr = String(primaryFn?.endTime ?? "");

      const startDate = parseReserveDate(startDateStr);
      if (!startDate) {
        errors.push(`Reserve event ${re.reserveUniqueId}: Invalid start date "${startDateStr}"`);
        continue;
      }

      // Skip past functions
      if (startDate < new Date()) continue;

      const startDateTime = combineDateAndTime(startDate, startTimeStr);
      const endDateTime = combineDateAndTime(startDate, endTimeStr);

      if (!startDateTime || !endDateTime) {
        errors.push(
          `Reserve event ${re.reserveUniqueId}: Invalid time "${startTimeStr}" or "${endTimeStr}"`
        );
        continue;
      }

      // Map to local entities
      const room = roomByLocation.get(locationName.toLowerCase());
      const configType = configTypeByStyle.get(setupStyle.toLowerCase());
      const eventType = eventTypeByFunction.get(functionType.toLowerCase());

      // Find a room configuration matching room + config type
      let roomConfigurationId: string | undefined;
      if (room && configType) {
        const config = await prisma.roomConfiguration.findFirst({
          where: {
            roomId: room.id,
            configurationTypeId: configType.id,
          },
        });
        roomConfigurationId = config?.id;
      }

      // Wrap each event create/update in a transaction
      await prisma.$transaction(async (tx) => {
        if (re.eventId) {
          // Update existing event
          await tx.event.update({
            where: { id: re.eventId! },
            data: {
              title: title || undefined,
              roomId: room?.id,
              roomConfigurationId: roomConfigurationId ?? null,
              roomConfigurationTypeId: configType?.id ?? null,
              eventTypeId: eventType?.id ?? null,
              startDateTime,
              endDateTime,
              expectedAttendeeCount: Number(primaryFn?.estimatedAttendance ?? 0) || null,
            },
          });

          // Update instances for additional functions
          if (functions.length > 1) {
            await syncInstances(tx, re.eventId!, functions.slice(1), roomByLocation, configTypeByStyle, eventTypeByFunction);
          }

          await tx.eventActivity.create({
            data: {
              eventId: re.eventId!,
              action: "EVENT_UPDATED_FROM_RESERVE",
              details: { reserveUniqueId: re.reserveUniqueId },
            },
          });
        } else {
          // Create new event
          const event = await tx.event.create({
            data: {
              organizationId,
              title: title || "Reserve Event",
              roomId: room?.id ?? null,
              roomConfigurationId: roomConfigurationId ?? null,
              roomConfigurationTypeId: configType?.id ?? null,
              eventTypeId: eventType?.id ?? null,
              startDateTime,
              endDateTime,
              expectedAttendeeCount: Number(primaryFn?.estimatedAttendance ?? 0) || null,
              isExternal: true,
              status: "APPROVED",
              approved: true,
            },
          });

          // Create instances for additional functions
          if (functions.length > 1) {
            await syncInstances(tx, event.id, functions.slice(1), roomByLocation, configTypeByStyle, eventTypeByFunction);
          }

          // Link Reserve event to local event
          await tx.reserveEvent.update({
            where: { id: re.id },
            data: { eventId: event.id },
          });

          await tx.eventActivity.create({
            data: {
              eventId: event.id,
              action: "EVENT_IMPORTED_FROM_RESERVE",
              details: { reserveUniqueId: re.reserveUniqueId },
            },
          });
        }
      });

      eventsProcessed++;
    } catch (error) {
      errors.push(
        `Reserve event ${re.reserveUniqueId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  const now = new Date();
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      reserveLastImportAt: now,
      reserveLastSyncAt: now,
    },
  });

  const status =
    errors.length === 0 ? "success" : eventsProcessed > 0 ? "partial" : "error";

  await prisma.reserveSyncLog.create({
    data: {
      organizationId,
      direction: "import",
      status,
      eventsProcessed,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
      summary: { eventsProcessed, errors },
    },
  });

  return { success: errors.length === 0, eventsProcessed, errors };
}

/**
 * Refresh data from Reserve and run auto-import for enabled orgs.
 */
export async function runAutoImport(organizationId: string): Promise<ReserveSyncResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org || !org.reserveEnabled || org.reserveImportMode !== "automatic") {
    return { success: false, eventsProcessed: 0, errors: ["Auto-import not enabled"] };
  }

  const client = new ReserveGatewayClient({
    username: org.reserveGatewayUsername,
    password: org.reserveGatewayPassword,
    siteName: org.reserveSiteName,
  });

  // Refresh data from Reserve
  await refreshReserveEvents(organizationId, client, org.reserveEventIdFieldName);
  await refreshReserveEventImportData(organizationId, client);

  // Execute import (all events)
  return executeReserveImport(organizationId);
}

// --------------- Internal helpers ---------------

/** Handle Reserve location delimiter " / " — use first segment for matching */
function resolveLocationName(raw: string): string {
  if (raw.includes(" / ")) {
    return raw.split(" / ")[0].trim();
  }
  return raw.trim();
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type RoomMap = Map<string, { id: string; name: string }>;
type ConfigTypeMap = Map<string, { id: string; name: string }>;
type EventTypeMap = Map<string, { id: string; name: string }>;

/**
 * Smarter instance sync: upsert matching instances, create new ones, prune extras.
 * Preserves instance IDs for downstream references when datetime ranges match.
 */
async function syncInstances(
  tx: TransactionClient,
  eventId: string,
  functions: unknown[],
  roomByLocation: RoomMap,
  configTypeByStyle: ConfigTypeMap,
  eventTypeByFunction: EventTypeMap
) {
  const existing = await tx.eventInstance.findMany({
    where: { eventId, deleted: false },
    orderBy: { startDateTime: "asc" },
  });

  const matchedIds = new Set<string>();

  for (const fn of functions) {
    const f = fn as Record<string, unknown>;
    const startDateStr = String(f.startDate ?? "");
    const startTimeStr = String(f.startTime ?? "");
    const endTimeStr = String(f.endTime ?? "");
    const rawLocationName = String(f.locationName ?? "");
    const locationName = resolveLocationName(rawLocationName);
    const setupStyle = String(f.setupStyle ?? "");
    const functionType = String(f.functionType ?? "");

    const startDate = parseReserveDate(startDateStr);
    if (!startDate) continue;

    const startDateTime = combineDateAndTime(startDate, startTimeStr);
    const endDateTime = combineDateAndTime(startDate, endTimeStr);
    if (!startDateTime || !endDateTime) continue;

    const configType = configTypeByStyle.get(setupStyle.toLowerCase());
    const eventType = eventTypeByFunction.get(functionType.toLowerCase());

    let roomConfigurationId: string | undefined;
    const room = roomByLocation.get(locationName.toLowerCase());
    if (room && configType) {
      const config = await tx.roomConfiguration.findFirst({
        where: { roomId: room.id, configurationTypeId: configType.id },
      });
      roomConfigurationId = config?.id;
    }

    const instanceData = {
      roomConfigurationId: roomConfigurationId ?? null,
      roomConfigurationTypeId: configType?.id ?? null,
      eventTypeId: eventType?.id ?? null,
      expectedAttendeeCount: Number(f.estimatedAttendance ?? 0) || null,
    };

    // Try to match an existing instance by datetime range
    const match = existing.find(
      (inst) =>
        !matchedIds.has(inst.id) &&
        inst.startDateTime.getTime() === startDateTime.getTime() &&
        inst.endDateTime.getTime() === endDateTime.getTime()
    );

    if (match) {
      matchedIds.add(match.id);
      await tx.eventInstance.update({
        where: { id: match.id },
        data: instanceData,
      });
    } else {
      await tx.eventInstance.create({
        data: {
          eventId,
          startDateTime,
          endDateTime,
          ...instanceData,
        },
      });
    }
  }

  // Soft-delete unmatched existing instances (consistent with event soft-delete pattern)
  const toDelete = existing.filter((inst) => !matchedIds.has(inst.id));
  if (toDelete.length > 0) {
    await tx.eventInstance.updateMany({
      where: { id: { in: toDelete.map((i) => i.id) } },
      data: { deleted: true },
    });
  }
}
