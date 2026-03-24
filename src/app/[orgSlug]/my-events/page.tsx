import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";

export default async function MyEventsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await getCurrentUser();

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const events = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      OR: [
        { submitterId: user.id },
        { contactEmail: user.email },
      ],
    },
    include: { room: true, eventType: true },
    orderBy: { startDateTime: "desc" },
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            My {org.eventPluralTerm}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {org.eventPluralTerm} linked to your account
          </p>
        </div>
        <Link
          href={`/${orgSlug}/submit-event`}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Submit {org.eventSingularTerm}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">No {org.eventPluralTerm.toLowerCase()} found</p>
          <p className="text-slate-400 text-sm mt-1">
            {org.eventPluralTerm} you submit will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {org.eventSingularTerm}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {org.roomTerm}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${orgSlug}/events/${event.id}`}
                      className="font-medium text-slate-900 hover:text-primary transition-colors"
                    >
                      {event.title || "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {event.room?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {event.startDateTime
                      ? format(event.startDateTime, "MMM d, yyyy h:mm a")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={event.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    DENIED: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
    DRAFT: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] || styles.PENDING
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
