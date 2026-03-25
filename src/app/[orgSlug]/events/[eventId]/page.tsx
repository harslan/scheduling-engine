import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  Tag,
  Users,
  FileText,
  Repeat,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { describeRRule } from "@/lib/recurrence";
import { DeleteEventButton } from "./delete-button";
import { EditButton } from "./event-detail-client";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventId: string }>;
}) {
  const { orgSlug, eventId } = await params;
  const session = await getSession();
  let currentUserId: string | null = null;
  let currentUserEmail: string | null = null;
  if (session?.user) {
    currentUserId = (session.user as { id: string }).id;
    currentUserEmail = session.user.email || null;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      organization: {
        include: {
          rooms: { where: { active: true }, orderBy: { sortOrder: "asc" } },
          eventTypes: { orderBy: { name: "asc" } },
        },
      },
      room: true,
      eventType: true,
      submitter: { select: { id: true, name: true, email: true } },
      approvalActions: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
      activityLog: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      instances: {
        where: { deleted: false },
        orderBy: { startDateTime: "asc" },
        take: 20,
      },
    },
  });

  if (!event || event.deleted) notFound();
  if (event.organization.slug !== orgSlug) notFound();

  const isOwner = currentUserId ? (event.submitterId === currentUserId || event.contactEmail === currentUserEmail) : false;
  const canEdit = isOwner && event.organization.allowsEventChanges && event.status !== "CANCELLED";

  const statusStyles: Record<string, string> = {
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    DENIED: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
    DRAFT: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href={`/${orgSlug}/my-events`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My {event.organization.eventPluralTerm}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {event.title || "Untitled Event"}
            </h1>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${
                statusStyles[event.status] || statusStyles.PENDING
              }`}
            >
              {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Created {format(event.createdAt, "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <EditButton
              event={{
                id: event.id,
                title: event.title,
                eventTypeId: event.eventTypeId,
                roomId: event.roomId,
                startDateTime: event.startDateTime ? format(event.startDateTime, "yyyy-MM-dd'T'HH:mm") : "",
                endDateTime: event.endDateTime ? format(event.endDateTime, "yyyy-MM-dd'T'HH:mm") : "",
                expectedAttendeeCount: event.expectedAttendeeCount,
                contactName: event.contactName,
                contactEmail: event.contactEmail,
                contactPhone: event.contactPhone,
                notes: event.notes,
              }}
              rooms={event.organization.rooms.map((r) => ({ id: r.id, name: r.name }))}
              eventTypes={event.organization.eventTypes.map((t) => ({ id: t.id, name: t.name }))}
              orgSlug={orgSlug}
            />
          )}
          {isOwner && event.status !== "CANCELLED" && (
            <DeleteEventButton eventId={event.id} orgSlug={orgSlug} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Schedule */}
          <DetailCard title="Schedule">
            <DetailRow icon={<Calendar className="w-4 h-4" />} label="Date">
              {event.startDateTime
                ? format(event.startDateTime, "EEEE, MMMM d, yyyy")
                : "—"}
            </DetailRow>
            <DetailRow icon={<Clock className="w-4 h-4" />} label="Time">
              {event.startDateTime && event.endDateTime
                ? `${format(event.startDateTime, "h:mm a")} — ${format(event.endDateTime, "h:mm a")}`
                : "—"}
            </DetailRow>
            {event.room && (
              <DetailRow icon={<MapPin className="w-4 h-4" />} label={event.organization.roomTerm}>
                {event.room.name}
              </DetailRow>
            )}
            {event.eventType && (
              <DetailRow icon={<Tag className="w-4 h-4" />} label="Type">
                {event.eventType.name}
              </DetailRow>
            )}
            {event.expectedAttendeeCount && (
              <DetailRow icon={<Users className="w-4 h-4" />} label="Expected Attendees">
                {event.expectedAttendeeCount}
              </DetailRow>
            )}
          </DetailCard>

          {/* Recurrence */}
          {event.recurrenceRule && (
            <DetailCard title="Recurrence">
              <DetailRow icon={<Repeat className="w-4 h-4" />} label="Pattern">
                {describeRRule(event.recurrenceRule)}
              </DetailRow>
              {event.recurrenceEndDate && (
                <DetailRow icon={<Calendar className="w-4 h-4" />} label="Repeats until">
                  {format(event.recurrenceEndDate, "MMMM d, yyyy")}
                </DetailRow>
              )}
              {event.instances.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    Upcoming instances ({event.instances.length})
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {event.instances.map((inst) => (
                      <div key={inst.id} className="text-sm text-slate-600 flex items-center gap-2">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {format(inst.startDateTime, "EEE, MMM d")} at{" "}
                        {format(inst.startDateTime, "h:mm a")} – {format(inst.endDateTime, "h:mm a")}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DetailCard>
          )}

          {/* Contact */}
          <DetailCard title="Contact Information">
            <DetailRow icon={<User className="w-4 h-4" />} label="Name">
              {event.contactName || "—"}
            </DetailRow>
            <DetailRow icon={<Mail className="w-4 h-4" />} label="Email">
              {event.contactEmail || "—"}
            </DetailRow>
            {event.contactPhone && (
              <DetailRow icon={<Phone className="w-4 h-4" />} label="Phone">
                {event.contactPhone}
              </DetailRow>
            )}
          </DetailCard>

          {/* Notes */}
          {event.notes && (
            <DetailCard title="Notes">
              <div className="flex gap-3">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{event.notes}</p>
              </div>
            </DetailCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Approval history */}
          {event.approvalActions.length > 0 && (
            <DetailCard title="Approval History">
              <div className="space-y-3">
                {event.approvalActions.map((action) => (
                  <div key={action.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          action.action === "APPROVED"
                            ? "bg-emerald-500"
                            : action.action === "DENIED"
                              ? "bg-red-500"
                              : "bg-slate-400"
                        }`}
                      />
                      <span className="font-medium text-slate-700">
                        {action.action.charAt(0) + action.action.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-slate-500 ml-4">
                      by {action.user.name || action.user.email}
                    </p>
                    {action.comment && (
                      <p className="text-slate-500 ml-4 italic">
                        &ldquo;{action.comment}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-slate-400 ml-4">
                      {format(action.createdAt, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            </DetailCard>
          )}

          {/* Activity log */}
          <DetailCard title="Activity">
            <div className="space-y-2">
              {event.activityLog.map((log) => (
                <div key={log.id} className="text-sm">
                  <p className="text-slate-600">
                    {log.action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </p>
                  <p className="text-xs text-slate-400">
                    {format(log.createdAt, "MMM d, yyyy h:mm a")}
                    {log.actorEmail && ` · ${log.actorEmail}`}
                  </p>
                </div>
              ))}
              {event.activityLog.length === 0 && (
                <p className="text-sm text-slate-400">No activity yet</p>
              )}
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 border-l-3 border-primary pl-3">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-slate-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-slate-700 mt-0.5">{children}</p>
      </div>
    </div>
  );
}
