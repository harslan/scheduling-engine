"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RoomSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1, "Name is required"),
  iconText: z.string().max(4).optional(),
  notes: z.string().optional(),
  active: z.coerce.boolean().optional(),
  managersOnly: z.coerce.boolean().optional(),
  concurrentEventLimit: z.coerce.number().int().min(1).optional(),
  bufferMinutes: z.coerce.number().int().min(0).optional(),
  capacity: z.coerce.number().int().min(1).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().optional(),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createRoom(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = RoomSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) return { error: "Organization not found" };

  const slug = slugify(data.name);

  // Check for duplicate slug
  const existing = await prisma.room.findUnique({
    where: { organizationId_slug: { organizationId: data.organizationId, slug } },
  });
  if (existing) return { error: "A room with this name already exists" };

  // Get max sort order
  const maxSort = await prisma.room.aggregate({
    where: { organizationId: data.organizationId },
    _max: { sortOrder: true },
  });

  await prisma.room.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      slug,
      iconText: data.iconText || data.name.substring(0, 2).toUpperCase(),
      notes: data.notes || "",
      active: data.active ?? true,
      managersOnly: data.managersOnly ?? false,
      concurrentEventLimit: data.concurrentEventLimit ?? 1,
      bufferMinutes: data.bufferMinutes ?? 0,
      capacity: typeof data.capacity === "number" ? data.capacity : null,
      sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/${org.slug}/admin/rooms`);
  revalidatePath(`/${org.slug}/rooms`);
  revalidatePath(`/${org.slug}/submit-event`);

  return { success: true };
}

export async function updateRoom(roomId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = RoomSchema.partial().safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { organization: true },
  });
  if (!room) return { error: "Room not found" };

  const data = parsed.data;

  await prisma.room.update({
    where: { id: roomId },
    data: {
      name: data.name ?? room.name,
      iconText: data.iconText ?? room.iconText,
      notes: data.notes ?? room.notes,
      active: data.active ?? room.active,
      managersOnly: data.managersOnly ?? room.managersOnly,
      concurrentEventLimit: data.concurrentEventLimit ?? room.concurrentEventLimit,
      bufferMinutes: data.bufferMinutes ?? room.bufferMinutes,
      capacity: typeof data.capacity === "number" ? data.capacity : room.capacity,
      sortOrder: data.sortOrder ?? room.sortOrder,
    },
  });

  revalidatePath(`/${room.organization.slug}/admin/rooms`);
  revalidatePath(`/${room.organization.slug}/rooms`);

  return { success: true };
}

export async function deleteRoom(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { organization: true, events: { take: 1 } },
  });
  if (!room) return { error: "Room not found" };

  if (room.events.length > 0) {
    // Soft delete — just deactivate
    await prisma.room.update({
      where: { id: roomId },
      data: { active: false },
    });
  } else {
    await prisma.room.delete({ where: { id: roomId } });
  }

  revalidatePath(`/${room.organization.slug}/admin/rooms`);
  revalidatePath(`/${room.organization.slug}/rooms`);

  return { success: true };
}

export async function toggleRoomActive(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { organization: true },
  });
  if (!room) return { error: "Room not found" };

  await prisma.room.update({
    where: { id: roomId },
    data: { active: !room.active },
  });

  revalidatePath(`/${room.organization.slug}/admin/rooms`);
  revalidatePath(`/${room.organization.slug}/rooms`);

  return { success: true };
}
