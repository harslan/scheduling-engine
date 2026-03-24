"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SubmitEventSchema = z.object({
  organizationId: z.string(),
  title: z.string().min(1, "Title is required"),
  eventTypeId: z.string().optional(),
  roomId: z.string().optional(),
  startDateTime: z.string().min(1, "Start date is required"),
  endDateTime: z.string().min(1, "End date is required"),
  expectedAttendeeCount: z.coerce.number().int().positive().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email("Valid email is required"),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
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

    const overlapping = await prisma.event.count({
      where: {
        roomId: data.roomId,
        deleted: false,
        status: { in: ["APPROVED", "PENDING"] },
        startDateTime: { lt: endDt },
        endDateTime: { gt: startDt },
      },
    });

    if (overlapping >= room.concurrentEventLimit) {
      return {
        error: `${room.name} already has ${overlapping} event(s) during this time. Maximum concurrent events: ${room.concurrentEventLimit}.`,
      };
    }
  }

  const event = await prisma.event.create({
    data: {
      organizationId: data.organizationId,
      submitterId: userId,
      title: data.title,
      eventTypeId: data.eventTypeId || null,
      roomId: data.roomId || null,
      startDateTime: startDt,
      endDateTime: endDt,
      expectedAttendeeCount: data.expectedAttendeeCount || null,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || "",
      notes: data.notes || "",
      status: org.requiresApproval ? "PENDING" : "APPROVED",
      approved: !org.requiresApproval,
    },
  });

  // Log activity
  await prisma.eventActivity.create({
    data: {
      eventId: event.id,
      action: "EVENT_SUBMITTED",
      actorEmail: data.contactEmail,
      details: { title: data.title },
    },
  });

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
    include: { organization: true },
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

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);
  revalidatePath(`/${orgSlug}/my-events`);

  return { success: true };
}

export async function denyEvent(eventId: string, orgSlug: string, comment?: string) {
  const session = await getSession();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return { error: "Not authenticated" };

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
        actorEmail: "",
        details: { comment },
      },
    }),
  ]);

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
