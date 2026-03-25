import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Users, Search } from "lucide-react";
import { AddUserForm } from "./add-user-form";
import { UserRow } from "./user-row";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgSlug } = await params;
  const { q: searchQuery } = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const userFilter = searchQuery
    ? {
        user: {
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" as const } },
            { email: { contains: searchQuery, mode: "insensitive" as const } },
          ],
        },
      }
    : {};

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: org.id, ...userFilter },
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={searchQuery || ""}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          <button type="submit" className="sr-only">Search</button>
        </div>
      </form>

      {/* Add User Form */}
      <AddUserForm organizationId={org.id} orgSlug={orgSlug} />

      {/* Mobile: User Cards */}
      <div className="md:hidden space-y-3">
        {members.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No members yet. Invite one above.</p>
          </div>
        )}
        {sorted.map((member) => (
          <UserRow
            key={`mobile-${member.userId}`}
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
            mobileMode
          />
        ))}
      </div>

      {/* Desktop: Members Table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
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
