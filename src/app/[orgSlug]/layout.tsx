import Link from "next/link";
import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { Sidebar } from "./sidebar";

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
        <div className="flex items-center gap-3">
          {/* Spacer for mobile hamburger button */}
          <div className="w-8 lg:hidden" />
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
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
              <SignOutButton />
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
