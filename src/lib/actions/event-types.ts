"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const EventTypeSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1, "Name is required"),
  colorIndex: z.coerce.number().int().min(0).max(11).optional(),
  iconTextOverride: z.string().max(4).optional(),
});

export async function createEventType(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = EventTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  await requireOrgRole(data.organizationId, ["ADMIN", "MANAGER"]);

  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) return { error: "Organization not found" };

  await prisma.eventType.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      colorIndex: data.colorIndex ?? null,
      iconTextOverride: data.iconTextOverride || "",
    },
  });

  revalidatePath(`/${org.slug}/admin/event-types`);
  revalidatePath(`/${org.slug}/submit-event`);
  return { success: true };
}

export async function updateEventType(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const name = raw.name as string;
  if (!name?.trim()) return { error: "Name is required" };

  const et = await prisma.eventType.findUnique({
    where: { id },
    include: { organization: true },
  });
  if (!et) return { error: "Event type not found" };
  await requireOrgRole(et.organization.id, ["ADMIN", "MANAGER"]);

  await prisma.eventType.update({
    where: { id },
    data: {
      name: name.trim(),
      colorIndex: parseInt(raw.colorIndex as string) || null,
      iconTextOverride: (raw.iconTextOverride as string) || "",
    },
  });

  revalidatePath(`/${et.organization.slug}/admin/event-types`);
  revalidatePath(`/${et.organization.slug}/submit-event`);
  return { success: true };
}

export async function deleteEventType(id: string) {
  const et = await prisma.eventType.findUnique({
    where: { id },
    include: { organization: true, events: { take: 1 } },
  });
  if (!et) return { error: "Event type not found" };
  await requireOrgRole(et.organization.id, ["ADMIN", "MANAGER"]);

  if (et.events.length > 0) {
    return { error: "Cannot delete — this event type has events. Remove events first." };
  }

  await prisma.eventType.delete({ where: { id } });

  revalidatePath(`/${et.organization.slug}/admin/event-types`);
  revalidatePath(`/${et.organization.slug}/submit-event`);
  return { success: true };
}
