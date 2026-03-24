"use server";

import { prisma } from "@/lib/prisma";
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
  const raw = Object.fromEntries(formData.entries());

  const parsed = SubmitEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;

  // Check if org requires approval
  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });

  if (!org) return { error: "Organization not found" };

  const event = await prisma.event.create({
    data: {
      organizationId: data.organizationId,
      title: data.title,
      eventTypeId: data.eventTypeId || null,
      roomId: data.roomId || null,
      startDateTime: new Date(data.startDateTime),
      endDateTime: new Date(data.endDateTime),
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

  return { success: true, eventId: event.id };
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

export async function approveEvent(eventId: string, orgSlug: string) {
  await prisma.event.update({
    where: { id: eventId },
    data: { approved: true, status: "APPROVED" },
  });

  revalidatePath(`/${orgSlug}`);
  return { success: true };
}

export async function denyEvent(eventId: string, orgSlug: string) {
  await prisma.event.update({
    where: { id: eventId },
    data: { approved: false, status: "DENIED" },
  });

  revalidatePath(`/${orgSlug}`);
  return { success: true };
}
