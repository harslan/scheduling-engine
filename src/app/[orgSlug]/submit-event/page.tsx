import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SubmitEventForm } from "./form";
import { getSession } from "@/lib/session";

export default async function SubmitEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const query = await searchParams;
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
  let isAdminOrManager = false;
  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    userName = user?.name || "";
    userEmail = user?.email || "";
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId } },
    });
    isAdminOrManager = membership?.role === "ADMIN" || membership?.role === "MANAGER";
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
        Submit {org.eventSingularTerm}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Fill out the form below to request a {org.roomTerm.toLowerCase()}{" "}
        booking.
      </p>

      {!session?.user && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-700">
          You&apos;re submitting as a guest. <Link href={`/login?callbackUrl=/${orgSlug}/submit-event`} className="font-medium underline">Sign in</Link> to track your events.
        </div>
      )}

      <SubmitEventForm
        organizationId={org.id}
        orgSlug={orgSlug}
        defaultValues={{
          title: typeof query.title === "string" ? query.title : undefined,
          eventTypeId: typeof query.eventTypeId === "string" ? query.eventTypeId : undefined,
          roomId: typeof query.roomId === "string" ? query.roomId : undefined,
          description: typeof query.description === "string" ? query.description : undefined,
          expectedAttendeeCount: typeof query.expectedAttendeeCount === "string" ? query.expectedAttendeeCount : undefined,
          websiteUrl: typeof query.websiteUrl === "string" ? query.websiteUrl : undefined,
          contactPhone: typeof query.contactPhone === "string" ? query.contactPhone : undefined,
          notes: typeof query.notes === "string" ? query.notes : undefined,
        }}
        rooms={org.allowsRoomSelection ? org.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          configurations: r.configurations.map((c) => ({
            id: c.id,
            name: c.name,
            typeName: c.configurationType?.name || null,
          })),
        })) : []}
        eventTypes={org.eventTypes.map((t) => ({ id: t.id, name: t.name }))}
        requiresApproval={org.requiresApproval}
        defaultContactName={userName}
        defaultContactEmail={userEmail}
        isAdminOrManager={isAdminOrManager}
        orgSettings={{
          collectsAttendeeCount: org.collectsAttendeeCount,
          collectsContactPhone: org.collectsContactPhone,
          roomOpeningTime: org.roomOpeningTime,
          roomClosingTime: org.roomClosingTime,
          roomTerm: org.roomTerm,
          eventSingularTerm: org.eventSingularTerm,
          eventPluralTerm: org.eventPluralTerm,
        }}
      />
    </div>
  );
}
