import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const ROOM_COLORS = [
  { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-800" },
  { bg: "bg-green-100", border: "border-green-400", text: "text-green-800" },
  { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-800" },
  { bg: "bg-yellow-100", border: "border-yellow-500", text: "text-yellow-800" },
  { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-800" },
  { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-800" },
  { bg: "bg-teal-100", border: "border-teal-400", text: "text-teal-800" },
  { bg: "bg-red-100", border: "border-red-400", text: "text-red-800" },
  { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-800" },
  { bg: "bg-pink-100", border: "border-pink-400", text: "text-pink-800" },
];

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const now = new Date();
  const month = sp.month ? parseInt(sp.month) - 1 : now.getMonth();
  const year = sp.year ? parseInt(sp.year) : now.getFullYear();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const monthName = monthStart.toLocaleString("default", { month: "long" });

  // Fetch events for this month
  const events = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      startDateTime: { gte: monthStart, lte: monthEnd },
    },
    include: {
      room: true,
      eventType: true,
    },
    orderBy: { startDateTime: "asc" },
  });

  // Fetch rooms for legend
  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { sortOrder: "asc" },
  });

  // Build room color map
  const roomColorMap = new Map<string, number>();
  rooms.forEach((room, i) => roomColorMap.set(room.id, i % ROOM_COLORS.length));

  // Group events by day
  const eventsByDay = new Map<number, typeof events>();
  for (const event of events) {
    if (!event.startDateTime) continue;
    const day = event.startDateTime.getDate();
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(event);
  }

  // Calendar grid
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const isCurrentMonth =
    now.getMonth() === month && now.getFullYear() === year;
  const today = now.getDate();

  // Prev/next month links
  const prevMonth = month === 0 ? 12 : month;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 1 : month + 2;
  const nextYear = month === 11 ? year + 1 : year;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {monthName} {year}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {org.appDisplayName || org.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${orgSlug}?month=${prevMonth}&year=${prevYear}`}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <Link
            href={`/${orgSlug}`}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Today
          </Link>
          <Link
            href={`/${orgSlug}?month=${nextMonth}&year=${nextYear}`}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </Link>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center bg-slate-50"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvents = day ? eventsByDay.get(day) || [] : [];
            const isToday = isCurrentMonth && day === today;

            return (
              <div
                key={i}
                className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${
                  day === null ? "bg-slate-50/50" : ""
                } ${isToday ? "bg-primary/5" : ""}`}
              >
                {day !== null && (
                  <>
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm mb-0.5 ${
                        isToday
                          ? "bg-primary text-white font-bold"
                          : "text-slate-700"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => {
                        const colorIdx = event.roomId
                          ? roomColorMap.get(event.roomId) ?? 0
                          : 0;
                        const color = ROOM_COLORS[colorIdx];
                        return (
                          <div
                            key={event.id}
                            className={`text-xs px-1.5 py-0.5 rounded border-l-2 truncate ${color.bg} ${color.border} ${color.text}`}
                            title={`${event.title} — ${event.room?.name || "No room"}`}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-slate-400 px-1.5">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Room legend */}
      {rooms.length > 0 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Rooms
          </h3>
          <div className="flex flex-wrap gap-3">
            {rooms.slice(0, 10).map((room) => {
              const colorIdx = roomColorMap.get(room.id) ?? 0;
              const color = ROOM_COLORS[colorIdx];
              return (
                <div key={room.id} className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold text-white ${color.bg.replace("100", "500")}`}
                    style={{
                      backgroundColor: `var(--tw-${color.bg.replace("bg-", "").replace("-100", "")}-500, #64748b)`,
                    }}
                  >
                    {room.iconText}
                  </span>
                  <span className="text-xs text-slate-600">{room.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
