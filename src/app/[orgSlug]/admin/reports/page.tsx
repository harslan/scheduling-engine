import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BarChart3, Building2, Calendar, Clock, TrendingUp } from "lucide-react";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const now = new Date();

  // Fetch rooms with event counts
  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          events: {
            where: { deleted: false, status: "APPROVED" },
          },
        },
      },
    },
  });

  // Events per month for the last 6 months
  const monthlyData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(now, 5 - i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      return prisma.event.count({
        where: {
          organizationId: org.id,
          deleted: false,
          createdAt: { gte: start, lte: end },
        },
      }).then((count) => ({
        month: format(start, "MMM"),
        year: format(start, "yyyy"),
        count,
      }));
    })
  );

  // Busiest day of week
  const approvedEvents = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      startDateTime: { not: null },
    },
    select: { startDateTime: true },
  });

  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const hourCounts = new Array(24).fill(0);

  for (const event of approvedEvents) {
    if (event.startDateTime) {
      dayOfWeekCounts[event.startDateTime.getDay()]++;
      hourCounts[event.startDateTime.getHours()]++;
    }
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const busiestDay = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
  const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));

  // Room utilization - events per room as percentage of total
  const totalRoomEvents = rooms.reduce((sum, r) => sum + r._count.events, 0);
  const maxBarValue = Math.max(...monthlyData.map((m) => m.count), 1);

  // Event type breakdown
  const typeBreakdown = await prisma.event.groupBy({
    by: ["eventTypeId"],
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const typeIds = typeBreakdown.map((t) => t.eventTypeId).filter(Boolean) as string[];
  const types = await prisma.eventType.findMany({
    where: { id: { in: typeIds } },
  });
  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Reports</h1>
      <p className="text-sm text-slate-500 mb-8">
        Usage analytics for {org.appDisplayName || org.name}
      </p>

      {/* Key insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <InsightCard
          icon={<Calendar className="w-5 h-5" />}
          label="Total Approved Events"
          value={approvedEvents.length}
        />
        <InsightCard
          icon={<Building2 className="w-5 h-5" />}
          label={`Most Used ${org.roomTerm}`}
          value={rooms.sort((a, b) => b._count.events - a._count.events)[0]?.name || "—"}
          isText
        />
        <InsightCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Busiest Day"
          value={dayNames[busiestDay]}
          isText
        />
        <InsightCard
          icon={<Clock className="w-5 h-5" />}
          label="Peak Hour"
          value={`${busiestHour === 0 ? 12 : busiestHour > 12 ? busiestHour - 12 : busiestHour}:00 ${busiestHour >= 12 ? "PM" : "AM"}`}
          isText
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-slate-900">Monthly Submissions</h3>
          </div>
          <div className="flex items-end gap-2 h-40">
            {monthlyData.map((m) => (
              <div key={`${m.month}-${m.year}`} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-slate-700">
                  {m.count}
                </span>
                <div
                  className="w-full bg-primary/20 rounded-t-md hover:bg-primary/30 transition-colors relative"
                  style={{
                    height: `${Math.max((m.count / maxBarValue) * 100, 4)}%`,
                  }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md"
                    style={{
                      height: `${Math.max((m.count / maxBarValue) * 100, 4)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Room utilization */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-slate-900">{org.roomTerm} Usage</h3>
          </div>
          <div className="space-y-3">
            {rooms.slice(0, 8).map((room) => {
              const pct = totalRoomEvents > 0
                ? Math.round((room._count.events / totalRoomEvents) * 100)
                : 0;
              return (
                <div key={room.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{room.name}</span>
                    <span className="text-sm text-slate-500">
                      {room._count.events} events ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of week distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Events by Day of Week</h3>
          <div className="space-y-2">
            {dayNames.map((day, i) => {
              const maxDay = Math.max(...dayOfWeekCounts);
              const pct = maxDay > 0 ? Math.round((dayOfWeekCounts[i] / maxDay) * 100) : 0;
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 w-20">{day.substring(0, 3)}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-600 w-8 text-right">
                    {dayOfWeekCounts[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event type breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Events by Type</h3>
          {typeBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400">No event types configured.</p>
          ) : (
            <div className="space-y-2">
              {typeBreakdown.map((item) => {
                const typeName = item.eventTypeId
                  ? typeMap.get(item.eventTypeId) || "Unknown"
                  : "No Type";
                const totalTyped = typeBreakdown.reduce((s, t) => s + t._count.id, 0);
                const pct = totalTyped > 0 ? Math.round((item._count.id / totalTyped) * 100) : 0;
                return (
                  <div key={item.eventTypeId || "none"} className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 w-32 truncate">{typeName}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-600 w-12 text-right">
                      {item._count.id}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  value,
  isText,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isText?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-primary">{icon}</div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className={`font-bold text-slate-900 ${isText ? "text-lg" : "text-3xl"}`}>
        {value}
      </p>
    </div>
  );
}
