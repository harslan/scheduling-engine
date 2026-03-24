"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateEventSchema = z.object({
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

  // Conflict detection for room changes
  if (data.roomId) {
    const room = await prisma.room.findUnique({ where: { id: data.roomId } });
    if (!room) return { error: "Room not found" };

    const overlapping = await prisma.event.count({
      where: {
        roomId: data.roomId,
        deleted: false,
        status: { in: ["APPROVED", "PENDING"] },
        id: { not: eventId },
        startDateTime: { lt: endDt },
        endDateTime: { gt: startDt },
      },
    });

    if (overlapping >= room.concurrentEventLimit) {
      return {
        error: `${room.name} already has ${overlapping} event(s) during this time.`,
      };
    }
  }

  const org = event.organization;

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: {
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
      },
    }),
    prisma.eventActivity.create({
      data: {
        eventId,
        action: "EVENT_UPDATED",
        actorEmail: session.user?.email || "",
        details: { title: data.title },
      },
    }),
  ]);

  revalidatePath(`/${org.slug}`);
  revalidatePath(`/${org.slug}/events/${eventId}`);
  revalidatePath(`/${org.slug}/my-events`);

  return { success: true };
}
