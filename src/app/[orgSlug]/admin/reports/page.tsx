import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format, startOfMonth, endOfMonth, subMonths, differenceInMinutes, eachDayOfInterval, subDays, isWeekend } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { BarChart3, Building2, Calendar, Clock, TrendingUp, Timer } from "lucide-react";

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

  // Org-local "now" — month boundaries, day-of-week and hour groupings below
  // must all be computed in the org's timezone, not the server's.
  const now = new TZDate(new Date(), org.timezone);

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

  // Busiest day of week — include non-recurring events + recurring instances
  const approvedNonRecurring = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      recurrenceRule: null,
      startDateTime: { not: null },
    },
    select: { startDateTime: true },
  });

  const approvedInstances = await prisma.eventInstance.findMany({
    where: {
      deleted: false,
      event: {
        organizationId: org.id,
        deleted: false,
        status: "APPROVED",
        recurrenceRule: { not: null },
      },
    },
    select: { startDateTime: true },
  });

  const allStartTimes = [
    ...approvedNonRecurring.map((e) => e.startDateTime),
    ...approvedInstances.map((i) => i.startDateTime),
  ];

  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const hourCounts = new Array(24).fill(0);

  for (const startDateTime of allStartTimes) {
    if (startDateTime) {
      const local = new TZDate(startDateTime, org.timezone);
      dayOfWeekCounts[local.getDay()]++;
      hourCounts[local.getHours()]++;
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

  // ── Room utilization (hours booked vs available in last 30 days) ──
  const thirtyDaysAgo = subDays(now, 30);

  // Compute available hours per room (business days * daily open hours)
  const [openH, openM] = (org.roomOpeningTime || "08:00").split(":").map(Number);
  const [closeH, closeM] = (org.roomClosingTime || "22:00").split(":").map(Number);
  const dailyAvailableMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);
  const businessDays30 = eachDayOfInterval({ start: thirtyDaysAgo, end: now }).filter(
    (d) => !isWeekend(d)
  ).length;
  const totalAvailableMinutesPerRoom = businessDays30 * dailyAvailableMinutes;

  // Get actual booked minutes per room (last 30 days)
  const recentNonRecurring = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      recurrenceRule: null,
      roomId: { not: null },
      startDateTime: { gte: thirtyDaysAgo },
    },
    select: { roomId: true, startDateTime: true, endDateTime: true },
  });

  const recentInstances = await prisma.eventInstance.findMany({
    where: {
      deleted: false,
      startDateTime: { gte: thirtyDaysAgo },
      event: {
        organizationId: org.id,
        deleted: false,
        status: "APPROVED",
        roomId: { not: null },
      },
    },
    select: { startDateTime: true, endDateTime: true, event: { select: { roomId: true } } },
  });

  const roomBookedMinutes = new Map<string, number>();
  let totalBookedMinutes = 0;
  let totalEventCount = 0;

  for (const e of recentNonRecurring) {
    if (e.startDateTime && e.endDateTime && e.roomId) {
      const mins = differenceInMinutes(e.endDateTime, e.startDateTime);
      roomBookedMinutes.set(e.roomId, (roomBookedMinutes.get(e.roomId) || 0) + mins);
      totalBookedMinutes += mins;
      totalEventCount++;
    }
  }

  for (const inst of recentInstances) {
    const roomId = inst.event.roomId;
    if (roomId) {
      const mins = differenceInMinutes(inst.endDateTime, inst.startDateTime);
      roomBookedMinutes.set(roomId, (roomBookedMinutes.get(roomId) || 0) + mins);
      totalBookedMinutes += mins;
      totalEventCount++;
    }
  }

  const avgDurationMinutes = totalEventCount > 0 ? Math.round(totalBookedMinutes / totalEventCount) : 0;

  const roomUtilization = rooms.map((room) => {
    const booked = roomBookedMinutes.get(room.id) || 0;
    const pct = totalAvailableMinutesPerRoom > 0
      ? Math.round((booked / totalAvailableMinutesPerRoom) * 100)
      : 0;
    return {
      id: room.id,
      name: room.name,
      bookedHours: Math.round(booked / 60 * 10) / 10,
      availableHours: Math.round(totalAvailableMinutesPerRoom / 60 * 10) / 10,
      utilizationPct: Math.min(pct, 100),
      eventCount: room._count.events,
    };
  }).sort((a, b) => b.utilizationPct - a.utilizationPct);

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Reports</h1>
      <p className="text-sm text-slate-500 mb-8">
        Usage analytics for {org.appDisplayName || org.name}
      </p>

      {/* Key insights */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <InsightCard
          icon={<Calendar className="w-5 h-5" />}
          label="Total Approved Events"
          value={allStartTimes.length}
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
        <InsightCard
          icon={<Timer className="w-5 h-5" />}
          label="Avg Duration"
          value={avgDurationMinutes >= 60
            ? `${Math.floor(avgDurationMinutes / 60)}h ${avgDurationMinutes % 60}m`
            : `${avgDurationMinutes}m`}
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

        {/* Room utilization (time-based, last 30 days) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-slate-900">{org.roomTerm} Utilization</h3>
            </div>
            <span className="text-xs text-slate-400">Last 30 days</span>
          </div>
          <div className="space-y-3">
            {roomUtilization.slice(0, 8).map((room) => (
              <div key={room.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{room.name}</span>
                  <span className="text-sm text-slate-500">
                    {room.bookedHours}h / {room.availableHours}h ({room.utilizationPct}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      room.utilizationPct > 80
                        ? "bg-red-400"
                        : room.utilizationPct > 50
                          ? "bg-amber-400"
                          : "bg-primary"
                    }`}
                    style={{ width: `${room.utilizationPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly activity heatmap */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
        <h3 className="font-semibold text-slate-900 mb-4">Hourly Activity</h3>
        <div className="flex items-end gap-1" style={{ height: "120px" }}>
          {hourCounts.map((count, hour) => {
            const maxHour = Math.max(...hourCounts, 1);
            const pct = Math.round((count / maxHour) * 100);
            const inRange = hour >= openH && hour < closeH;
            return (
              <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[9px] text-slate-400 mb-1">
                  {count > 0 ? count : ""}
                </span>
                <div
                  className={`w-full rounded-t transition-colors ${
                    inRange
                      ? pct > 70
                        ? "bg-primary"
                        : pct > 30
                          ? "bg-primary/60"
                          : "bg-primary/30"
                      : "bg-slate-200"
                  }`}
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                <span className={`text-[9px] mt-1 ${hour % 3 === 0 ? "text-slate-500" : "text-transparent"}`}>
                  {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? "a" : "p"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-primary rounded" /> High activity
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-primary/30 rounded" /> Low activity
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-slate-200 rounded" /> Outside hours
          </span>
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
