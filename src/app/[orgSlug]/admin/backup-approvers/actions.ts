"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function updateApproverSettings(
  orgId: string,
  orgSlug: string,
  data: {
    approverId: string | null;
    roomAssignmentApproverId: string | null;
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireOrgRole(orgId, ["ADMIN"]);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { approverId: true, roomAssignmentApproverId: true },
    });
    if (!org) return { error: "Organization not found" };

    // EWL cascade rule: when primary approver changes, delete orphaned backup approvers.
    // Backups are linked to a specific primary approver ID — changing the primary
    // makes old backups irrelevant and confusing in the admin UI.
    await prisma.$transaction(async (tx) => {
      if (org.approverId && data.approverId !== org.approverId) {
        await tx.backupApprover.deleteMany({
          where: { organizationId: orgId, approverId: org.approverId },
        });
      }

      if (
        org.roomAssignmentApproverId &&
        data.roomAssignmentApproverId !== org.roomAssignmentApproverId
      ) {
        await tx.backupApprover.deleteMany({
          where: {
            organizationId: orgId,
            approverId: org.roomAssignmentApproverId,
          },
        });
      }

      await tx.organization.update({
        where: { id: orgId },
        data: {
          approverId: data.approverId,
          roomAssignmentApproverId: data.roomAssignmentApproverId,
        },
      });
    });

    revalidatePath(`/${orgSlug}/admin/backup-approvers`);
    return { success: true };
  } catch {
    return { error: "Failed to update approver settings" };
  }
}

export async function addBackupApprover(
  orgId: string,
  orgSlug: string,
  data: {
    approverId: string;
    backupUserId: string;
    sortOrder: number;
  }
) {
  await requireOrgRole(orgId, ["ADMIN"]);

  await prisma.backupApprover.create({
    data: {
      organizationId: orgId,
      approverId: data.approverId,
      backupUserId: data.backupUserId,
      sortOrder: data.sortOrder,
    },
  });

  revalidatePath(`/${orgSlug}/admin/backup-approvers`);
  return { success: true };
}

export async function removeBackupApprover(id: string, orgSlug: string) {
  const backup = await prisma.backupApprover.findUnique({ where: { id } });
  if (!backup) return { error: "Not found" };

  await requireOrgRole(backup.organizationId, ["ADMIN"]);

  await prisma.backupApprover.delete({ where: { id } });
  revalidatePath(`/${orgSlug}/admin/backup-approvers`);
  return { success: true };
}

export async function reorderBackupApprover(
  id: string,
  orgSlug: string,
  direction: "up" | "down"
) {
  const current = await prisma.backupApprover.findUnique({ where: { id } });
  if (!current) return { error: "Not found" };

  await requireOrgRole(current.organizationId, ["ADMIN"]);

  const siblings = await prisma.backupApprover.findMany({
    where: {
      organizationId: current.organizationId,
      approverId: current.approverId,
    },
    orderBy: { sortOrder: "asc" },
  });

  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return { success: true };

  // Swap sort orders
  await prisma.$transaction([
    prisma.backupApprover.update({
      where: { id: siblings[idx].id },
      data: { sortOrder: siblings[swapIdx].sortOrder },
    }),
    prisma.backupApprover.update({
      where: { id: siblings[swapIdx].id },
      data: { sortOrder: siblings[idx].sortOrder },
    }),
  ]);

  revalidatePath(`/${orgSlug}/admin/backup-approvers`);
  return { success: true };
}
