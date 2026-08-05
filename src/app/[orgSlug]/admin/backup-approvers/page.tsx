import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { BackupApproversManager } from "./manager";

export default async function BackupApproversPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) redirect("/");

  await requireOrgRole(org.id, ["ADMIN"]);

  // Get all org members who could be approvers
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: org.id },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const memberOptions = members
    .filter((m) => m.user.active)
    .map((m) => ({
      userId: m.userId,
      name: m.user.name || m.user.email,
      email: m.user.email,
      role: m.role,
    }));

  // Get existing backup approvers
  const backupApprovers = await prisma.backupApprover.findMany({
    where: { organizationId: org.id },
    include: { approver: true, backupUser: true },
    orderBy: { sortOrder: "asc" },
  });

  const existingBackups = backupApprovers.map((ba) => ({
    id: ba.id,
    approverId: ba.approverId,
    approverName: ba.approver.name || ba.approver.email,
    backupUserId: ba.backupUserId,
    backupName: ba.backupUser.name || ba.backupUser.email,
    sortOrder: ba.sortOrder,
  }));

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Approver Settings
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Configure the primary event approver and backup approvers for your
        organization. When no approver is set, all admins and managers receive
        approval notifications.
      </p>

      <BackupApproversManager
        orgId={org.id}
        orgSlug={orgSlug}
        primaryApproverId={org.approverId}
        roomAssignmentApproverId={org.roomAssignmentApproverId}
        members={memberOptions}
        backups={existingBackups}
      />
    </div>
  );
}
