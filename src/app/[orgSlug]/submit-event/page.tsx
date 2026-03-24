import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SubmitEventForm } from "./form";
import { getCurrentUser } from "@/lib/session";

export default async function SubmitEventPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await getCurrentUser();

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      rooms: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
      eventTypes: { orderBy: { name: "asc" } },
    },
  });

  if (!org) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Submit {org.eventSingularTerm}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Fill out the form below to request a {org.roomTerm.toLowerCase()}{" "}
        booking.
      </p>

      <SubmitEventForm
        organizationId={org.id}
        orgSlug={orgSlug}
        rooms={org.rooms.map((r) => ({ id: r.id, name: r.name }))}
        eventTypes={org.eventTypes.map((t) => ({ id: t.id, name: t.name }))}
        requiresApproval={org.requiresApproval}
        defaultContactName={user.name}
        defaultContactEmail={user.email}
      />
    </div>
  );
}
