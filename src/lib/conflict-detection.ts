import { prisma } from "@/lib/prisma";

// ============================================================
// TYPES
// ============================================================

export type ConflictReason =
  | "direct_overlap"
  | "buffer_conflict"
  | "parent_child_conflict"
  | "concurrent_limit_exceeded";

export interface ConflictInfo {
  roomName: string;
  startDateTime: Date;
  endDateTime: Date;
  reason: ConflictReason;
  message: string;
  canOverride?: boolean; // true for buffer conflicts when user is admin/manager
}

export interface AlternativeRoom {
  roomId: string;
  roomName: string;
  configurationId?: string;
  configurationName?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictInfo[];
  alternatives: AlternativeRoom[];
}

interface ProposedInstance {
  startDateTime: Date;
  endDateTime: Date;
}

interface ExistingInstance {
  eventId: string;
  roomId: string;
  roomName: string;
  parentRoomId: string | null;
  parentConversionMinutes: number;
  startDateTime: Date;
  endDateTime: Date;
  roomConfigurationId: string | null;
  concurrentEventLimit: number;
}

// ============================================================
// BUFFER / RECONFIGURATION TIME
// ============================================================

/**
 * Bidirectional ReconfigurationTime lookup, mirrors EWL's GetBufferMinutes.
 * Falls back to the room's general bufferMinutes if no config-specific time exists.
 *
 * EWL rule: same configuration = no reconfiguration = 0 buffer.
 * Different configs: use config-pair reconfiguration time, or room buffer as fallback.
 * Null config: use room buffer (no config-specific info available).
 */
export async function getBufferMinutes(
  configId1: string | null,
  configId2: string | null,
  roomBufferMinutes: number = 0
): Promise<number> {
  if (!configId1 || !configId2) return roomBufferMinutes;
  // Same config → no reconfiguration needed (EWL returns 0 for same-config pairs)
  if (configId1 === configId2) return 0;

  const row = await prisma.reconfigurationTime.findFirst({
    where: {
      OR: [
        { roomConfigurationId1: configId1, roomConfigurationId2: configId2 },
        { roomConfigurationId1: configId2, roomConfigurationId2: configId1 },
      ],
    },
  });

  return row ? row.reconfigurationMinutes : roomBufferMinutes;
}

// ============================================================
// GET EXISTING INSTANCES
// ============================================================

/**
 * Query events and their instances that overlap the given time range for a room
 * (including parent/child rooms). Mirrors EWL's CreateListFromEventsNearRange.
 */
export async function getExistingInstances(
  orgId: string,
  roomId: string,
  startDateTime: Date,
  endDateTime: Date,
  excludeEventIds?: string[]
): Promise<ExistingInstance[]> {
  // Get parent/child room IDs
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { parentRoom: true, childRooms: true },
  });
  if (!room) return [];

  const relatedRoomIds = [roomId];
  if (room.parentRoomId) relatedRoomIds.push(room.parentRoomId);
  for (const child of room.childRooms) relatedRoomIds.push(child.id);

  // Find events that overlap our time range — filter at DB level
  const events = await prisma.event.findMany({
    where: {
      organizationId: orgId,
      roomId: { in: relatedRoomIds },
      deleted: false,
      status: { in: ["APPROVED", "PENDING"] },
      ...(excludeEventIds?.length ? { id: { notIn: excludeEventIds } } : {}),
      OR: [
        // Non-recurring events that overlap the time range
        {
          recurrenceRule: null,
          startDateTime: { lt: endDateTime },
          endDateTime: { gt: startDateTime },
        },
        // Recurring events with at least one instance in range
        {
          recurrenceRule: { not: null },
          instances: {
            some: {
              deleted: false,
              startDateTime: { lt: endDateTime },
              endDateTime: { gt: startDateTime },
            },
          },
        },
      ],
    },
    include: {
      room: true,
      instances: {
        where: {
          deleted: false,
          startDateTime: { lt: endDateTime },
          endDateTime: { gt: startDateTime },
        },
      },
    },
  });

  const instances: ExistingInstance[] = [];

  for (const event of events) {
    if (!event.room) continue;

    if (event.instances.length > 0) {
      for (const inst of event.instances) {
        instances.push({
          eventId: event.id,
          roomId: event.roomId!,
          roomName: event.room.name,
          parentRoomId: event.room.parentRoomId,
          parentConversionMinutes: event.room.parentConversionMinutes,
          startDateTime: inst.startDateTime,
          endDateTime: inst.endDateTime,
          roomConfigurationId: inst.roomConfigurationId || event.roomConfigurationId,
          concurrentEventLimit: event.room.concurrentEventLimit,
        });
      }
    } else if (event.startDateTime && event.endDateTime) {
      instances.push({
        eventId: event.id,
        roomId: event.roomId!,
        roomName: event.room.name,
        parentRoomId: event.room.parentRoomId,
        parentConversionMinutes: event.room.parentConversionMinutes,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        roomConfigurationId: event.roomConfigurationId,
        concurrentEventLimit: event.room.concurrentEventLimit,
      });
    }
  }

  return instances;
}

// ============================================================
// CORE CONFLICT CHECK
// ============================================================

function timeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Check a single proposed instance against existing instances.
 * Mirrors EWL's getConflictsForRoomConfiguration (lines 101-193).
 */
export async function checkConflictsForInstance(
  proposed: ProposedInstance,
  roomId: string,
  roomConfigurationId: string | null,
  existingInstances: ExistingInstance[],
  room: {
    id: string;
    name: string;
    bufferMinutes: number;
    concurrentEventLimit: number;
    parentRoomId: string | null;
    parentConversionMinutes: number;
  },
  isRecurring: boolean = false,
  overrideBuffer: boolean = false,
  timezone?: string
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];
  const fmtTime = (d: Date) => formatTime(d, timezone);

  for (const existing of existingInstances) {
    let bufferMinutes = room.bufferMinutes;
    let conflictContext = "";

    if (existing.roomId === roomId) {
      // Multi-concurrent room handling (EWL ConflictDetectionOps lines 107-108):
      // - Same config → defer to concurrent limit check
      // - Different config → check direct overlap (different arrangements can't coexist)
      if (room.concurrentEventLimit > 1) {
        const bothHaveConfig =
          roomConfigurationId && existing.roomConfigurationId;
        const differentConfig =
          bothHaveConfig &&
          existing.roomConfigurationId !== roomConfigurationId;
        if (!differentConfig) {
          continue; // Same config or null config → defer to concurrent limit check
        }
      }

      // Same room — use config-specific buffer if available
      bufferMinutes = await getBufferMinutes(
        existing.roomConfigurationId,
        roomConfigurationId,
        room.bufferMinutes
      );
      conflictContext = `in ${room.name}`;
    } else if (
      room.parentRoomId &&
      room.parentRoomId === existing.roomId
    ) {
      // Proposed is child, existing is parent.
      // EWL: always uses PARENT room's ParentConversionMinutes.
      // The existing instance is in the parent room, so use its value.
      bufferMinutes = existing.parentConversionMinutes;
      conflictContext = `in parent room ${existing.roomName}`;
    } else if (
      existing.parentRoomId &&
      existing.parentRoomId === roomId
    ) {
      // Proposed is parent, existing is child.
      // EWL: always uses PARENT room's ParentConversionMinutes.
      // The proposed room IS the parent, so use room's value.
      bufferMinutes = room.parentConversionMinutes;
      conflictContext = `in child room ${existing.roomName}`;
    } else {
      continue;
    }

    // Direct overlap check
    if (
      timeRangesOverlap(
        existing.startDateTime,
        existing.endDateTime,
        proposed.startDateTime,
        proposed.endDateTime
      )
    ) {
      const dateStr = isRecurring
        ? ` on ${formatDate(proposed.startDateTime, timezone)}`
        : "";
      conflicts.push({
        roomName: room.name,
        startDateTime: proposed.startDateTime,
        endDateTime: proposed.endDateTime,
        reason:
          existing.roomId !== roomId
            ? "parent_child_conflict"
            : "direct_overlap",
        message: `${room.name} is not available from ${fmtTime(proposed.startDateTime)} - ${fmtTime(proposed.endDateTime)}${dateStr} because of a previously scheduled event ${conflictContext}.`,
      });
      continue;
    }

    // Buffer overlap check
    if (!overrideBuffer && bufferMinutes > 0) {
      const bufferedStart = new Date(
        proposed.startDateTime.getTime() - bufferMinutes * 60 * 1000
      );
      const bufferedEnd = new Date(
        proposed.endDateTime.getTime() + bufferMinutes * 60 * 1000
      );

      if (
        timeRangesOverlap(
          existing.startDateTime,
          existing.endDateTime,
          bufferedStart,
          bufferedEnd
        )
      ) {
        const direction =
          existing.startDateTime > proposed.startDateTime ? "for" : "from";
        const dateStr = isRecurring
          ? ` on ${formatDate(proposed.startDateTime, timezone)}`
          : "";
        conflicts.push({
          roomName: room.name,
          startDateTime: proposed.startDateTime,
          endDateTime: proposed.endDateTime,
          reason: "buffer_conflict",
          message: `${room.name} is not available from ${fmtTime(proposed.startDateTime)} - ${fmtTime(proposed.endDateTime)}${dateStr} — insufficient time to reconfigure ${direction} a previously scheduled event (${bufferMinutes}-minute buffer required).`,
          canOverride: true,
        });
      }
    }
  }

  // Concurrent limit check (EWL lines 159-193)
  if (room.concurrentEventLimit > 1) {
    const concurrentInstances = existingInstances
      .filter(
        (ei) =>
          ei.roomId === roomId &&
          // If proposed has no config, count ALL same-room events (it occupies any config).
          // If proposed has a config, count matching config + config-less events.
          (!roomConfigurationId ||
            !ei.roomConfigurationId ||
            ei.roomConfigurationId === roomConfigurationId)
      )
      .map((ei) => ({
        startDateTime: ei.startDateTime,
        endDateTime: ei.endDateTime,
      }));

    // Add proposed instance
    concurrentInstances.push({
      startDateTime: proposed.startDateTime,
      endDateTime: proposed.endDateTime,
    });

    // Sort by start time
    concurrentInstances.sort(
      (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
    );

    // EWL uses GetBufferMinutes(config, config) which returns 0 when no
    // same-config reconfiguration entry exists. Same-config concurrent events
    // share the room simultaneously — no reconfiguration buffer needed.
    const bufferMs =
      (await getBufferMinutes(
        roomConfigurationId,
        roomConfigurationId,
        0
      )) *
      60 *
      1000;

    const clearTimes: number[] = [];

    for (const inst of concurrentInstances) {
      // Remove instances that have cleared
      const startMs = inst.startDateTime.getTime();
      const filtered = clearTimes.filter((ct) => ct > startMs);
      clearTimes.length = 0;
      clearTimes.push(...filtered);

      // Add this instance's clear time (end + buffer)
      clearTimes.push(inst.endDateTime.getTime() + bufferMs);

      // Only check from proposed instance's time window
      if (inst.startDateTime < proposed.startDateTime) continue;
      if (
        inst.startDateTime.getTime() >=
        proposed.endDateTime.getTime() + bufferMs
      )
        break;

      if (clearTimes.length > room.concurrentEventLimit) {
        const dateStr = isRecurring
          ? ` on ${formatDate(proposed.startDateTime, timezone)}`
          : "";
        conflicts.push({
          roomName: room.name,
          startDateTime: proposed.startDateTime,
          endDateTime: proposed.endDateTime,
          reason: "concurrent_limit_exceeded",
          message: `${room.name} has reached its concurrent event limit (${room.concurrentEventLimit}) during ${fmtTime(proposed.startDateTime)} - ${fmtTime(proposed.endDateTime)}${dateStr}.`,
        });
        break;
      }
    }
  }

  return conflicts;
}

// ============================================================
// FIND ALTERNATIVE ROOMS
// ============================================================

/**
 * Find alternative rooms of the same configuration type that are available.
 */
export async function findAlternativeRooms(
  orgId: string,
  configTypeId: string | null | undefined,
  start: Date,
  end: Date,
  excludeRoomId: string,
  includeManagersOnly: boolean = true
): Promise<AlternativeRoom[]> {
  if (!configTypeId) return [];

  // Find rooms with configurations of the same type
  // EWL: filters managersOnly rooms based on user role (ConflictDetectionOps.cs line 39)
  const configurations = await prisma.roomConfiguration.findMany({
    where: {
      configurationTypeId: configTypeId,
      room: {
        organizationId: orgId,
        active: true,
        id: { not: excludeRoomId },
        ...(includeManagersOnly ? {} : { managersOnly: false }),
      },
    },
    include: { room: true },
  });

  const alternatives: AlternativeRoom[] = [];

  for (const config of configurations) {
    // Widen query window by buffer to catch buffer conflicts (same as detectConflicts)
    const room = config.room;
    const altMaxBuffer = Math.max(room.bufferMinutes, room.parentConversionMinutes, 60);
    const altQueryStart = new Date(start.getTime() - altMaxBuffer * 60 * 1000);
    const altQueryEnd = new Date(end.getTime() + altMaxBuffer * 60 * 1000);

    const existing = await getExistingInstances(
      orgId,
      config.roomId,
      altQueryStart,
      altQueryEnd
    );

    const conflicts = await checkConflictsForInstance(
      { startDateTime: start, endDateTime: end },
      config.roomId,
      config.id,
      existing,
      {
        id: room.id,
        name: room.name,
        bufferMinutes: room.bufferMinutes,
        concurrentEventLimit: room.concurrentEventLimit,
        parentRoomId: room.parentRoomId,
        parentConversionMinutes: room.parentConversionMinutes,
      }
    );

    if (conflicts.length === 0) {
      alternatives.push({
        roomId: config.roomId,
        roomName: room.name,
        configurationId: config.id,
        configurationName: config.name,
      });
    }
  }

  return alternatives;
}

// ============================================================
// PUBLIC ENTRY POINTS
// ============================================================

/**
 * Detect conflicts for a single event. Public entry point.
 */
export async function detectConflicts(params: {
  orgId: string;
  roomId: string;
  roomConfigurationId?: string | null;
  roomConfigurationTypeId?: string | null;
  startDateTime: Date;
  endDateTime: Date;
  excludeEventIds?: string[];
  overrideBuffer?: boolean;
  timezone?: string;
  includeManagersOnlyAlternatives?: boolean;
}): Promise<ConflictResult> {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
  });
  if (!room) return { hasConflict: false, conflicts: [], alternatives: [] };

  // Widen the query window by max possible buffer to catch buffer conflicts
  const maxBuffer = Math.max(room.bufferMinutes, room.parentConversionMinutes, 60);
  const queryStart = new Date(
    params.startDateTime.getTime() - maxBuffer * 60 * 1000
  );
  const queryEnd = new Date(
    params.endDateTime.getTime() + maxBuffer * 60 * 1000
  );

  const existingInstances = await getExistingInstances(
    params.orgId,
    params.roomId,
    queryStart,
    queryEnd,
    params.excludeEventIds
  );

  const conflicts = await checkConflictsForInstance(
    { startDateTime: params.startDateTime, endDateTime: params.endDateTime },
    params.roomId,
    params.roomConfigurationId || null,
    existingInstances,
    {
      id: room.id,
      name: room.name,
      bufferMinutes: room.bufferMinutes,
      concurrentEventLimit: room.concurrentEventLimit,
      parentRoomId: room.parentRoomId,
      parentConversionMinutes: room.parentConversionMinutes,
    },
    false,
    params.overrideBuffer,
    params.timezone
  );

  let alternatives: AlternativeRoom[] = [];
  if (conflicts.length > 0) {
    alternatives = await findAlternativeRooms(
      params.orgId,
      params.roomConfigurationTypeId,
      params.startDateTime,
      params.endDateTime,
      params.roomId,
      params.includeManagersOnlyAlternatives ?? true
    );
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    alternatives,
  };
}

/**
 * Detect conflicts for a recurring event's instances.
 * Implements the EWL tentative instance pattern: each instance is checked against
 * existing events + previously-validated tentative instances to catch self-conflicts.
 */
export async function detectRecurrenceConflicts(params: {
  orgId: string;
  roomId: string;
  roomConfigurationId?: string | null;
  roomConfigurationTypeId?: string | null;
  instances: ProposedInstance[];
  excludeEventIds?: string[];
  overrideBuffer?: boolean;
  timezone?: string;
  includeManagersOnlyAlternatives?: boolean;
}): Promise<ConflictResult> {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
  });
  if (!room)
    return { hasConflict: false, conflicts: [], alternatives: [] };

  const allConflicts: ConflictInfo[] = [];
  const tentativeInstances: ExistingInstance[] = [];

  // Find the full time range to query existing instances
  if (params.instances.length === 0)
    return { hasConflict: false, conflicts: [], alternatives: [] };

  const maxBuffer = Math.max(room.bufferMinutes, room.parentConversionMinutes, 60);
  const earliest = new Date(
    Math.min(...params.instances.map((i) => i.startDateTime.getTime())) -
      maxBuffer * 60 * 1000
  );
  const latest = new Date(
    Math.max(...params.instances.map((i) => i.endDateTime.getTime())) +
      maxBuffer * 60 * 1000
  );

  const existingInstances = await getExistingInstances(
    params.orgId,
    params.roomId,
    earliest,
    latest,
    params.excludeEventIds
  );

  for (const proposed of params.instances) {
    // Check against existing + tentative instances
    const allExisting = [...existingInstances, ...tentativeInstances];

    const conflicts = await checkConflictsForInstance(
      proposed,
      params.roomId,
      params.roomConfigurationId || null,
      allExisting,
      {
        id: room.id,
        name: room.name,
        bufferMinutes: room.bufferMinutes,
        concurrentEventLimit: room.concurrentEventLimit,
        parentRoomId: room.parentRoomId,
        parentConversionMinutes: room.parentConversionMinutes,
      },
      true,
      params.overrideBuffer,
      params.timezone
    );

    if (conflicts.length > 0) {
      allConflicts.push(...conflicts);
    }

    // Add this instance as tentative for future checks (self-conflict detection)
    tentativeInstances.push({
      eventId: "__tentative__",
      roomId: params.roomId,
      roomName: room.name,
      parentRoomId: room.parentRoomId,
      parentConversionMinutes: room.parentConversionMinutes,
      startDateTime: proposed.startDateTime,
      endDateTime: proposed.endDateTime,
      roomConfigurationId: params.roomConfigurationId || null,
      concurrentEventLimit: room.concurrentEventLimit,
    });
  }

  let alternatives: AlternativeRoom[] = [];
  if (allConflicts.length > 0) {
    // Find alternatives for the first conflicting time slot
    const firstConflict = allConflicts[0];
    alternatives = await findAlternativeRooms(
      params.orgId,
      params.roomConfigurationTypeId,
      firstConflict.startDateTime,
      firstConflict.endDateTime,
      params.roomId,
      params.includeManagersOnlyAlternatives ?? true
    );
  }

  return {
    hasConflict: allConflicts.length > 0,
    conflicts: allConflicts,
    alternatives,
  };
}

// ============================================================
// HELPERS
// ============================================================

function formatTime(date: Date, timezone?: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function formatDate(date: Date, timezone?: string): string {
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}
