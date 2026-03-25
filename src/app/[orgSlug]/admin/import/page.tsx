import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ImportForm } from "./import-form";
import { Download } from "lucide-react";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      rooms: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      eventTypes: { orderBy: { name: "asc" } },
    },
  });
  if (!org) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Import / Export Events
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Bulk import events from CSV or export existing events.
      </p>

      {/* Export section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Export Events</h2>
        <p className="text-sm text-slate-500 mb-4">
          Download all events as a CSV file for use in spreadsheets or other systems.
        </p>
        <div className="flex gap-3">
          <a
            href={`/api/events/export?org=${orgSlug}`}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export All Events
          </a>
          <a
            href={`/api/events/export?org=${orgSlug}&status=APPROVED`}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Export Approved Only
          </a>
        </div>
      </div>

      {/* Import section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Import Events</h2>
        <p className="text-sm text-slate-500 mb-2">
          Upload a CSV file to bulk-create events. Required columns: <strong>Title</strong>,{" "}
          <strong>StartDate</strong>, <strong>StartTime</strong>.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Supported Columns
          </p>
          <div className="text-xs text-slate-600 grid grid-cols-2 gap-1">
            <span><strong>Title</strong> (required)</span>
            <span><strong>StartDate</strong> (required, YYYY-MM-DD)</span>
            <span><strong>StartTime</strong> (required, HH:MM)</span>
            <span>EndDate (YYYY-MM-DD)</span>
            <span>EndTime (HH:MM)</span>
            <span>Room (must match existing room name)</span>
            <span>Type (must match existing event type)</span>
            <span>ContactName</span>
            <span>ContactEmail</span>
            <span>ContactPhone</span>
            <span>Notes</span>
            <span>ExpectedAttendees</span>
          </div>
        </div>

        {/* Available rooms and types for reference */}
        <div className="flex gap-6 mb-4 text-xs text-slate-500">
          {org.rooms.length > 0 && (
            <div>
              <span className="font-semibold">Rooms:</span>{" "}
              {org.rooms.map((r) => r.name).join(", ")}
            </div>
          )}
          {org.eventTypes.length > 0 && (
            <div>
              <span className="font-semibold">Types:</span>{" "}
              {org.eventTypes.map((t) => t.name).join(", ")}
            </div>
          )}
        </div>

        <ImportForm orgSlug={orgSlug} />
      </div>
    </div>
  );
}
