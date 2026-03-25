import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Calendar, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";

const PAGE_SIZE = 25;

export default async function MyEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { orgSlug } = await params;
  const { status: statusFilter, q: searchQuery, page: pageStr } = await searchParams;
  const user = await getCurrentUser();
  const currentPage = Math.max(1, parseInt(pageStr || "1", 10) || 1);

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  // Build where clause
  const where: Record<string, unknown> = {
    organizationId: org.id,
    deleted: false,
    OR: [
      { submitterId: user.id },
      { contactEmail: user.email },
    ],
  };

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  if (searchQuery) {
    where.title = { contains: searchQuery, mode: "insensitive" };
  }

  const [totalCount, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: { room: true, eventType: true },
      orderBy: { startDateTime: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statuses = ["ALL", "PENDING", "APPROVED", "DENIED", "CANCELLED"];
  const activeStatus = statusFilter || "ALL";

  function buildUrl(overrides: { page?: number; status?: string }) {
    const s = overrides.status ?? activeStatus;
    const p = overrides.page ?? currentPage;
    const parts = [`/${orgSlug}/my-events?status=${s}`];
    if (searchQuery) parts.push(`q=${encodeURIComponent(searchQuery)}`);
    if (p > 1) parts.push(`page=${p}`);
    return parts.join("&");
  }

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
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Submit {org.eventSingularTerm}</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
          {statuses.map((s) => (
            <Link
              key={s}
              href={buildUrl({ status: s, page: 1 })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeStatus === s
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        {/* Search */}
        <form
          action={`/${orgSlug}/my-events`}
          method="GET"
          className="relative flex-1 max-w-xs"
        >
          <input type="hidden" name="status" value={activeStatus} />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery || ""}
            placeholder={`Search ${org.eventPluralTerm.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </form>
      </div>

      {/* Results */}
      {events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            No {org.eventPluralTerm.toLowerCase()} found
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {searchQuery || activeStatus !== "ALL"
              ? "Try changing your filters."
              : `${org.eventPluralTerm} you submit will appear here.`}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop table */}
          <div className="hidden md:block">
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
                      {event.eventType && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {event.eventType.name}
                        </p>
                      )}
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

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-slate-100">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/${orgSlug}/events/${event.id}`}
                className="block px-4 py-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {event.title || "Untitled"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {event.room?.name || "No room"}
                      {event.startDateTime &&
                        ` · ${format(event.startDateTime, "MMM d, h:mm a")}`}
                    </p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
              </Link>
            ))}
          </div>

          {/* Footer with pagination */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {totalCount} event{totalCount !== 1 ? "s" : ""}
              {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
            </p>
            {totalPages > 1 && (
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
            )}
          </div>
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
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
        styles[status] || styles.PENDING
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
