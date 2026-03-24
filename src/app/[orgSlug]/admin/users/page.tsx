import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { AddUserForm } from "./add-user-form";
import { UserRow } from "./user-row";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: org.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          isSystemAdmin: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const roleOrder = { ADMIN: 0, MANAGER: 1, EVENT_SUPPORT: 2, USER: 3 };
  const sorted = [...members].sort(
    (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Add User Form */}
      <AddUserForm organizationId={org.id} orgSlug={orgSlug} />

      {/* Members Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <UserRow
                key={member.userId}
                member={{
                  userId: member.userId,
                  role: member.role,
                  userName: member.user.name,
                  userEmail: member.user.email,
                  isSystemAdmin: member.user.isSystemAdmin,
                  active: member.user.active,
                }}
                organizationId={org.id}
                orgSlug={orgSlug}
              />
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No members yet. Invite one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
