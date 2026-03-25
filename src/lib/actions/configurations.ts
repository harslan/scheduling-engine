"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ========================================
// Room Configuration Types (org-level)
// ========================================

const ConfigTypeSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1, "Name is required"),
  imageUrl: z.string().optional(),
});

export async function createConfigurationType(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ConfigTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) return { error: "Organization not found" };

  await prisma.roomConfigurationType.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      imageUrl: data.imageUrl || null,
    },
  });

  revalidatePath(`/${org.slug}/admin/configurations`);
  return { success: true };
}

export async function updateConfigurationType(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const name = raw.name as string;
  const imageUrl = raw.imageUrl as string;

  if (!name?.trim()) return { error: "Name is required" };

  const type = await prisma.roomConfigurationType.findUnique({
    where: { id },
    include: { organization: true },
  });
  if (!type) return { error: "Configuration type not found" };

  await prisma.roomConfigurationType.update({
    where: { id },
    data: { name: name.trim(), imageUrl: imageUrl || null },
  });

  revalidatePath(`/${type.organization.slug}/admin/configurations`);
  return { success: true };
}

export async function deleteConfigurationType(id: string) {
  const type = await prisma.roomConfigurationType.findUnique({
    where: { id },
    include: {
      organization: true,
      configurations: { take: 1 },
      events: { take: 1 },
    },
  });
  if (!type) return { error: "Configuration type not found" };

  if (type.configurations.length > 0 || type.events.length > 0) {
    return { error: "Cannot delete — this type is in use by configurations or events" };
  }

  await prisma.roomConfigurationType.delete({ where: { id } });

  revalidatePath(`/${type.organization.slug}/admin/configurations`);
  return { success: true };
}

// ========================================
// Room Configurations (per room)
// ========================================

const ConfigSchema = z.object({
  roomId: z.string(),
  name: z.string().min(1, "Name is required"),
  configurationTypeId: z.string().optional(),
  concurrentEventLimit: z.coerce.number().int().min(1).optional(),
  imageUrl: z.string().optional(),
});

export async function createRoomConfiguration(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const room = await prisma.room.findUnique({
    where: { id: data.roomId },
    include: { organization: true },
  });
  if (!room) return { error: "Room not found" };

  await prisma.roomConfiguration.create({
    data: {
      roomId: data.roomId,
      name: data.name,
      configurationTypeId: data.configurationTypeId || null,
      concurrentEventLimit: data.concurrentEventLimit ?? 1,
      imageUrl: data.imageUrl || null,
    },
  });

  revalidatePath(`/${room.organization.slug}/admin/rooms`);
  revalidatePath(`/${room.organization.slug}/submit-event`);
  return { success: true };
}

export async function updateRoomConfiguration(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const name = raw.name as string;
  if (!name?.trim()) return { error: "Name is required" };

  const config = await prisma.roomConfiguration.findUnique({
    where: { id },
    include: { room: { include: { organization: true } } },
  });
  if (!config) return { error: "Configuration not found" };

  await prisma.roomConfiguration.update({
    where: { id },
    data: {
      name: name.trim(),
      configurationTypeId: (raw.configurationTypeId as string) || null,
      concurrentEventLimit: parseInt(raw.concurrentEventLimit as string) || 1,
      imageUrl: (raw.imageUrl as string) || null,
    },
  });

  revalidatePath(`/${config.room.organization.slug}/admin/rooms`);
  revalidatePath(`/${config.room.organization.slug}/submit-event`);
  return { success: true };
}

export async function deleteRoomConfiguration(id: string) {
  const config = await prisma.roomConfiguration.findUnique({
    where: { id },
    include: {
      room: { include: { organization: true } },
      events: { take: 1 },
    },
  });
  if (!config) return { error: "Configuration not found" };

  if (config.events.length > 0) {
    return { error: "Cannot delete — this configuration has events" };
  }

  await prisma.roomConfiguration.delete({ where: { id } });

  revalidatePath(`/${config.room.organization.slug}/admin/rooms`);
  revalidatePath(`/${config.room.organization.slug}/submit-event`);
  return { success: true };
}
