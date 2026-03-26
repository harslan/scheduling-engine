import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function loginRedirect(): Promise<never> {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
  redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
}

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    return await loginRedirect();
  }
  return session;
}

export async function getCurrentUser() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: (session.user as { id: string }).id },
  });
  if (!user || !user.active) {
    return await loginRedirect();
  }
  return user;
}

export async function getOrgMembership(orgId: string) {
  const user = await getCurrentUser();
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: user.id,
      },
    },
  });
  return { user, membership, role: membership?.role ?? null };
}

export async function requireOrgRole(orgId: string, roles: string[]) {
  const { user, membership } = await getOrgMembership(orgId);
  if (!user.isSystemAdmin && (!membership || !roles.includes(membership.role))) {
    return await loginRedirect();
  }
  return { user, membership };
}
