"use server";

import { prisma } from "@/lib/prisma";
import { sendTemplatedEmail } from "@/lib/email";
import type { EventMergeData } from "@/lib/email-merge";

/**
 * Get designated approvers for an event.
 * Mirrors EWL's ApprovalStatics.GetActiveApproverIds().
 *
 * Priority:
 *   1. Room-specific approverId (if room has one)
 *   2. Organization approverId
 *   3. Backup approvers (by sortOrder)
 *   4. Fallback: all ADMIN/MANAGER users
 */
export async function getApproversForEvent(
  eventId: string
): Promise<{ userId: string; email: string; name: string }[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      room: true,
      organization: true,
    },
  });

  if (!event) return [];

  const org = event.organization;
  const approverIds: string[] = [];

  // 1. Check room-specific approver
  const roomApproverId = event.room?.approverId;

  // 2. Determine primary approver
  const primaryApproverId = roomApproverId || org.approverId;

  if (primaryApproverId) {
    approverIds.push(primaryApproverId);

    // 3. Add backup approvers
    const backups = await prisma.backupApprover.findMany({
      where: {
        organizationId: org.id,
        approverId: primaryApproverId,
      },
      orderBy: { sortOrder: "asc" },
    });

    for (const backup of backups) {
      approverIds.push(backup.backupUserId);
    }
  }

  // 4. If no designated approvers, fall back to all ADMIN/MANAGER
  if (approverIds.length === 0) {
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: org.id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
      include: { user: true },
    });

    return members
      .filter((m) => m.user.email && m.user.active)
      .map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
      }));
  }

  // Fetch user details for designated approvers
  const users = await prisma.user.findMany({
    where: {
      id: { in: approverIds },
      active: true,
    },
  });

  // Maintain sort order
  return approverIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u && !!u.email)
    .map((u) => ({
      userId: u.id,
      email: u.email,
      name: u.name,
    }));
}

/**
 * Send approval notification to approvers not yet notified.
 * Tracks who was notified in NotifiedApprover table.
 */
export async function notifyApprovers(
  eventId: string,
  orgId: string,
  mergeData: EventMergeData,
  replyTo?: string
) {
  const approvers = await getApproversForEvent(eventId);

  // Check who has already been notified
  const alreadyNotified = await prisma.notifiedApprover.findMany({
    where: {
      organizationId: orgId,
      eventId,
    },
    select: { userId: true },
  });

  const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));
  const toNotify = approvers.filter((a) => !notifiedIds.has(a.userId));

  for (const approver of toNotify) {
    // Use upsert to handle concurrent calls gracefully (unique constraint on org+event+user)
    const { count } = await prisma.notifiedApprover.createMany({
      data: [{
        organizationId: orgId,
        eventId,
        userId: approver.userId,
      }],
      skipDuplicates: true,
    });

    // Only send email if we actually created the record (not a duplicate)
    if (count > 0) {
      await sendTemplatedEmail({
        to: approver.email,
        orgId,
        templateSlug: "approval-required",
        mergeData,
        replyTo,
      });
    }
  }

  return { notified: toNotify.length };
}
