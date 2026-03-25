import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Shield, Clock, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ApprovalButtons } from "./approval-buttons";
import { AdminStatusDropdown } from "./admin-status-dropdown";

export default async function ApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const filter = sp.filter || "pending";
  const searchQuery = sp.q || "";
  const PAGE_SIZE = 25;
  const currentPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const statusFilter =
    filter === "all"
      ? {}
      : filter === "approved"
        ? { status: "APPROVED" as const }
        : filter === "denied"
          ? { status: "DENIED" as const }
          : { status: "PENDING" as const };

  const searchFilter = searchQuery
    ? { title: { contains: searchQuery, mode: "insensitive" as const } }
    : {};

  const eventWhere = {
    organizationId: org.id,
    deleted: false,
    ...statusFilter,
    ...searchFilter,
  };

  const [totalCount, events, pendingCount] = await Promise.all([
    prisma.event.count({ where: eventWhere }),
    prisma.event.findMany({
      where: eventWhere,
      include: {
        room: true,
        eventType: true,
        submitter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.event.count({
      where: { organizationId: org.id, deleted: false, status: "PENDING" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildUrl(overrides: { page?: number; filter?: string }) {
    const f = overrides.filter ?? filter;
    const p = overrides.page ?? currentPage;
    const parts = [`/${orgSlug}/admin/approvals?filter=${f}`];
    if (searchQuery) parts.push(`q=${encodeURIComponent(searchQuery)}`);
    if (p > 1) parts.push(`page=${p}`);
    return parts.join("&");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {org.eventSingularTerm} Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { key: "pending", label: "Pending", icon: Clock },
            { key: "approved", label: "Approved", icon: CheckCircle },
            { key: "denied", label: "Denied", icon: XCircle },
            { key: "all", label: "All", icon: Shield },
          ].map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={buildUrl({ filter: key, page: 1 })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
        <form
          action={`/${orgSlug}/admin/approvals`}
          method="GET"
          className="relative max-w-xs"
        >
          <input type="hidden" name="filter" value={filter} />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search events..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button type="submit" className="sr-only">Search</button>
        </form>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            No {filter !== "all" ? `${filter} ` : ""}
            {org.eventPluralTerm.toLowerCase()} found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/${orgSlug}/events/${event.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors truncate"
                    >
                      {event.title || "Untitled"}
                    </Link>
                    <StatusBadge status={event.status} />
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                    {event.room && (
                      <span>
                        {org.roomTerm}: <span className="text-slate-700">{event.room.name}</span>
                      </span>
                    )}
                    {event.eventType && (
                      <span>
                        Type: <span className="text-slate-700">{event.eventType.name}</span>
                      </span>
                    )}
                    {event.startDateTime && (
                      <span>
                        {format(event.startDateTime, "MMM d, yyyy h:mm a")}
                        {event.endDateTime &&
                          ` — ${format(event.endDateTime, "h:mm a")}`}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-sm text-slate-400">
                    Submitted by{" "}
                    <span className="text-slate-600">
                      {event.submitter?.name || event.contactName || event.contactEmail}
                    </span>
                    {" · "}
                    {format(event.createdAt, "MMM d, yyyy")}
                  </div>

                  {event.notes && (
                    <p className="mt-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      {event.notes}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {event.status === "PENDING" && (
                    <ApprovalButtons eventId={event.id} orgSlug={orgSlug} />
                  )}
                  {event.status !== "PENDING" && (
                    <AdminStatusDropdown
                      eventId={event.id}
                      orgSlug={orgSlug}
                      currentStatus={event.status}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-3">
              <p className="text-xs text-slate-400">
                {totalCount} {totalCount === 1 ? org.eventSingularTerm.toLowerCase() : org.eventPluralTerm.toLowerCase()} · Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                {currentPage > 1 ? (
                  <Link
                    href={buildUrl({ page: currentPage - 1 })}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="p-1.5 text-slate-300">
                    <ChevronLeft className="w-4 h-4" />
                  </span>
                )}
                {currentPage < totalPages ? (
                  <Link
                    href={buildUrl({ page: currentPage + 1 })}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="p-1.5 text-slate-300">
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          )}
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
  };

  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
        styles[status] || styles.PENDING
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
