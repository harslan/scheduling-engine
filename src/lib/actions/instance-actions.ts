"use server";

import { prisma } from "@/lib/prisma";
import { wallTimeToUtc } from "@/lib/orgtime";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { detectConflicts } from "@/lib/conflict-detection";

// ============================================================
// HELPERS
// ============================================================

async function loadInstanceWithAuth(instanceId: string, orgSlug: string) {
  const session = await getSession();
  if (!session?.user) return { error: "Not authenticated" } as const;

  const userId = (session.user as { id: string }).id;

  const instance = await prisma.eventInstance.findUnique({
    where: { id: instanceId },
    include: {
      event: {
        include: { organization: true },
      },
    },
  });

  if (!instance || !instance.event) return { error: "Instance not found" } as const;
  if (instance.event.organization.slug !== orgSlug) return { error: "Instance not found" } as const;

  const event = instance.event;
  const org = event.organization;

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: org.id, userId },
  });

  const isAdmin = membership?.role === "ADMIN" || membership?.role === "MANAGER";

  // EWL: Support staff can modify events with instances starting within 24 hours
  const isSupportStaff = membership?.role === "EVENT_SUPPORT";
  const supportStaffWindowMs = 24 * 60 * 60 * 1000;
  const isInSupportWindow = isSupportStaff &&
    instance.startDateTime.getTime() > Date.now() &&
    instance.startDateTime.getTime() <= Date.now() + supportStaffWindowMs;

  const isSubmitter = event.submitterId === userId;

  if (!isSubmitter && !isAdmin && !isInSupportWindow) {
    return { error: "You do not have permission to modify this event." } as const;
  }

  return { instance, event, org, isAdmin: !!isAdmin || !!isInSupportWindow, userId, session } as const;
}

function getTimeInTimezone(
  date: Date,
  timezone?: string | null
): { hours: number; minutes: number } {
  const tz = timezone || undefined;
  const hours = parseInt(
    date.toLocaleString("en-US", { hour: "numeric", hour12: false, ...(tz ? { timeZone: tz } : {}) })
  );
  const minutes = parseInt(
    date.toLocaleString("en-US", { minute: "numeric", ...(tz ? { timeZone: tz } : {}) })
  );
  return { hours, minutes };
}

function getDateInTimezone(date: Date, timezone?: string | null): Date {
  const tz = timezone || undefined;
  const dateStr = date.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {});
  return new Date(dateStr + "T00:00:00Z");
}

// ============================================================
// deleteInstance
// ============================================================

export async function deleteInstance(instanceId: string, orgSlug: string) {
  const result = await loadInstanceWithAuth(instanceId, orgSlug);
  if ("error" in result) return { error: result.error };

  const { instance, event, org, isAdmin, session } = result;

  // Guards
  if (instance.deleted) {
    return { error: "This instance has already been cancelled." };
  }
  if (event.deleted || event.status === "CANCELLED") {
    return { error: "Cannot modify a cancelled event." };
  }
  if (!org.allowsEventChanges && !isAdmin) {
    return { error: "Event changes are not allowed for this organization." };
  }
  if (!isAdmin && instance.startDateTime < new Date()) {
    return { error: "Past instances cannot be cancelled. Please contact an administrator." };
  }

  await prisma.$transaction([
    prisma.eventInstance.update({
      where: { id: instanceId },
      data: { deleted: true },
    }),
    prisma.eventActivity.create({
      data: {
        eventId: event.id,
        action: "INSTANCE_DELETED",
        actorEmail: session.user?.email || "",
        details: {
          instanceDate: instance.startDateTime.toISOString(),
        },
      },
    }),
  ]);

  revalidatePath(`/${orgSlug}/events/${event.id}`);
  revalidatePath(`/${orgSlug}`);

  return { success: true };
}

// ============================================================
// deleteAllFutureInstances
// ============================================================

export async function deleteAllFutureInstances(instanceId: string, orgSlug: string) {
  const result = await loadInstanceWithAuth(instanceId, orgSlug);
  if ("error" in result) return { error: result.error };

  const { instance, event, org, isAdmin, session } = result;

  // Guards
  if (instance.deleted) {
    return { error: "This instance has already been cancelled." };
  }
  if (event.deleted || event.status === "CANCELLED") {
    return { error: "Cannot modify a cancelled event." };
  }
  if (!org.allowsEventChanges && !isAdmin) {
    return { error: "Event changes are not allowed for this organization." };
  }
  if (!isAdmin && instance.startDateTime < new Date()) {
    return { error: "Past instances cannot be cancelled. Please contact an administrator." };
  }

  // Find all non-deleted instances at or after this one
  const futureInstances = await prisma.eventInstance.findMany({
    where: {
      eventId: event.id,
      deleted: false,
      startDateTime: { gte: instance.startDateTime },
    },
  });

  // Update the recurrence end date to just before this instance
  const newEndDate = new Date(instance.startDateTime.getTime() - 1);

  await prisma.$transaction([
    prisma.eventInstance.updateMany({
      where: {
        eventId: event.id,
        deleted: false,
        startDateTime: { gte: instance.startDateTime },
      },
      data: { deleted: true },
    }),
    prisma.event.update({
      where: { id: event.id },
      data: { recurrenceEndDate: newEndDate },
    }),
    prisma.eventActivity.create({
      data: {
        eventId: event.id,
        action: "FUTURE_INSTANCES_DELETED",
        actorEmail: session.user?.email || "",
        details: {
          fromDate: instance.startDateTime.toISOString(),
          count: futureInstances.length,
        },
      },
    }),
  ]);

  revalidatePath(`/${orgSlug}/events/${event.id}`);
  revalidatePath(`/${orgSlug}`);

  return { success: true, deletedCount: futureInstances.length };
}

// ============================================================
// endSeriesNow
// ============================================================

export async function endSeriesNow(eventId: string, orgSlug: string) {
  const session = await getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const userId = (session.user as { id: string }).id;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true },
  });

  if (!event) return { error: "Event not found" };
  if (event.organization.slug !== orgSlug) return { error: "Event not found" };

  const org = event.organization;

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: org.id, userId },
  });

  const isAdminRole = membership?.role === "ADMIN" || membership?.role === "MANAGER";

  // EWL: Support staff can modify events with instances starting within 24 hours
  const isSupportStaff = membership?.role === "EVENT_SUPPORT";
  let isInSupportWindow = false;
  if (isSupportStaff) {
    const soonestInstance = await prisma.eventInstance.findFirst({
      where: {
        eventId: event.id,
        deleted: false,
        startDateTime: { gt: new Date(), lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      },
    });
    isInSupportWindow = !!soonestInstance;
  }

  const isAdmin = isAdminRole || isInSupportWindow;

  const isSubmitter = event.submitterId === userId;
  if (!isSubmitter && !isAdmin) {
    return { error: "You do not have permission to modify this event." };
  }

  if (event.deleted || event.status === "CANCELLED") {
    return { error: "Cannot modify a cancelled event." };
  }
  if (!org.allowsEventChanges && !isAdmin) {
    return { error: "Event changes are not allowed for this organization." };
  }

  const now = new Date();

  // Count how many will be deleted
  const futureInstances = await prisma.eventInstance.findMany({
    where: {
      eventId: event.id,
      deleted: false,
      startDateTime: { gt: now },
    },
  });

  if (futureInstances.length === 0) {
    return { error: "No future instances to cancel." };
  }

  await prisma.$transaction([
    prisma.eventInstance.updateMany({
      where: {
        eventId: event.id,
        deleted: false,
        startDateTime: { gt: now },
      },
      data: { deleted: true },
    }),
    prisma.event.update({
      where: { id: event.id },
      data: { recurrenceEndDate: now },
    }),
    prisma.eventActivity.create({
      data: {
        eventId: event.id,
        action: "SERIES_ENDED_EARLY",
        actorEmail: session.user?.email || "",
        details: {
          endedAt: now.toISOString(),
          count: futureInstances.length,
        },
      },
    }),
  ]);

  revalidatePath(`/${orgSlug}/events/${event.id}`);
  revalidatePath(`/${orgSlug}`);

  return { success: true, deletedCount: futureInstances.length };
}

// ============================================================
// updateInstance
// ============================================================

export async function updateInstance(
  instanceId: string,
  orgSlug: string,
  data: { startDateTime: string; endDateTime: string; roomId?: string }
) {
  const result = await loadInstanceWithAuth(instanceId, orgSlug);
  if ("error" in result) return { error: result.error };

  const { instance, event, org, isAdmin, session } = result;

  // Guards
  if (instance.deleted) {
    return { error: "This instance has been cancelled." };
  }
  if (event.deleted || event.status === "CANCELLED") {
    return { error: "Cannot modify a cancelled event." };
  }
  if (!org.allowsEventChanges && !isAdmin) {
    return { error: "Event changes are not allowed for this organization." };
  }

  // Form times are wall-clock in the org's timezone
  const startDt = wallTimeToUtc(data.startDateTime, org.timezone);
  const endDt = wallTimeToUtc(data.endDateTime, org.timezone);

  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
    return { error: "Invalid date/time values." };
  }
  if (startDt >= endDt) {
    return { error: "End time must be after start time." };
  }

  // Non-admin constraints
  if (!isAdmin) {
    // Past-event check
    const nowInTz = getDateInTimezone(new Date(), org.timezone);
    const startInTz = getDateInTimezone(startDt, org.timezone);
    const diffDays = Math.floor(
      (startInTz.getTime() - nowInTz.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return { error: "Cannot schedule instances in the past." };
    }

    if (org.schedulingCutoffDays && diffDays < org.schedulingCutoffDays) {
      return {
        error: `Events must be scheduled at least ${org.schedulingCutoffDays} day(s) in advance.`,
      };
    }

    if (org.schedulingCutoffFixedDate && startDt > org.schedulingCutoffFixedDate) {
      const cutoffStr = org.schedulingCutoffFixedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      return {
        error: `Events cannot be scheduled after ${cutoffStr}.`,
      };
    }

    // Duration check
    const durationMinutes = (endDt.getTime() - startDt.getTime()) / (1000 * 60);
    if (org.maxEventLengthMinutes && durationMinutes > org.maxEventLengthMinutes) {
      const hours = Math.floor(org.maxEventLengthMinutes / 60);
      const mins = org.maxEventLengthMinutes % 60;
      return {
        error: `Event duration exceeds the maximum of ${hours > 0 ? `${hours}h` : ""}${mins > 0 ? ` ${mins}m` : ""}.`,
      };
    }

    // Opening/closing times
    if (org.roomOpeningTime && org.roomClosingTime) {
      const [openH, openM] = org.roomOpeningTime.split(":").map(Number);
      const [closeH, closeM] = org.roomClosingTime.split(":").map(Number);
      const startInTzTime = getTimeInTimezone(startDt, org.timezone);
      const endInTzTime = getTimeInTimezone(endDt, org.timezone);
      const startMinutes = startInTzTime.hours * 60 + startInTzTime.minutes;
      const endMinutes = endInTzTime.hours * 60 + endInTzTime.minutes;
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (
        startMinutes < openMinutes ||
        endMinutes > closeMinutes ||
        (closeMinutes > openMinutes && endMinutes <= startMinutes)
      ) {
        return {
          error: `Events must be scheduled between ${org.roomOpeningTime} and ${org.roomClosingTime}.`,
        };
      }
    }
  }

  // Room validation
  const effectiveRoomId = data.roomId || event.roomId;
  if (effectiveRoomId) {
    const room = await prisma.room.findFirst({
      where: { id: effectiveRoomId, organizationId: org.id },
    });
    if (!room) return { error: "Room not found." };
    if (!room.active) return { error: `${room.name} is no longer available for booking.` };
    if (room.managersOnly && !isAdmin) {
      return { error: `${room.name} is only available to managers.` };
    }

    // Conflict detection — exclude the parent event so sibling instances don't false-positive
    const conflictResult = await detectConflicts({
      orgId: org.id,
      roomId: effectiveRoomId,
      roomConfigurationId: event.roomConfigurationId,
      startDateTime: startDt,
      endDateTime: endDt,
      excludeEventIds: [event.id],
      timezone: org.timezone || undefined,
    });

    if (conflictResult.hasConflict) {
      return {
        error: conflictResult.conflicts.map((c) => c.message).join("\n"),
      };
    }
  }

  await prisma.$transaction([
    prisma.eventInstance.update({
      where: { id: instanceId },
      data: {
        startDateTime: startDt,
        endDateTime: endDt,
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId: event.id,
        action: "INSTANCE_UPDATED",
        actorEmail: session.user?.email || "",
        details: {
          instanceId,
          oldStart: instance.startDateTime.toISOString(),
          oldEnd: instance.endDateTime.toISOString(),
          newStart: startDt.toISOString(),
          newEnd: endDt.toISOString(),
        },
      },
    }),
  ]);

  revalidatePath(`/${orgSlug}/events/${event.id}`);
  revalidatePath(`/${orgSlug}`);

  return { success: true };
}
