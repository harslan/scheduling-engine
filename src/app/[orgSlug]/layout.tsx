import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { Sidebar } from "./sidebar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { name: true, appDisplayName: true },
  });

  const orgName = org?.appDisplayName || org?.name || orgSlug;
  return {
    title: {
      default: orgName,
      template: `%s — ${orgName}`,
    },
    description: `${orgName} scheduling and room booking`,
    openGraph: {
      title: orgName,
      description: `${orgName} scheduling and room booking`,
    },
  };
}

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
  const isAuthenticated = !!session?.user;

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
  const userName = session?.user?.name || session?.user?.email || "";
  const userEmail = session?.user?.email || "";

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Spacer for mobile hamburger button */}
          <div className="w-8 lg:hidden shrink-0" />

          {/* Logo → links to home */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 group"
            title="Back to Scheduling Engine home"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:shadow-primary/20 transition-all">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="hidden xl:inline text-sm font-semibold text-slate-400 group-hover:text-primary transition-colors">
              Scheduling Engine
            </span>
          </Link>

          {/* Breadcrumb separator */}
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />

          {/* Org name → links to org calendar */}
          <Link
            href={`/${orgSlug}`}
            className="text-lg font-bold text-slate-900 hover:text-primary transition-colors truncate"
          >
            {org.appDisplayName || org.name}
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          {isAuthenticated ? (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-700">{userName}</p>
                {userName !== userEmail && (
                  <p className="text-xs text-slate-400">{userEmail}</p>
                )}
              </div>
              <SignOutButton orgSlug={orgSlug} />
            </>
          ) : (
            <Link
              href={`/login?callbackUrl=/${orgSlug}`}
              className="text-sm font-medium bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          orgSlug={orgSlug}
          org={{
            eventSingularTerm: org.eventSingularTerm,
            eventPluralTerm: org.eventPluralTerm,
            roomTerm: org.roomTerm,
          }}
          isManager={isManager}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
