import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();

  // Must be authenticated
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${orgSlug}/admin`);
  }

  const userId = (session.user as { id: string }).id;

  const [org, user] = await Promise.all([
    prisma.organization.findUnique({ where: { slug: orgSlug } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!org) notFound();

  // System admins always have access
  if (user?.isSystemAdmin) {
    return <>{children}</>;
  }

  // Check org membership role
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId,
      },
    },
  });

  if (!membership || !["ADMIN", "MANAGER"].includes(membership.role)) {
    redirect(`/${orgSlug}`);
  }

  return <>{children}</>;
}
