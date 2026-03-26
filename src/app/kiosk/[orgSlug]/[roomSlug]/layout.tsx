import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; roomSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, roomSlug } = await params;

  const room = await prisma.room.findFirst({
    where: { organization: { slug: orgSlug }, slug: roomSlug },
    select: {
      name: true,
      organization: { select: { name: true, appDisplayName: true } },
    },
  });

  const orgName = room?.organization.appDisplayName || room?.organization.name || orgSlug;
  const roomName = room?.name || roomSlug;

  return {
    title: `${roomName} — ${orgName} Kiosk`,
    description: `Live status display for ${roomName}`,
    robots: { index: false },
  };
}

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
