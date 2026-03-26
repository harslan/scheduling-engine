import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { notFound } from "next/navigation";
import { QRCodeGrid } from "./qr-grid";

export default async function QRCodesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  await requireOrgRole(org.id, ["ADMIN"]);

  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, iconText: true, capacity: true },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
          QR Codes
        </h1>
        <p className="text-sm text-slate-500">
          Print and post these on room doors. Anyone can scan to see availability and book instantly.
        </p>
      </div>

      <QRCodeGrid rooms={rooms} orgSlug={orgSlug} orgName={org.appDisplayName || org.name} />
    </div>
  );
}
