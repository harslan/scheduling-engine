"use server";

import { prisma } from "@/lib/prisma";
import { getSession, requireOrgRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  detectConflicts,
  detectRecurrenceConflicts,
} from "@/lib/conflict-detection";
import { notifyApprovers } from "@/lib/actions/approvals";
import { buildEventMergeData } from "@/lib/email-merge";
import { sendTemplatedEmail } from "@/lib/email";
import { generateInstances } from "@/lib/recurrence";

const UpdateEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  eventTypeId: z.string().optional(),
  roomId: z.string().optional(),
  roomConfigurationId: z.string().optional(),
  startDateTime: z.string().min(1, "Start date is required"),
  endDateTime: z.string().min(1, "End date is required"),
  expectedAttendeeCount: z.coerce.number().int().positive().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email("Valid email is required"),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateEvent(eventId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const startDt = new Date(data.startDateTime);
  const endDt = new Date(data.endDateTime);

  if (startDt >= endDt) {
    return { error: "End time must be after start time" };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true },
  });
  if (!event) return { error: "Event not found" };

  // Allow the submitter, admin/manager, or support staff (within 24h window) to update
  const userId = (session.user as { id: string }).id;
  const org = event.organization;

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: org.id, userId },
  });

  const isAdminRole = membership?.role === "ADMIN" || membership?.role === "MANAGER";

  // EWL: Support staff can modify events with instances starting within 24 hours
  const isSupportStaff = membership?.role === "EVENT_SUPPORT";
  let isInSupportWindow = false;
  if (isSupportStaff) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    // Check if event (non-recurring) or any instance starts within the window
    if (!event.recurrenceRule && event.startDateTime && event.startDateTime > now && event.startDateTime <= windowEnd) {
      isInSupportWindow = true;
    } else if (event.recurrenceRule) {
      const soonInstance = await prisma.eventInstance.findFirst({
        where: {
          eventId: event.id,
          deleted: false,
          startDateTime: { gt: now, lte: windowEnd },
        },
      });
      isInSupportWindow = !!soonInstance;
    }
  }

  // Determine admin status: true admins/managers OR support staff in window
  const isAdmin = isAdminRole || isInSupportWindow ? membership : null;

  if (event.submitterId !== userId && !isAdmin) {
    return { error: "You do not have permission to modify this event." };
  }

  // EWL: non-admins cannot modify events when allowsEventChanges is false
  if (!org.allowsEventChanges && !isAdmin) {
    return { error: "Event changes are not allowed for this organization." };
  }

  // EWL: cannot modify deleted/cancelled or denied events (ApproveOrDeny.cs lines 18-19)
  if (event.status === "CANCELLED" || event.deleted) {
    return { error: "Cannot modify a cancelled event." };
  }
  if (event.status === "DENIED" && !isAdmin) {
    return { error: "This event has been denied. Please contact an administrator to resubmit." };
  }

  // Detect if time/room changed for recurring events (used below for instance regeneration)
  const recurringTimeOrRoomChanged = event.recurrenceRule ? (
    startDt.getTime() !== event.startDateTime?.getTime() ||
    endDt.getTime() !== event.endDateTime?.getTime() ||
    (data.roomId || null) !== event.roomId
  ) : false;

  // Multi-day event check (applies to all users when disabled)
  if (!org.allowsMultiDayEvents) {
    const startDateStr = startDt.toLocaleDateString("en-CA", org.timezone ? { timeZone: org.timezone } : {});
    const endDateStr = endDt.toLocaleDateString("en-CA", org.timezone ? { timeZone: org.timezone } : {});
    if (startDateStr !== endDateStr) {
      return { error: "Multi-day events are not allowed for this organization." };
    }
  }

  // Enforce scheduling constraints for non-admin users
  if (!isAdmin) {
    const durationMinutes = (endDt.getTime() - startDt.getTime()) / (1000 * 60);
    if (org.maxEventLengthMinutes && durationMinutes > org.maxEventLengthMinutes) {
      const hours = Math.floor(org.maxEventLengthMinutes / 60);
      const mins = org.maxEventLengthMinutes % 60;
      return {
        error: `Event duration exceeds the maximum of ${hours > 0 ? `${hours}h` : ""}${mins > 0 ? ` ${mins}m` : ""}. Please shorten your event.`,
      };
    }

    if (org.roomOpeningTime && org.roomClosingTime) {
      const [openH, openM] = org.roomOpeningTime.split(":").map(Number);
      const [closeH, closeM] = org.roomClosingTime.split(":").map(Number);
      const startInTz = getTimeInTimezone(startDt, org.timezone);
      const endInTz = getTimeInTimezone(endDt, org.timezone);
      const startMinutes = startInTz.hours * 60 + startInTz.minutes;
      const endMinutes = endInTz.hours * 60 + endInTz.minutes;
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (
        startMinutes < openMinutes ||
        endMinutes > closeMinutes ||
        // Reject midnight-crossing events for daytime operating hours
        (closeMinutes > openMinutes && endMinutes <= startMinutes)
      ) {
        return {
          error: `Events must be scheduled between ${org.roomOpeningTime} and ${org.roomClosingTime}.`,
        };
      }
    }

    // Past-event check applies regardless of cutoff setting
    const nowInTz = getDateInTimezone(new Date(), org.timezone);
    const startInTz = getDateInTimezone(startDt, org.timezone);
    const diffDays = Math.floor(
      (startInTz.getTime() - nowInTz.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return { error: "Cannot schedule events in the past." };
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
  }

  // Validate event type belongs to this organization (prevent cross-org linkage)
  if (data.eventTypeId) {
    const eventType = await prisma.eventType.findFirst({
      where: { id: data.eventTypeId, organizationId: org.id },
    });
    if (!eventType) return { error: "Invalid event type." };
  }

  // Normalize roomId comparison (undefined/"" → null to match Prisma null)
  const roomChanged = (data.roomId || null) !== event.roomId;

  // Conflict detection for room/time changes
  if (data.roomId) {
    // Validate room belongs to this organization (prevent cross-org linkage)
    const room = await prisma.room.findFirst({ where: { id: data.roomId, organizationId: org.id } });
    if (!room) return { error: "Room not found" };

    // EWL: room must be active
    if (!room.active) {
      return { error: `${room.name} is no longer available for booking.` };
    }

    // Manager-only room check (EWL: AvailableOnlyToManagers)
    if (room.managersOnly && !isAdmin) {
      return { error: `${room.name} is only available to managers. Please select a different room.` };
    }

    // Validate room configuration belongs to the selected room (prevent cross-room linkage)
    if (data.roomConfigurationId) {
      const config = await prisma.roomConfiguration.findFirst({
        where: { id: data.roomConfigurationId, roomId: data.roomId },
      });
      if (!config) return { error: "Invalid room configuration for the selected room." };
    }

    // Use submitted configId, or fall back to event's existing config if room didn't change
    const effectiveConfigId = data.roomConfigurationId
      || (roomChanged ? undefined : event.roomConfigurationId)
      || undefined;

    // For recurring events with time/room changes, check the regenerated future instances
    if (recurringTimeOrRoomChanged && event.recurrenceRule && event.recurrenceEndDate) {
      // Load excluded dates for conflict check
      const exDates = await prisma.excludedDate.findMany({ where: { eventId } });
      const exDatesSet = exDates.length > 0
        ? new Set(exDates.map((ed) => ed.date.toISOString().split("T")[0]))
        : undefined;

      const futureInstances = generateInstances(
        startDt,
        endDt,
        event.recurrenceRule,
        event.recurrenceEndDate,
        exDatesSet
      ).filter((inst) => inst.startDateTime >= new Date());

      if (futureInstances.length > 0) {
        const result = await detectRecurrenceConflicts({
          orgId: event.organizationId,
          roomId: data.roomId,
          roomConfigurationId: effectiveConfigId,
          instances: futureInstances,
          excludeEventIds: [eventId],
          timezone: event.organization.timezone || undefined,
          includeManagersOnlyAlternatives: !!isAdmin,
        });

        if (result.hasConflict) {
          return {
            error: result.conflicts.map((c) => c.message).join("\n"),
            conflicts: result.conflicts,
            alternatives: result.alternatives,
          };
        }
      }
    } else {
      const result = await detectConflicts({
        orgId: event.organizationId,
        roomId: data.roomId,
        roomConfigurationId: effectiveConfigId,
        startDateTime: startDt,
        endDateTime: endDt,
        excludeEventIds: [eventId],
        timezone: event.organization.timezone,
        includeManagersOnlyAlternatives: !!isAdmin,
      });

      if (result.hasConflict) {
        return {
          error: result.conflicts.map((c) => c.message).join("\n"),
          conflicts: result.conflicts,
          alternatives: result.alternatives,
        };
      }
    }
  }

  // EWL prohibit-lengthening rule: non-admin users cannot extend an approved event
  // (start earlier or end later). They CAN shorten it (start later or end earlier)
  // without re-approval — shortening can't create new conflicts.
  const timeChanged =
    startDt.getTime() !== event.startDateTime?.getTime() ||
    endDt.getTime() !== event.endDateTime?.getTime();
  const timeOrRoomChanged = roomChanged || timeChanged;

  if (!isAdmin && event.status === "APPROVED" && event.startDateTime && event.endDateTime) {
    const startedEarlier = startDt.getTime() < event.startDateTime.getTime();
    const endedLater = endDt.getTime() > event.endDateTime.getTime();
    if (startedEarlier || endedLater) {
      return {
        error: "This event has already been approved. You may shorten it, but extending the start or end time requires a manager.",
      };
    }
  }

  // If org requires approval and room changed, reset to PENDING for re-review.
  // Time-only shortening of approved events does not need re-approval (EWL rule).
  // (Admin/managers can make changes without re-approval.)
  let needsReApproval = false;
  if (org.requiresApproval && event.status === "APPROVED" && !isAdmin) {
    if (roomChanged) {
      needsReApproval = true;
    }
    // Pure time shortening → no re-approval needed (can't create conflicts)
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: {
        title: data.title,
        eventTypeId: data.eventTypeId || null,
        roomId: data.roomId || null,
        roomConfigurationId: data.roomConfigurationId || (roomChanged ? null : undefined),
        startDateTime: startDt,
        endDateTime: endDt,
        expectedAttendeeCount: data.expectedAttendeeCount || null,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone || "",
        notes: data.notes || "",
        ...(needsReApproval ? { status: "PENDING", approved: false } : {}),
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: needsReApproval ? "EVENT_UPDATED_PENDING_REAPPROVAL" : "EVENT_UPDATED",
        actorEmail: session.user?.email || "",
        details: { title: data.title },
      },
    }),
  ]);

  // Recurring event instance regeneration: when time/room changes on a recurring event,
  // soft-delete future instances and regenerate with the new schedule.
  // Past instances are preserved as-is (cleaner than EWL's split-into-two-events pattern).
  if (recurringTimeOrRoomChanged && event.recurrenceRule && event.recurrenceEndDate) {
    const now = new Date();

    // Soft-delete all future non-deleted instances
    await prisma.eventInstance.updateMany({
      where: {
        eventId,
        deleted: false,
        startDateTime: { gt: now },
      },
      data: { deleted: true },
    });

    // Load excluded dates for this event
    const excludedDateRows = await prisma.excludedDate.findMany({
      where: { eventId },
    });
    const excludedDatesSet = excludedDateRows.length > 0
      ? new Set(excludedDateRows.map((ed) => ed.date.toISOString().split("T")[0]))
      : undefined;

    // Generate new instances with the updated schedule
    const newInstances = generateInstances(
      startDt,
      endDt,
      event.recurrenceRule,
      event.recurrenceEndDate,
      excludedDatesSet
    ).filter((inst) => inst.startDateTime > now);

    if (newInstances.length > 0) {
      await prisma.eventInstance.createMany({
        data: newInstances.map((inst) => ({
          eventId,
          startDateTime: inst.startDateTime,
          endDateTime: inst.endDateTime,
          expectedAttendeeCount: data.expectedAttendeeCount || null,
        })),
      });
    }

    await prisma.eventActivity.create({
      data: {
        eventId,
        action: "RECURRING_INSTANCES_REGENERATED",
        actorEmail: session.user?.email || "",
        details: {
          regeneratedCount: newInstances.length,
          reason: "Time or room changed on recurring event",
        },
      },
    });
  }

  // If re-approval triggered, notify approvers so the event doesn't sit in limbo
  if (needsReApproval) {
    // Clear previous notification records so approvers get re-notified
    // (they were already marked notified from the initial submission)
    await prisma.notifiedApprover.deleteMany({
      where: { eventId, organizationId: org.id },
    });

    const roomName = data.roomId
      ? (await prisma.room.findUnique({ where: { id: data.roomId } }))?.name || ""
      : "";
    const mergeData = buildEventMergeData(
      {
        id: eventId,
        title: data.title,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        startDateTime: startDt,
        endDateTime: endDt,
        status: "PENDING",
      },
      org,
      roomName
    );
    await notifyApprovers(eventId, org.id, mergeData, org.emailReplyToAddress || undefined);
  }

  // Send update notification to the event contact (EWL "Event Changed" email).
  // Skip if the person editing IS the contact (they know what they changed).
  if (data.contactEmail && session.user?.email !== data.contactEmail) {
    const roomName = data.roomId
      ? (await prisma.room.findUnique({ where: { id: data.roomId } }))?.name || ""
      : "";
    const mergeData = buildEventMergeData(
      {
        id: eventId,
        title: data.title,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        startDateTime: startDt,
        endDateTime: endDt,
        status: needsReApproval ? "PENDING" : event.status,
      },
      org,
      roomName
    );
    if (event.emailUpdates) {
      await sendTemplatedEmail({
        to: data.contactEmail,
        orgId: org.id,
        templateSlug: "event-updated",
        mergeData,
        replyTo: org.emailReplyToAddress || undefined,
      });
    }
  }

  revalidatePath(`/${org.slug}`);
  revalidatePath(`/${org.slug}/events/${eventId}`);
  revalidatePath(`/${org.slug}/my-events`);
  if (needsReApproval) {
    revalidatePath(`/${org.slug}/admin/approvals`);
  }

  return { success: true };
}

// ============================================================
// TIMEZONE HELPERS
// ============================================================

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

/** Uses UTC midnight to avoid DST off-by-one errors in day-difference calculations. */
function getDateInTimezone(date: Date, timezone?: string | null): Date {
  const tz = timezone || undefined;
  const dateStr = date.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {});
  return new Date(dateStr + "T00:00:00Z");
}
