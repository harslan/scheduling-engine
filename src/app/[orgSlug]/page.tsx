import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Columns3, LayoutList, Grid3X3, CalendarX } from "lucide-react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { ScrollToNow } from "./scroll-to-now";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  format,
  isSameDay,
  isToday as isDateToday,
} from "date-fns";

const ROOM_COLORS = [
  { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-800", solid: "bg-blue-500" },
  { bg: "bg-green-100", border: "border-green-400", text: "text-green-800", solid: "bg-green-500" },
  { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-800", solid: "bg-purple-500" },
  { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-800", solid: "bg-amber-500" },
  { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-800", solid: "bg-sky-500" },
  { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-800", solid: "bg-orange-500" },
  { bg: "bg-teal-100", border: "border-teal-400", text: "text-teal-800", solid: "bg-teal-500" },
  { bg: "bg-red-100", border: "border-red-400", text: "text-red-800", solid: "bg-red-500" },
  { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-800", solid: "bg-emerald-500" },
  { bg: "bg-pink-100", border: "border-pink-400", text: "text-pink-800", solid: "bg-pink-500" },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

type CalendarView = "year" | "month" | "week" | "day";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ month?: string; year?: string; view?: string; date?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const view: CalendarView = (sp.view as CalendarView) || "month";
  const now = new Date();

  // Parse the reference date
  let refDate: Date;
  if (sp.date) {
    refDate = new Date(sp.date + "T12:00:00");
  } else if (sp.month && sp.year) {
    refDate = new Date(parseInt(sp.year), parseInt(sp.month) - 1, 1);
  } else {
    refDate = now;
  }

  // Calculate date range based on view
  let rangeStart: Date;
  let rangeEnd: Date;
  let headerTitle: string;

  if (view === "year") {
    const year = sp.year ? parseInt(sp.year) : refDate.getFullYear();
    rangeStart = new Date(year, 0, 1);
    rangeEnd = new Date(year, 11, 31, 23, 59, 59);
    headerTitle = `${year}`;
  } else if (view === "week") {
    rangeStart = startOfWeek(refDate, { weekStartsOn: 0 });
    rangeEnd = endOfWeek(refDate, { weekStartsOn: 0 });
    const weekEnd = addDays(rangeStart, 6);
    if (rangeStart.getMonth() === weekEnd.getMonth()) {
      headerTitle = `${format(rangeStart, "MMMM d")} – ${format(weekEnd, "d, yyyy")}`;
    } else {
      headerTitle = `${format(rangeStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
    }
  } else if (view === "day") {
    rangeStart = startOfDay(refDate);
    rangeEnd = endOfDay(refDate);
    headerTitle = format(refDate, "EEEE, MMMM d, yyyy");
  } else {
    const month = sp.month ? parseInt(sp.month) - 1 : refDate.getMonth();
    const year = sp.year ? parseInt(sp.year) : refDate.getFullYear();
    rangeStart = new Date(year, month, 1);
    rangeEnd = new Date(year, month + 1, 0, 23, 59, 59);
    headerTitle = format(rangeStart, "MMMM yyyy");
  }

  // Fetch single (non-recurring) events
  const singleEvents = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      recurrenceRule: null,
      startDateTime: { lte: rangeEnd },
      endDateTime: { gte: rangeStart },
    },
    include: { room: true, eventType: true },
    orderBy: { startDateTime: "asc" },
  });

  // Fetch recurring event instances in range
  const recurringInstances = await prisma.eventInstance.findMany({
    where: {
      deleted: false,
      startDateTime: { lte: rangeEnd },
      endDateTime: { gte: rangeStart },
      event: {
        organizationId: org.id,
        deleted: false,
        status: "APPROVED",
        recurrenceRule: { not: null },
      },
    },
    include: {
      event: { include: { room: true, eventType: true } },
    },
    orderBy: { startDateTime: "asc" },
  });

  // Merge into unified calendar items
  const events: EventWithRoom[] = [
    ...singleEvents,
    ...recurringInstances.map((inst) => ({
      id: inst.event.id,
      title: inst.event.title,
      startDateTime: inst.startDateTime,
      endDateTime: inst.endDateTime,
      roomId: inst.event.roomId,
      room: inst.event.room,
      eventType: inst.event.eventType,
      isInstance: true,
    })),
  ].sort((a, b) => {
    const aTime = a.startDateTime?.getTime() ?? 0;
    const bTime = b.startDateTime?.getTime() ?? 0;
    return aTime - bTime;
  });

  // Fetch rooms for legend
  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { sortOrder: "asc" },
  });

  const roomColorMap = new Map<string, number>();
  rooms.forEach((room, i) => roomColorMap.set(room.id, i % ROOM_COLORS.length));

  // Navigation URLs
  const dateStr = format(refDate, "yyyy-MM-dd");
  function navUrl(direction: "prev" | "next" | "today") {
    if (direction === "today") {
      return `/${orgSlug}?view=${view}`;
    }
    const delta = direction === "prev" ? -1 : 1;
    let target: Date;
    if (view === "year") {
      const y = rangeStart.getFullYear() + delta;
      return `/${orgSlug}?view=year&year=${y}`;
    } else if (view === "month") {
      target = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + delta, 1);
      return `/${orgSlug}?view=month&month=${target.getMonth() + 1}&year=${target.getFullYear()}`;
    } else if (view === "week") {
      target = addDays(rangeStart, delta * 7);
      return `/${orgSlug}?view=week&date=${format(target, "yyyy-MM-dd")}`;
    } else {
      target = addDays(refDate, delta);
      return `/${orgSlug}?view=day&date=${format(target, "yyyy-MM-dd")}`;
    }
  }

  return (
    <div>
      {/* Message Board */}
      {org.messageBoardHtml && (
        <div
          className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6 text-sm text-blue-800 prose prose-sm prose-blue max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(org.messageBoardHtml) }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:block">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{headerTitle}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {org.appDisplayName || org.name}
            </p>
          </div>
          {/* Navigation — shown inline on mobile */}
          <div className="flex items-center gap-1 sm:hidden">
            <Link href={navUrl("prev")} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" aria-label="Previous">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Link>
            <Link href={navUrl("today")} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Today
            </Link>
            <Link href={navUrl("next")} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" aria-label="Next">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* View switcher */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 flex-1 sm:flex-none">
            {([
              { key: "year", label: "Year", icon: Grid3X3 },
              { key: "month", label: "Month", icon: CalIcon },
              { key: "week", label: "Week", icon: Columns3 },
              { key: "day", label: "Day", icon: LayoutList },
            ] as const).map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={`/${orgSlug}?view=${key}${key === "year" ? `&year=${rangeStart.getFullYear()}` : key === "month" ? `&month=${rangeStart.getMonth() + 1}&year=${rangeStart.getFullYear()}` : `&date=${format(refDate, "yyyy-MM-dd")}`}`}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none ${
                  view === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                aria-label={`${label} view`}
                aria-current={view === key ? "page" : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </div>

          {/* Navigation — hidden on mobile (shown above) */}
          <div className="hidden sm:flex items-center gap-1">
            <Link href={navUrl("prev")} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" aria-label="Previous">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Link>
            <Link href={navUrl("today")} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Today
            </Link>
            <Link href={navUrl("next")} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" aria-label="Next">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* Calendar body */}
      {view === "year" && (
        <YearView
          orgSlug={orgSlug}
          year={rangeStart.getFullYear()}
          events={events}
          now={now}
        />
      )}
      {view === "month" && (
        <MonthView
          orgSlug={orgSlug}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          events={events}
          roomColorMap={roomColorMap}
          now={now}
          org={org}
        />
      )}
      {view === "week" && (
        <WeekView
          orgSlug={orgSlug}
          rangeStart={rangeStart}
          events={events}
          roomColorMap={roomColorMap}
          org={org}
        />
      )}
      {view === "day" && (
        <DayView
          orgSlug={orgSlug}
          refDate={refDate}
          events={events}
          roomColorMap={roomColorMap}
          org={org}
        />
      )}

      {/* Room legend */}
      {rooms.length > 0 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            {org.roomTerm}s
          </h3>
          <div className="flex flex-wrap gap-3">
            {rooms.map((room) => {
              const colorIdx = roomColorMap.get(room.id) ?? 0;
              const color = ROOM_COLORS[colorIdx];
              return (
                <div key={room.id} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${color.solid}`} />
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

// ============================================================
// MONTH VIEW
// ============================================================

type EventWithRoom = {
  id: string;
  title: string;
  startDateTime: Date | null;
  endDateTime: Date | null;
  roomId: string | null;
  room: { id: string; name: string } | null;
  eventType: { id: string; name: string; colorIndex: number | null } | null;
  isInstance?: boolean;
};

function getEventColorIdx(
  event: EventWithRoom,
  roomColorMap: Map<string, number>
): number {
  // Prefer event type color if set
  if (event.eventType?.colorIndex != null) {
    return event.eventType.colorIndex % ROOM_COLORS.length;
  }
  // Fall back to room color
  if (event.roomId) {
    return roomColorMap.get(event.roomId) ?? 0;
  }
  return 0;
}

function MonthView({
  orgSlug,
  rangeStart,
  rangeEnd,
  events,
  roomColorMap,
  now,
  org,
}: {
  orgSlug: string;
  rangeStart: Date;
  rangeEnd: Date;
  events: EventWithRoom[];
  roomColorMap: Map<string, number>;
  now: Date;
  org: { roomTerm: string };
}) {
  const month = rangeStart.getMonth();
  const year = rangeStart.getFullYear();
  const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;
  const today = now.getDate();

  const eventsByDay = new Map<number, EventWithRoom[]>();
  for (const event of events) {
    if (!event.startDateTime) continue;
    const day = event.startDateTime.getDate();
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(event);
  }

  const firstDay = rangeStart.getDay();
  const daysInMonth = rangeEnd.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
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
                  <Link
                    href={`/${orgSlug}?view=day&date=${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm mb-0.5 hover:bg-primary/10 transition-colors ${
                      isToday
                        ? "bg-primary text-white font-bold"
                        : "text-slate-700"
                    }`}
                  >
                    {day}
                  </Link>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => {
                      const colorIdx = getEventColorIdx(event, roomColorMap);
                      const color = ROOM_COLORS[colorIdx];
                      return (
                        <Link
                          key={event.id}
                          href={`/${orgSlug}/events/${event.id}`}
                          className={`block text-xs px-1.5 py-0.5 rounded border-l-2 truncate hover:opacity-80 transition-opacity ${color.bg} ${color.border} ${color.text}`}
                          title={`${event.title} — ${event.room?.name || `No ${org.roomTerm.toLowerCase()}`}`}
                        >
                          {event.title}
                          {event.room && (
                            <span className="block truncate opacity-70">{event.room.name}</span>
                          )}
                        </Link>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <Link
                        href={`/${orgSlug}?view=day&date=${format(day, "yyyy-MM-dd")}`}
                        className="text-xs text-primary hover:underline px-1.5"
                      >
                        +{dayEvents.length - 3} more
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// WEEK VIEW
// ============================================================

function WeekView({
  orgSlug,
  rangeStart,
  events,
  roomColorMap,
  org,
}: {
  orgSlug: string;
  rangeStart: Date;
  events: EventWithRoom[];
  roomColorMap: Map<string, number>;
  org: { roomTerm: string; eventSingularTerm: string; eventPluralTerm: string };
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  const weekHasToday = weekDays.some((d) => isDateToday(d));

  return (
    <>
      {/* Mobile: vertical day list */}
      <div className="md:hidden space-y-3">
        {weekDays.map((day) => {
          const today = isDateToday(day);
          const dayEvents = events
            .filter((e) => e.startDateTime && isSameDay(e.startDateTime, day))
            .sort((a, b) => (a.startDateTime?.getTime() ?? 0) - (b.startDateTime?.getTime() ?? 0));

          return (
            <div key={day.toISOString()} className={`bg-white rounded-xl border ${today ? "border-primary/30 ring-1 ring-primary/10" : "border-slate-200"} overflow-hidden shadow-sm`}>
              <Link
                href={`/${orgSlug}?view=day&date=${format(day, "yyyy-MM-dd")}`}
                className={`flex items-center gap-2 px-4 py-2.5 border-b ${today ? "bg-primary/5 border-primary/10" : "bg-slate-50 border-slate-100"}`}
              >
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${today ? "bg-primary text-white" : "text-slate-700"}`}>
                  {format(day, "d")}
                </span>
                <span className={`text-sm font-semibold ${today ? "text-primary" : "text-slate-700"}`}>
                  {format(day, "EEEE")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="ml-auto text-xs font-medium text-slate-400">{dayEvents.length} {dayEvents.length !== 1 ? org.eventPluralTerm.toLowerCase() : org.eventSingularTerm.toLowerCase()}</span>
                )}
              </Link>
              {dayEvents.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400">No {org.eventPluralTerm.toLowerCase()}</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dayEvents.map((event) => {
                    const colorIdx = getEventColorIdx(event, roomColorMap);
                    const color = ROOM_COLORS[colorIdx];
                    return (
                      <Link
                        key={event.id}
                        href={`/${orgSlug}/events/${event.id}`}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                      >
                        <div className={`w-1 self-stretch rounded-full ${color.solid} shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">{event.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {event.startDateTime && format(event.startDateTime, "h:mm a")}
                            {event.endDateTime && ` – ${format(event.endDateTime, "h:mm a")}`}
                            {event.room && <span className="text-slate-400"> · {event.room.name}</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: time grid */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200">
          <div className="bg-slate-50" />
          {weekDays.map((day) => {
            const today = isDateToday(day);
            return (
              <div key={day.toISOString()} className={`px-2 py-3 text-center border-l border-slate-200 ${today ? "bg-primary/5" : "bg-slate-50"}`}>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{format(day, "EEE")}</div>
                <Link
                  href={`/${orgSlug}?view=day&date=${format(day, "yyyy-MM-dd")}`}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm mt-1 hover:bg-primary/10 transition-colors ${today ? "bg-primary text-white font-bold" : "text-slate-700"}`}
                >
                  {format(day, "d")}
                </Link>
              </div>
            );
          })}
        </div>
        <ScrollToNow isToday={weekHasToday} className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="h-16 border-b border-slate-100 flex items-start justify-end pr-2 pt-0.5">
                <span className="text-xs text-slate-400">{formatHour(hour)}</span>
              </div>
              {weekDays.map((day) => {
                const isFirstHourEvents = events.filter((e) => {
                  if (!e.startDateTime) return false;
                  return isSameDay(e.startDateTime, day) && e.startDateTime.getHours() === hour;
                });

                return (
                  <div
                    key={`${hour}-${day.toISOString()}`}
                    className={`h-16 border-b border-l border-slate-100 relative p-0.5 ${isDateToday(day) ? "bg-primary/[0.02]" : ""}`}
                  >
                    {isFirstHourEvents.map((event) => {
                      const colorIdx = getEventColorIdx(event, roomColorMap);
                      const color = ROOM_COLORS[colorIdx];
                      const durationHours = event.endDateTime && event.startDateTime
                        ? (event.endDateTime.getTime() - event.startDateTime.getTime()) / 3600000
                        : 1;
                      const heightRem = Math.min(durationHours * 4, 16);

                      return (
                        <Link
                          key={event.id}
                          href={`/${orgSlug}/events/${event.id}`}
                          className={`absolute left-0.5 right-0.5 rounded-md border-l-3 px-1.5 py-0.5 overflow-hidden hover:opacity-80 transition-opacity z-10 ${color.bg} ${color.border} ${color.text}`}
                          style={{ height: `${heightRem}rem` }}
                          title={`${event.title} — ${event.room?.name || `No ${org.roomTerm.toLowerCase()}`}`}
                        >
                          <div className="text-xs font-medium truncate">{event.title}</div>
                          <div className="text-[10px] opacity-75 truncate">
                            {event.startDateTime && format(event.startDateTime, "h:mm a")}
                            {event.room && ` · ${event.room.name}`}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </ScrollToNow>
      </div>
    </>
  );
}

// ============================================================
// DAY VIEW
// ============================================================

function DayView({
  orgSlug,
  refDate,
  events,
  roomColorMap,
  org,
}: {
  orgSlug: string;
  refDate: Date;
  events: EventWithRoom[];
  roomColorMap: Map<string, number>;
  org: { roomTerm: string; eventPluralTerm: string };
}) {
  const dayEvents = events
    .filter((e) => e.startDateTime && isSameDay(e.startDateTime, refDate))
    .sort((a, b) => (a.startDateTime?.getTime() ?? 0) - (b.startDateTime?.getTime() ?? 0));

  if (dayEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 px-4">
        <CalendarX className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm">No {org.eventPluralTerm.toLowerCase()} scheduled for this day</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
        {dayEvents.map((event) => {
          const colorIdx = getEventColorIdx(event, roomColorMap);
          const color = ROOM_COLORS[colorIdx];
          return (
            <Link
              key={event.id}
              href={`/${orgSlug}/events/${event.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className={`w-1.5 self-stretch rounded-full ${color.solid} shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {event.startDateTime && format(event.startDateTime, "h:mm a")}
                  {event.endDateTime && ` – ${format(event.endDateTime, "h:mm a")}`}
                </div>
                {event.room && (
                  <div className="text-xs text-slate-400 mt-0.5">{org.roomTerm}: {event.room.name}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop: time grid */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <ScrollToNow isToday={isDateToday(refDate)} className="grid grid-cols-[60px_1fr] max-h-[600px] overflow-y-auto">
          {HOURS.map((hour) => {
            const hourEvents = dayEvents.filter((e) => e.startDateTime?.getHours() === hour);

            return (
              <div key={hour} className="contents">
                <div className="h-20 border-b border-slate-100 flex items-start justify-end pr-2 pt-1">
                  <span className="text-xs text-slate-400">{formatHour(hour)}</span>
                </div>
                <div className="h-20 border-b border-slate-100 relative p-0.5">
                  {hourEvents.map((event, idx) => {
                    const total = hourEvents.length;
                    const colorIdx = getEventColorIdx(event, roomColorMap);
                    const color = ROOM_COLORS[colorIdx];
                    const durationHours = event.endDateTime && event.startDateTime
                      ? (event.endDateTime.getTime() - event.startDateTime.getTime()) / 3600000
                      : 1;
                    const heightRem = Math.min(durationHours * 5, 20);
                    const widthPercent = total > 1 ? 100 / total : undefined;
                    const leftPercent = total > 1 ? (100 / total) * idx : undefined;

                    return (
                      <Link
                        key={event.id}
                        href={`/${orgSlug}/events/${event.id}`}
                        className={`absolute rounded-lg border-l-4 px-3 py-1.5 overflow-hidden hover:shadow-md transition-shadow z-10 ${color.bg} ${color.border} ${color.text}`}
                        style={{
                          height: `${heightRem}rem`,
                          ...(total > 1
                            ? { left: `${leftPercent}%`, width: `${widthPercent}%` }
                            : { left: '0.25rem', right: '0.25rem' }),
                        }}
                      >
                        <div className="text-sm font-semibold truncate">{event.title}</div>
                        <div className="text-xs opacity-75 mt-0.5">
                          {event.startDateTime && format(event.startDateTime, "h:mm a")}
                          {event.endDateTime && ` – ${format(event.endDateTime, "h:mm a")}`}
                        </div>
                        {event.room && (
                          <div className="text-xs opacity-75 mt-0.5">{org.roomTerm}: {event.room.name}</div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </ScrollToNow>
      </div>
    </>
  );
}

// ============================================================
// YEAR VIEW
// ============================================================

function YearView({
  orgSlug,
  year,
  events,
  now,
}: {
  orgSlug: string;
  year: number;
  events: EventWithRoom[];
  now: Date;
}) {
  const months = Array.from({ length: 12 }, (_, i) => i);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];

  // Count events per day
  const eventCountByDate = new Map<string, number>();
  for (const event of events) {
    if (!event.startDateTime) continue;
    const key = format(event.startDateTime, "yyyy-MM-dd");
    eventCountByDate.set(key, (eventCountByDate.get(key) || 0) + 1);
  }

  const isCurrentYear = now.getFullYear() === year;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {months.map((month) => {
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let i = 1; i <= daysInMonth; i++) cells.push(i);

          return (
            <div key={month}>
              <Link
                href={`/${orgSlug}?view=month&month=${month + 1}&year=${year}`}
                className="block text-sm font-semibold text-slate-700 mb-2 hover:text-primary transition-colors"
              >
                {monthNames[month]}
              </Link>
              <div className="grid grid-cols-7 gap-0">
                {dayLetters.map((d, i) => (
                  <div
                    key={i}
                    className="text-center text-[9px] font-medium text-slate-400 pb-1"
                  >
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`e-${i}`} className="h-5" />;
                  }

                  const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const count = eventCountByDate.get(dateKey) || 0;
                  const isToday =
                    isCurrentYear &&
                    now.getMonth() === month &&
                    now.getDate() === day;

                  return (
                    <Link
                      key={`d-${day}`}
                      href={`/${orgSlug}?view=day&date=${dateKey}`}
                      className={`h-5 flex items-center justify-center text-[10px] rounded-sm transition-colors ${
                        isToday
                          ? "bg-primary text-white font-bold"
                          : count > 0
                            ? "bg-primary/15 text-primary font-medium hover:bg-primary/25"
                            : "text-slate-500 hover:bg-slate-100"
                      }`}
                      title={count > 0 ? `${count} event${count > 1 ? "s" : ""}` : undefined}
                    >
                      {day}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
