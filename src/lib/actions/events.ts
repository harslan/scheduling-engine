"use server";

import { prisma } from "@/lib/prisma";
import { wallTimeToUtc } from "@/lib/orgtime";
import { getSession, requireOrgRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateInstances } from "@/lib/recurrence";
import {
  detectConflicts,
  detectRecurrenceConflicts,
} from "@/lib/conflict-detection";
import { notifyApprovers } from "@/lib/actions/approvals";
import { sendTemplatedEmail, buildEventMergeData } from "@/lib/email";

const SubmitEventSchema = z.object({
  organizationId: z.string(),
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
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  notes: z.string().optional(),
  recurrenceRule: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
});

export async function submitEvent(formData: FormData) {
  const session = await getSession();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const raw = Object.fromEntries(formData.entries());
  const excludedDateStrings = formData.getAll("excludedDates").map((v) => String(v)).filter(Boolean);
  const overrideBuffer = formData.get("overrideBuffer") === "true";
  const emailUpdates = formData.get("emailUpdates") === "true";

  const parsed = SubmitEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;

  // Check if org requires approval (fetched first: form times are wall-clock
  // in the org's timezone, so parsing needs org.timezone)
  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });

  if (!org) return { error: "Organization not found" };

  const startDt = wallTimeToUtc(data.startDateTime, org.timezone);
  const endDt = wallTimeToUtc(data.endDateTime, org.timezone);

  // Validate start < end
  if (startDt >= endDt) {
    return { error: "End time must be after start time" };
  }

  // Determine admin status once (reused for constraint bypass)
  const membership = userId
    ? await prisma.organizationMember.findFirst({
        where: { organizationId: org.id, userId },
      })
    : null;
  const isAdminRole = membership?.role === "ADMIN" || membership?.role === "MANAGER";

  // EWL: Support staff can modify events with instances starting within 24 hours
  const isSupportStaff = membership?.role === "EVENT_SUPPORT";
  const supportStaffWindowMs = 24 * 60 * 60 * 1000;
  const isInSupportWindow = isSupportStaff &&
    startDt.getTime() > Date.now() &&
    startDt.getTime() <= Date.now() + supportStaffWindowMs;

  const isAdmin = isAdminRole || isInSupportWindow ? membership : null;

  // Multi-day event check (applies to all users when disabled)
  if (!org.allowsMultiDayEvents) {
    const startDateStr = startDt.toLocaleDateString("en-CA", org.timezone ? { timeZone: org.timezone } : {});
    const endDateStr = endDt.toLocaleDateString("en-CA", org.timezone ? { timeZone: org.timezone } : {});
    if (startDateStr !== endDateStr) {
      return { error: "Multi-day events are not allowed for this organization." };
    }
  }

  // EWL: multi-day events cannot be recurring (ConceptualEventModification.cs lines 265-276)
  if (data.recurrenceRule && data.recurrenceRule.length > 0 && data.recurrenceEndDate) {
    const startDateStr = startDt.toLocaleDateString("en-CA", org.timezone ? { timeZone: org.timezone } : {});
    const endDateStr = endDt.toLocaleDateString("en-CA", org.timezone ? { timeZone: org.timezone } : {});
    if (startDateStr !== endDateStr) {
      return { error: "Recurring events cannot span multiple days." };
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

    // Fixed date cutoff: no scheduling beyond this date
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

  const hasRecurrence = data.recurrenceRule && data.recurrenceRule.length > 0 && data.recurrenceEndDate;
  // "until Dec 1" means through the END of Dec 1 in the org's timezone
  const recEndDt = data.recurrenceEndDate
    ? wallTimeToUtc(`${data.recurrenceEndDate.slice(0, 10)}T23:59`, org.timezone)
    : null;

  // EWL: validate recurrence end date bounds (ConceptualEventModification.cs lines 464-474)
  if (hasRecurrence) {
    const recEnd = recEndDt!;
    if (recEnd < startDt) {
      return { error: "Recurrence end date must be on or after the event start date." };
    }
    // Non-admins limited to scheduling cutoff (default: 1 year max for recurrence)
    if (!isAdmin) {
      const maxRecurrenceDate = new Date();
      if (org.schedulingCutoffDays) {
        maxRecurrenceDate.setDate(maxRecurrenceDate.getDate() + org.schedulingCutoffDays);
      } else {
        maxRecurrenceDate.setFullYear(maxRecurrenceDate.getFullYear() + 1);
      }
      if (recEnd > maxRecurrenceDate) {
        return {
          error: `Recurrence end date cannot extend beyond ${maxRecurrenceDate.toLocaleDateString()}.`,
        };
      }
    }
  }

  // Validate event type belongs to this organization (prevent cross-org linkage)
  if (data.eventTypeId) {
    const eventType = await prisma.eventType.findFirst({
      where: { id: data.eventTypeId, organizationId: data.organizationId },
    });
    if (!eventType) return { error: "Invalid event type." };
  }

  // Look up the room once (reused for conflict detection + email merge)
  // Validate room belongs to this organization (prevent cross-org linkage)
  const room = data.roomId
    ? await prisma.room.findFirst({ where: { id: data.roomId, organizationId: data.organizationId } })
    : null;
  if (data.roomId && !room) {
    return { error: "Room not found." };
  }

  // Look up configuration type for alternative room suggestions
  const roomConfig = data.roomConfigurationId
    ? await prisma.roomConfiguration.findUnique({
        where: { id: data.roomConfigurationId },
      })
    : null;
  const roomConfigTypeId = roomConfig?.configurationTypeId || undefined;

  // Validate room configuration belongs to the selected room
  if (roomConfig && data.roomId && roomConfig.roomId !== data.roomId) {
    return { error: "Invalid room configuration for the selected room." };
  }

  // EWL: roomless events require org setting (ConceptualEventModification.cs line 54-55)
  if (!data.roomId && !org.allowsRoomlessEvents) {
    return { error: "A room selection is required for this organization." };
  }

  // EWL: room must be active (SubmitEvent/Page.cs line 34)
  if (room && !room.active) {
    return { error: `${room.name} is no longer available for booking.` };
  }

  // Manager-only room check (EWL: AvailableOnlyToManagers)
  if (room && room.managersOnly && !isAdmin) {
    return { error: `${room.name} is only available to managers. Please select a different room.` };
  }

  // Build excluded dates set for recurrence generation
  const excludedDatesSet = excludedDateStrings.length > 0
    ? new Set(excludedDateStrings)
    : undefined;

  // Validate recurrence generates at least one instance
  if (hasRecurrence) {
    const testInstances = generateInstances(startDt, endDt, data.recurrenceRule!, recEndDt!, excludedDatesSet);
    if (testInstances.length === 0) {
      return { error: "No recurring instances could be generated. Check your recurrence settings and end date." };
    }
  }

  // Room conflict detection using full engine
  if (data.roomId && room) {
    if (hasRecurrence) {
      const recEndDate = recEndDt!;
      const instances = generateInstances(startDt, endDt, data.recurrenceRule!, recEndDate, excludedDatesSet);
      if (instances.length > 0) {
        const result = await detectRecurrenceConflicts({
          orgId: data.organizationId,
          roomId: data.roomId,
          roomConfigurationId: data.roomConfigurationId,
          roomConfigurationTypeId: roomConfigTypeId,
          instances,
          timezone: org.timezone,
          overrideBuffer: overrideBuffer && !!isAdmin,
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
        orgId: data.organizationId,
        roomId: data.roomId,
        roomConfigurationId: data.roomConfigurationId,
        roomConfigurationTypeId: roomConfigTypeId,
        startDateTime: startDt,
        endDateTime: endDt,
        timezone: org.timezone,
        overrideBuffer: overrideBuffer && !!isAdmin,
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
  const recEndDate = recEndDt;

  // Determine if this event should be auto-approved.
  // EWL rule: admins/managers + designated approvers get auto-approval even when org requires it.
  let autoApproved = !org.requiresApproval;
  if (!autoApproved && userId) {
    if (isAdmin) {
      autoApproved = true;
    } else {
      // Check if submitter is the org approver or the room-specific approver
      const isOrgApprover = org.approverId === userId;
      const isRoomApprover = room?.approverId === userId;
      if (isOrgApprover || isRoomApprover) {
        autoApproved = true;
      }
    }
  }

  const event = await prisma.event.create({
    data: {
      organizationId: data.organizationId,
      submitterId: userId,
      title: data.title,
      eventTypeId: data.eventTypeId || null,
      roomId: data.roomId || null,
      roomConfigurationId: data.roomConfigurationId || null,
      startDateTime: startDt,
      endDateTime: endDt,
      expectedAttendeeCount: data.expectedAttendeeCount || null,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || "",
      description: data.description || "",
      websiteUrl: data.websiteUrl || "",
      notes: data.notes || "",
      recurrenceRule: hasRecurrence ? data.recurrenceRule! : null,
      recurrenceEndDate: hasRecurrence ? recEndDate : null,
      overrideBuffer: overrideBuffer && !!isAdmin,
      emailUpdates,
      status: autoApproved ? "APPROVED" : "PENDING",
      approved: autoApproved,
    },
  });

  // Generate recurring instances
  if (hasRecurrence && recEndDate) {
    const instances = generateInstances(startDt, endDt, data.recurrenceRule!, recEndDate, excludedDatesSet);
    if (instances.length > 0) {
      await prisma.eventInstance.createMany({
        data: instances.map((inst) => ({
          eventId: event.id,
          startDateTime: inst.startDateTime,
          endDateTime: inst.endDateTime,
          expectedAttendeeCount: data.expectedAttendeeCount || null,
        })),
      });
    }
  }

  // Persist excluded dates
  if (excludedDateStrings.length > 0) {
    await prisma.excludedDate.createMany({
      data: excludedDateStrings.map((d) => ({
        eventId: event.id,
        date: new Date(d + "T00:00:00Z"),
      })),
    });
  }

  // Log activity
  await prisma.eventActivity.create({
    data: {
      eventId: event.id,
      action: "EVENT_SUBMITTED",
      actorEmail: data.contactEmail,
      details: {
        title: data.title,
        ...(hasRecurrence ? { recurrence: data.recurrenceRule } : {}),
      },
    },
  });

  const mergeData = buildEventMergeData(event, org, room?.name || "");

  // Send confirmation email to submitter (respects emailUpdates preference)
  if (emailUpdates) {
    await sendTemplatedEmail({
      to: data.contactEmail,
      orgId: org.id,
      templateSlug: autoApproved ? "event-approved" : "event-submitted",
      mergeData,
      replyTo: org.emailReplyToAddress || undefined,
    });
  }

  // If approval required and not auto-approved, notify designated approvers
  if (org.requiresApproval && !autoApproved) {
    await notifyApprovers(event.id, org.id, mergeData, org.emailReplyToAddress || undefined);
  }

  revalidatePath(`/${org.slug}`);
  revalidatePath(`/${org.slug}/my-events`);
  revalidatePath(`/${org.slug}/admin/approvals`);

  return { success: true, eventId: event.id };
}

export async function approveEvent(eventId: string, orgSlug: string, comment?: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true, room: true, instances: true },
  });
  if (!event) return { error: "Event not found" };

  const { user } = await requireOrgRole(event.organizationId, ["ADMIN", "MANAGER"]);
  if (event.status === "APPROVED") return { success: true }; // idempotent
  const userId = user.id;

  // EWL: cannot approve deleted/cancelled events (ApproveOrDeny.cs lines 17-22)
  if (event.deleted || event.status === "CANCELLED") {
    return { error: "Cannot approve a deleted or cancelled event." };
  }

  // Re-check conflicts before approving — another event may have been approved
  // in the same slot since this one was submitted (EWL does this check).
  if (event.roomId && event.startDateTime && event.endDateTime) {
    const conflictResult = await checkApprovalConflicts(event);
    if (conflictResult?.hasConflict) {
      return {
        error: `Cannot approve — conflicts detected:\n${conflictResult.conflicts.map((c) => c.message).join("\n")}`,
        conflicts: conflictResult.conflicts,
        alternatives: conflictResult.alternatives,
      };
    }
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { approved: true, status: "APPROVED" },
    }),
    prisma.approvalAction.create({
      data: {
        eventId,
        userId,
        action: "APPROVED",
        comment: comment || "",
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: "EVENT_APPROVED",
        actorEmail: user.email || "",
        details: { comment },
      },
    }),
  ]);

  // Send approval notification to event contact (respects emailUpdates preference)
  if (event.emailUpdates) {
    const mergeData = buildEventMergeData(
      event,
      event.organization,
      event.room?.name || ""
    );
    await sendTemplatedEmail({
      to: event.contactEmail,
      orgId: event.organizationId,
      templateSlug: "event-approved",
      mergeData,
      replyTo: event.organization.emailReplyToAddress || undefined,
    });
  }

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function denyEvent(eventId: string, orgSlug: string, comment?: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true, room: true },
  });
  if (!event) return { error: "Event not found" };

  // Check if user is a designated approver, or fall back to role check
  const { user } = await requireOrgRole(event.organizationId, ["ADMIN", "MANAGER"]);
  if (event.status === "DENIED") return { success: true }; // idempotent
  const userId = user.id;

  // EWL: cannot deny deleted/cancelled events (ApproveOrDeny.cs lines 17-22)
  if (event.deleted || event.status === "CANCELLED") {
    return { error: "Cannot deny a deleted or cancelled event." };
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { approved: false, status: "DENIED" },
    }),
    prisma.approvalAction.create({
      data: {
        eventId,
        userId,
        action: "DENIED",
        comment: comment || "",
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: "EVENT_DENIED",
        actorEmail: user.email || "",
        details: { comment },
      },
    }),
  ]);

  // Send denial notification to event contact (respects emailUpdates preference)
  if (event.emailUpdates) {
    const mergeDataDeny = buildEventMergeData(
      event,
      event.organization,
      event.room?.name || ""
    );
    mergeDataDeny.denialComment = comment || "";
    await sendTemplatedEmail({
      to: event.contactEmail,
      orgId: event.organizationId,
      templateSlug: "event-denied",
      mergeData: mergeDataDeny,
      replyTo: event.organization.emailReplyToAddress || undefined,
    });
  }

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function bulkApproveEvents(
  eventIds: string[],
  orgSlug: string
): Promise<{ results: { eventId: string; success: boolean; error?: string }[] }> {
  const results: { eventId: string; success: boolean; error?: string }[] = [];
  for (const eventId of eventIds) {
    const result = await approveEvent(eventId, orgSlug);
    results.push({
      eventId,
      success: !!result.success,
      error: result.error,
    });
  }
  return { results };
}

export async function bulkDenyEvents(
  eventIds: string[],
  orgSlug: string,
  comment?: string
): Promise<{ results: { eventId: string; success: boolean; error?: string }[] }> {
  const results: { eventId: string; success: boolean; error?: string }[] = [];
  for (const eventId of eventIds) {
    const result = await denyEvent(eventId, orgSlug, comment);
    results.push({
      eventId,
      success: !!result.success,
      error: result.error,
    });
  }
  return { results };
}

export async function deleteEvent(eventId: string, orgSlug: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true },
  });
  if (!event) return { error: "Event not found" };

  const session = await getSession();
  if (!session?.user) return { error: "Not authenticated" };

  // Allow the submitter or an admin/manager to delete
  const userId = (session.user as { id: string }).id;
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: event.organizationId, userId },
  });
  const isAdminRole = membership?.role === "ADMIN" || membership?.role === "MANAGER";

  // EWL: Support staff can modify events starting within 24 hours
  const isSupportStaff = membership?.role === "EVENT_SUPPORT";
  let isInSupportWindow = false;
  if (isSupportStaff) {
    const supportStaffWindowMs = 24 * 60 * 60 * 1000;
    if (event.recurrenceRule) {
      // For recurring events, check if any instance starts within 24h
      const soonInstance = await prisma.eventInstance.findFirst({
        where: {
          eventId: event.id,
          deleted: false,
          startDateTime: { gt: new Date(), lte: new Date(Date.now() + supportStaffWindowMs) },
        },
      });
      isInSupportWindow = !!soonInstance;
    } else if (event.startDateTime) {
      isInSupportWindow =
        event.startDateTime.getTime() > Date.now() &&
        event.startDateTime.getTime() <= Date.now() + supportStaffWindowMs;
    }
  }

  const isAdmin = isAdminRole || isInSupportWindow ? membership : null;

  if (event.submitterId !== userId && !isAdmin) {
    return { error: "You do not have permission to delete this event." };
  }

  // EWL: cannot delete an already-deleted event (Details.cs line 45)
  if (event.deleted || event.status === "CANCELLED") {
    return { error: "This event has already been deleted." };
  }

  const org = event.organization;

  // EWL: non-admins cannot modify events when allowsEventChanges is false
  if (!org.allowsEventChanges && !isAdmin) {
    return { error: "Event changes are not allowed for this organization." };
  }

  // EWL: non-admins cannot delete past events (DeleteEvent.cs line 43)
  if (!isAdmin && event.startDateTime && event.startDateTime < new Date()) {
    return { error: "Past events cannot be deleted. Please contact an administrator." };
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { deleted: true, status: "CANCELLED" },
    }),
    // Soft-delete all recurring instances so they don't block conflict detection
    prisma.eventInstance.updateMany({
      where: { eventId },
      data: { deleted: true },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: "EVENT_DELETED",
        actorEmail: session.user?.email || "",
      },
    }),
  ]);

  // Send cancellation notification to the event contact (EWL "Event Deleted" email).
  // Skip if the person deleting IS the contact (they know what they did).
  if (event.contactEmail && session.user?.email !== event.contactEmail) {
    const roomName = event.roomId
      ? (await prisma.room.findUnique({ where: { id: event.roomId } }))?.name || ""
      : "";
    const mergeData = buildEventMergeData(
      {
        id: eventId,
        title: event.title,
        contactName: event.contactName,
        contactEmail: event.contactEmail,
        startDateTime: event.startDateTime!,
        endDateTime: event.endDateTime!,
        status: "CANCELLED",
      },
      org,
      roomName
    );
    if (event.emailUpdates) {
      await sendTemplatedEmail({
        to: event.contactEmail,
        orgId: org.id,
        templateSlug: "event-deleted",
        mergeData,
        replyTo: org.emailReplyToAddress || undefined,
      });
    }
  }

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function adminUpdateEventStatus(
  eventId: string,
  orgSlug: string,
  status: "APPROVED" | "PENDING" | "DENIED" | "CANCELLED"
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true, room: true, instances: true },
  });
  if (!event) return { error: "Event not found" };
  const { user } = await requireOrgRole(event.organizationId, ["ADMIN", "MANAGER"]);

  // EWL: cannot modify deleted events
  if (event.deleted && status !== "CANCELLED") {
    return { error: "Cannot change status of a deleted event." };
  }

  // Re-check conflicts before approving via status change
  if (status === "APPROVED" && event.status !== "APPROVED" && event.roomId && event.startDateTime && event.endDateTime) {
    const conflictResult = await checkApprovalConflicts(event);
    if (conflictResult?.hasConflict) {
      return {
        error: `Cannot approve — conflicts detected:\n${conflictResult.conflicts.map((c) => c.message).join("\n")}`,
        conflicts: conflictResult.conflicts,
        alternatives: conflictResult.alternatives,
      };
    }
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: {
        status,
        approved: status === "APPROVED",
        ...(status === "CANCELLED" ? { deleted: true } : {}),
      },
    }),
    // Soft-delete recurring instances when cancelling so they don't block conflict detection
    ...(status === "CANCELLED"
      ? [prisma.eventInstance.updateMany({ where: { eventId }, data: { deleted: true } })]
      : []),
    prisma.approvalAction.create({
      data: {
        eventId,
        userId: user.id,
        action: status === "APPROVED" ? "APPROVED" : status === "DENIED" ? "DENIED" : "CHANGED",
        comment: `Status changed to ${status}`,
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: `STATUS_CHANGED_TO_${status}`,
        actorEmail: user.email || "",
      },
    }),
  ]);

  // Send status notification email to event contact (EWL sends for all status changes).
  // Skip if no contact email or if the status didn't meaningfully change.
  const org = event.organization;
  if (event.contactEmail && status !== event.status) {
    const roomName = event.room?.name || "";
    const mergeData = buildEventMergeData(event, org, roomName);

    let templateSlug: string | null = null;
    if (status === "APPROVED") {
      templateSlug = "event-approved";
    } else if (status === "DENIED") {
      mergeData.denialComment = `Status changed to ${status}`;
      templateSlug = "event-denied";
    } else if (status === "CANCELLED") {
      templateSlug = "event-deleted";
    }

    if (templateSlug && event.emailUpdates) {
      await sendTemplatedEmail({
        to: event.contactEmail,
        orgId: org.id,
        templateSlug,
        mergeData,
        replyTo: org.emailReplyToAddress || undefined,
      });
    }
  }

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);
  revalidatePath(`/${orgSlug}/events/${eventId}`);

  return { success: true };
}

// ============================================================
// APPROVAL CONFLICT CHECK (shared by approveEvent + adminUpdateEventStatus)
// ============================================================

/**
 * Re-checks for conflicts before approving an event.
 * Handles both single and recurring events.
 */
async function checkApprovalConflicts(
  event: {
    id: string;
    organizationId: string;
    roomId: string | null;
    roomConfigurationId: string | null;
    startDateTime: Date | null;
    endDateTime: Date | null;
    recurrenceRule: string | null;
    recurrenceEndDate: Date | null;
    organization: { timezone?: string | null };
    instances?: { startDateTime: Date; endDateTime: Date; deleted: boolean }[];
  }
) {
  if (!event.roomId || !event.startDateTime || !event.endDateTime) return null;

  // For recurring events, check each instance individually
  if (event.recurrenceRule && event.instances && event.instances.length > 0) {
    const activeInstances = event.instances
      .filter((i) => !i.deleted)
      .map((i) => ({ startDateTime: i.startDateTime, endDateTime: i.endDateTime }));

    if (activeInstances.length > 0) {
      return detectRecurrenceConflicts({
        orgId: event.organizationId,
        roomId: event.roomId,
        roomConfigurationId: event.roomConfigurationId,
        instances: activeInstances,
        excludeEventIds: [event.id],
        timezone: event.organization.timezone || undefined,
      });
    }
  }

  // Single event
  return detectConflicts({
    orgId: event.organizationId,
    roomId: event.roomId,
    roomConfigurationId: event.roomConfigurationId,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    excludeEventIds: [event.id],
    timezone: event.organization.timezone || undefined,
  });
}

// ============================================================
// TIMEZONE HELPERS
// ============================================================

/** Extract hours and minutes in a specific timezone */
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

/** Get midnight of the date in a specific timezone, as a UTC Date for comparison.
 *  Uses UTC midnight to avoid DST off-by-one errors in day-difference calculations. */
function getDateInTimezone(date: Date, timezone?: string | null): Date {
  const tz = timezone || undefined;
  const dateStr = date.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {}); // en-CA gives YYYY-MM-DD
  return new Date(dateStr + "T00:00:00Z");
}
