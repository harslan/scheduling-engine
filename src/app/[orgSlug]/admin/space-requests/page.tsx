import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { SpaceRequestsQueue } from "./queue";

export default async function SpaceRequestsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) redirect("/");

  await requireOrgRole(org.id, ["ADMIN", "MANAGER"]);

  const requests = await prisma.roomRequest.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    include: { processedBy: true },
  });

  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { sortOrder: "asc" },
  });

  const requestData = requests.map((r) => ({
    id: r.id,
    description: r.description,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    expectedAttendeeCount: r.expectedAttendeeCount,
    requestedStartDateTime: r.requestedStartDateTime?.toISOString() || null,
    requestedEndDateTime: r.requestedEndDateTime?.toISOString() || null,
    status: r.status as string,
    processedAt: r.processedAt?.toISOString() || null,
    processedByName: r.processedBy?.name || null,
    denialReason: r.denialReason,
    createdAt: r.createdAt.toISOString(),
  }));

  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Space Requests
      </h1>
      <SpaceRequestsQueue
        requests={requestData}
        rooms={roomOptions}
        orgSlug={orgSlug}
        timezone={org.timezone}
      />
    </div>
  );
}
