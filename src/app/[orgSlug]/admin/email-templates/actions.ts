"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function updateEmailTemplate(
  orgId: string,
  emailTemplateId: string,
  orgSlug: string,
  data: {
    subject: string;
    bodyHtml: string;
    active: boolean;
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireOrgRole(orgId, ["ADMIN"]);

    await prisma.organizationEmailTemplate.upsert({
      where: {
        organizationId_emailTemplateId: {
          organizationId: orgId,
          emailTemplateId,
        },
      },
      update: {
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        active: data.active,
      },
      create: {
        organizationId: orgId,
        emailTemplateId,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        active: data.active,
      },
    });

    revalidatePath(`/${orgSlug}/admin/email-templates`);
    return { success: true };
  } catch {
    return { error: "Failed to update email template" };
  }
}

export async function resetEmailTemplate(
  orgId: string,
  emailTemplateId: string,
  orgSlug: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireOrgRole(orgId, ["ADMIN"]);

    await prisma.organizationEmailTemplate.deleteMany({
      where: {
        organizationId: orgId,
        emailTemplateId,
      },
    });

    revalidatePath(`/${orgSlug}/admin/email-templates`);
    return { success: true };
  } catch {
    return { error: "Failed to reset email template" };
  }
}
