"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateOrgSchema = z.object({
  name: z.string().min(1, "Name is required"),
  shortName: z.string().min(1, "Short name is required"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  appDisplayName: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
  adminEmail: z.string().email("Valid admin email is required"),
  adminName: z.string().min(1, "Admin name is required"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
});

async function requireSystemAdmin() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isSystemAdmin) throw new Error("Unauthorized");
  return user;
}

export async function createOrganization(formData: FormData) {
  await requireSystemAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateOrgSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  // Check slug uniqueness
  const existing = await prisma.organization.findUnique({
    where: { slug: data.slug },
  });
  if (existing) {
    return { error: `Slug "${data.slug}" is already taken` };
  }

  // Create org + admin user in a transaction
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(data.adminPassword, 10);

  const org = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        appDisplayName: data.appDisplayName || "",
        timezone: data.timezone,
      },
    });

    // Find or create the admin user
    let adminUser = await tx.user.findUnique({
      where: { email: data.adminEmail },
    });

    if (adminUser) {
      // User exists — just add them as admin of this org
    } else {
      adminUser = await tx.user.create({
        data: {
          email: data.adminEmail,
          name: data.adminName,
          passwordHash,
        },
      });
    }

    // Add as org admin
    await tx.organizationMember.create({
      data: {
        organizationId: newOrg.id,
        userId: adminUser.id,
        role: "ADMIN",
      },
    });

    return newOrg;
  });

  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true, slug: org.slug };
}

export async function deleteOrganization(orgId: string) {
  await requireSystemAdmin();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (!org) return { error: "Organization not found" };

  // Delete all related data in order
  await prisma.$transaction([
    prisma.reserveWebhookEvent.deleteMany({ where: { organizationId: orgId } }),
    prisma.reserveSyncLog.deleteMany({ where: { organizationId: orgId } }),
    prisma.reserveEvent.deleteMany({ where: { organizationId: orgId } }),
    prisma.reserveContact.deleteMany({ where: { organizationId: orgId } }),
    prisma.reserveAccount.deleteMany({ where: { organizationId: orgId } }),
    prisma.organizationEmailTemplate.deleteMany({ where: { organizationId: orgId } }),
    prisma.organizationCalendarView.deleteMany({ where: { organizationId: orgId } }),
    prisma.eventInstance.deleteMany({ where: { event: { organizationId: orgId } } }),
    prisma.event.deleteMany({ where: { organizationId: orgId } }),
    prisma.eventType.deleteMany({ where: { organizationId: orgId } }),
    prisma.eventOrganization.deleteMany({ where: { organizationId: orgId } }),
    prisma.roomConfigurationType.deleteMany({ where: { organizationId: orgId } }),
    prisma.room.deleteMany({ where: { organizationId: orgId } }),
    prisma.contentPage.deleteMany({ where: { organizationId: orgId } }),
    prisma.organizationMember.deleteMany({ where: { organizationId: orgId } }),
    prisma.organization.delete({ where: { id: orgId } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}
