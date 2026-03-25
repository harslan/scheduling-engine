import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OrgSettingsForm } from "./settings-form";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
        Organization Settings
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Configure display options, features, and scheduling rules.
      </p>

      <OrgSettingsForm
        org={{
          id: org.id,
          name: org.name,
          shortName: org.shortName,
          slug: org.slug,
          appDisplayName: org.appDisplayName,
          timezone: org.timezone,
          primaryColor: org.primaryColor,
          messageBoardHtml: org.messageBoardHtml,
          allowsRoomSelection: org.allowsRoomSelection,
          allowsMultiDayEvents: org.allowsMultiDayEvents,
          allowsRoomlessEvents: org.allowsRoomlessEvents,
          allowsUnregisteredUsers: org.allowsUnregisteredUsers,
          calendarIsPrivate: org.calendarIsPrivate,
          requiresApproval: org.requiresApproval,
          allowsEventChanges: org.allowsEventChanges,
          allowsRoomRequests: org.allowsRoomRequests,
          collectsAttendeeCount: org.collectsAttendeeCount,
          collectsContactPhone: org.collectsContactPhone,
          roomOpeningTime: org.roomOpeningTime,
          roomClosingTime: org.roomClosingTime,
          maxEventLengthMinutes: org.maxEventLengthMinutes,
          schedulingCutoffDays: org.schedulingCutoffDays,
          eventSingularTerm: org.eventSingularTerm,
          eventPluralTerm: org.eventPluralTerm,
          roomTerm: org.roomTerm,
          emailReplyToAddress: org.emailReplyToAddress,
        }}
        orgSlug={orgSlug}
      />
    </div>
  );
}
