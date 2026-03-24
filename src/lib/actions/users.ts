"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";

const InviteUserSchema = z.object({
  organizationId: z.string(),
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "EVENT_SUPPORT", "USER"]),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

export async function inviteUser(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = InviteUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) return { error: "Organization not found" };

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 12)
      : await bcrypt.hash(Math.random().toString(36).slice(2), 12);

    user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name || "",
        passwordHash,
      },
    });
  }

  // Check if already a member
  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: data.organizationId,
        userId: user.id,
      },
    },
  });
  if (existing) return { error: "User is already a member of this organization" };

  await prisma.organizationMember.create({
    data: {
      organizationId: data.organizationId,
      userId: user.id,
      role: data.role,
    },
  });

  revalidatePath(`/${org.slug}/admin/users`);
  return { success: true };
}

export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: "ADMIN" | "MANAGER" | "EVENT_SUPPORT" | "USER"
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return { error: "Organization not found" };

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    data: { role },
  });

  revalidatePath(`/${org.slug}/admin/users`);
  return { success: true };
}

export async function removeMember(organizationId: string, userId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return { error: "Organization not found" };

  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });

  revalidatePath(`/${org.slug}/admin/users`);
  return { success: true };
}
