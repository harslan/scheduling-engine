import Link from "next/link";
import {
  Calendar,
  CalendarPlus,
  List,
  Info,
  HelpCircle,
  Settings,
  Users,
  Building2,
  LogOut,
  Shield,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  // Get user's role in this org
  let role: string | null = null;
  let isSystemAdmin = false;
  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    isSystemAdmin = user?.isSystemAdmin ?? false;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId,
        },
      },
    });
    role = membership?.role ?? null;
  }

  const isAdmin = isSystemAdmin || role === "ADMIN";
  const isManager = isAdmin || role === "MANAGER";
  const userName = session?.user?.name || session?.user?.email || "User";
  const userEmail = session?.user?.email || "";

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <Link
            href={`/${orgSlug}`}
            className="text-lg font-bold text-slate-900 hover:text-primary transition-colors"
          >
            {org.appDisplayName || org.name}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">{userName}</p>
            {userName !== userEmail && (
              <p className="text-xs text-slate-400">{userEmail}</p>
            )}
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 bg-white border-r border-slate-200 py-4 overflow-y-auto shrink-0">
          <div className="px-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Calendar
            </p>
            <NavLink href={`/${orgSlug}`} icon={<Calendar className="w-4 h-4" />}>
              Calendar
            </NavLink>
            <NavLink
              href={`/${orgSlug}/submit-event`}
              icon={<CalendarPlus className="w-4 h-4" />}
            >
              Submit {org.eventSingularTerm}
            </NavLink>
            <NavLink
              href={`/${orgSlug}/my-events`}
              icon={<List className="w-4 h-4" />}
            >
              My {org.eventPluralTerm}
            </NavLink>
            <NavLink
              href={`/${orgSlug}/rooms`}
              icon={<Info className="w-4 h-4" />}
            >
              {org.roomTerm} Information
            </NavLink>
            <NavLink
              href={`/${orgSlug}/help`}
              icon={<HelpCircle className="w-4 h-4" />}
            >
              Help
            </NavLink>
          </div>

          {isManager && (
            <div className="px-4 mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Management
              </p>
              <NavLink
                href={`/${orgSlug}/admin/approvals`}
                icon={<Shield className="w-4 h-4" />}
              >
                Approvals
              </NavLink>
            </div>
          )}

          {isAdmin && (
            <div className="px-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Administration
              </p>
              <NavLink
                href={`/${orgSlug}/admin`}
                icon={<Settings className="w-4 h-4" />}
              >
                Settings
              </NavLink>
              <NavLink
                href={`/${orgSlug}/admin/rooms`}
                icon={<Building2 className="w-4 h-4" />}
              >
                Manage {org.roomTerm}s
              </NavLink>
              <NavLink
                href={`/${orgSlug}/admin/users`}
                icon={<Users className="w-4 h-4" />}
              >
                Users
              </NavLink>
            </div>
          )}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-primary/5 hover:text-primary transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
