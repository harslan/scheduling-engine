"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { format } from "date-fns";
import {
  sendEmail,
  eventSubmittedEmail,
  eventApprovedEmail,
  eventDeniedEmail,
  approvalRequestEmail,
} from "@/lib/email";
import { generateInstances } from "@/lib/recurrence";

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

  const parsed = SubmitEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;
  const startDt = new Date(data.startDateTime);
  const endDt = new Date(data.endDateTime);

  // Validate start < end
  if (startDt >= endDt) {
    return { error: "End time must be after start time" };
  }

  // Check if org requires approval
  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });

  if (!org) return { error: "Organization not found" };

  // Room conflict detection
  if (data.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room) return { error: "Room not found" };

    // Include buffer time in conflict window
    const bufferMs = (room.bufferMinutes || 0) * 60 * 1000;
    const conflictStart = new Date(startDt.getTime() - bufferMs);
    const conflictEnd = new Date(endDt.getTime() + bufferMs);

    const overlapping = await prisma.event.count({
      where: {
        roomId: data.roomId,
        deleted: false,
        status: { in: ["APPROVED", "PENDING"] },
        startDateTime: { lt: conflictEnd },
        endDateTime: { gt: conflictStart },
      },
    });

    if (overlapping >= room.concurrentEventLimit) {
      const bufferNote = room.bufferMinutes > 0
        ? ` (includes ${room.bufferMinutes}-minute buffer between events)`
        : "";
      return {
        error: `${room.name} already has ${overlapping} event(s) during this time. Maximum concurrent events: ${room.concurrentEventLimit}.${bufferNote}`,
      };
    }
  }

  const hasRecurrence = data.recurrenceRule && data.recurrenceRule.length > 0 && data.recurrenceEndDate;
  const recEndDate = data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null;

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
      status: org.requiresApproval ? "PENDING" : "APPROVED",
      approved: !org.requiresApproval,
    },
  });

  // Generate recurring instances
  if (hasRecurrence && recEndDate) {
    const instances = generateInstances(startDt, endDt, data.recurrenceRule!, recEndDate);
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

  // Get room name for emails
  let roomName = "";
  if (data.roomId) {
    const r = await prisma.room.findUnique({ where: { id: data.roomId } });
    roomName = r?.name || "";
  }

  const formattedDate = format(startDt, "EEEE, MMMM d, yyyy 'at' h:mm a");
  const status = org.requiresApproval ? "PENDING" : "APPROVED";

  // Send confirmation email to submitter
  const submittedEmail = eventSubmittedEmail({
    orgName: org.name,
    eventTitle: data.title,
    roomName,
    startDate: formattedDate,
    status,
  });
  await sendEmail({ to: data.contactEmail, ...submittedEmail });

  // If approval required, notify managers/admins
  if (org.requiresApproval) {
    const approvers = await prisma.organizationMember.findMany({
      where: {
        organizationId: org.id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
      include: { user: true },
    });

    const approvalUrl = `${process.env.NEXTAUTH_URL || ""}/${org.slug}/admin/approvals`;

    for (const member of approvers) {
      if (member.user.email) {
        const reqEmail = approvalRequestEmail({
          orgName: org.name,
          eventTitle: data.title,
          submitterName: data.contactName,
          roomName,
          startDate: formattedDate,
          approvalUrl,
        });
        await sendEmail({ to: member.user.email, ...reqEmail });
      }
    }
  }

  revalidatePath(`/${org.slug}`);
  revalidatePath(`/${org.slug}/my-events`);
  revalidatePath(`/${org.slug}/admin/approvals`);

  return { success: true, eventId: event.id };
}

export async function approveEvent(eventId: string, orgSlug: string, comment?: string) {
  const session = await getSession();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return { error: "Not authenticated" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true, room: true },
  });
  if (!event) return { error: "Event not found" };

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
        actorEmail: session?.user?.email || "",
        details: { comment },
      },
    }),
  ]);

  // Send approval notification to event contact
  const approvedEmail = eventApprovedEmail({
    orgName: event.organization.name,
    eventTitle: event.title,
    roomName: event.room?.name || "",
    startDate: event.startDateTime ? format(event.startDateTime, "EEEE, MMMM d, yyyy 'at' h:mm a") : "TBD",
  });
  await sendEmail({ to: event.contactEmail, ...approvedEmail });

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function denyEvent(eventId: string, orgSlug: string, comment?: string) {
  const session = await getSession();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return { error: "Not authenticated" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true },
  });
  if (!event) return { error: "Event not found" };

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
        actorEmail: session?.user?.email || "",
        details: { comment },
      },
    }),
  ]);

  // Send denial notification to event contact
  const deniedEmail = eventDeniedEmail({
    orgName: event.organization.name,
    eventTitle: event.title,
    comment,
  });
  await sendEmail({ to: event.contactEmail, ...deniedEmail });

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function deleteEvent(eventId: string, orgSlug: string) {
  await prisma.event.update({
    where: { id: eventId },
    data: { deleted: true, status: "CANCELLED" },
  });

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function adminUpdateEventStatus(
  eventId: string,
  orgSlug: string,
  status: "APPROVED" | "PENDING" | "DENIED" | "CANCELLED"
) {
  const session = await getSession();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return { error: "Not authenticated" };

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: {
        status,
        approved: status === "APPROVED",
      },
    }),
    prisma.approvalAction.create({
      data: {
        eventId,
        userId,
        action: status === "APPROVED" ? "APPROVED" : status === "DENIED" ? "DENIED" : "CHANGED",
        comment: `Status changed to ${status}`,
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: `STATUS_CHANGED_TO_${status}`,
        actorEmail: session?.user?.email || "",
      },
    }),
  ]);

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);
  revalidatePath(`/${orgSlug}/events/${eventId}`);

  return { success: true };
}
