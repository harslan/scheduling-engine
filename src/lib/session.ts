import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: (session.user as { id: string }).id },
  });
  if (!user || !user.active) {
    redirect("/login");
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
    redirect("/login");
  }
  return { user, membership };
}
