import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventTypeRow } from "./event-type-row";
import { AddEventTypeForm } from "./add-event-type-form";

const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-red-500",
  "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-orange-500",
  "bg-teal-500", "bg-indigo-500", "bg-lime-500", "bg-rose-500",
];

export default async function AdminEventTypesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const eventTypes = await prisma.eventType.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { events: true } },
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {org.eventSingularTerm} Types
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Categorize {org.eventPluralTerm.toLowerCase()} with types.
          These appear as options when submitting {org.eventPluralTerm.toLowerCase()}.
        </p>
      </div>

      <AddEventTypeForm organizationId={org.id} orgSlug={orgSlug} />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Color
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Icon Override
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Events
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {eventTypes.map((et) => (
              <EventTypeRow
                key={et.id}
                eventType={{
                  id: et.id,
                  name: et.name,
                  colorIndex: et.colorIndex,
                  iconTextOverride: et.iconTextOverride,
                  eventCount: et._count.events,
                }}
                orgSlug={orgSlug}
              />
            ))}
          </tbody>
        </table>
        {eventTypes.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            No event types yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
