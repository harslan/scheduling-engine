import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SubmitEventForm } from "./form";
import { getSession } from "@/lib/session";

export default async function SubmitEventPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      rooms: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          configurations: {
            include: { configurationType: true },
          },
        },
      },
      eventTypes: { orderBy: { name: "asc" } },
    },
  });

  if (!org) notFound();

  // Get user info if authenticated
  let userName = "";
  let userEmail = "";
  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    userName = user?.name || "";
    userEmail = user?.email || "";
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Submit {org.eventSingularTerm}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Fill out the form below to request a {org.roomTerm.toLowerCase()}{" "}
        booking.
      </p>

      {!session?.user && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 text-sm text-blue-700">
          You&apos;re submitting as a guest. <a href={`/login?callbackUrl=/${orgSlug}/submit-event`} className="font-medium underline">Sign in</a> to track your events.
        </div>
      )}

      <SubmitEventForm
        organizationId={org.id}
        orgSlug={orgSlug}
        rooms={org.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          configurations: r.configurations.map((c) => ({
            id: c.id,
            name: c.name,
            typeName: c.configurationType?.name || null,
          })),
        }))}
        eventTypes={org.eventTypes.map((t) => ({ id: t.id, name: t.name }))}
        requiresApproval={org.requiresApproval}
        defaultContactName={userName}
        defaultContactEmail={userEmail}
      />
    </div>
  );
}
