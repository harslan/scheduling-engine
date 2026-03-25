import { Fragment } from "react";

/* ===== Shared calendar mockup types & data ===== */

export type CalendarEvent = {
  row: number;
  col: number;
  span: number;
  label: string;
  room: string;
  variant: "primary" | "emerald" | "amber";
};

export const CALENDAR_DAYS = ["Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27"];

/** Full set of time slots for the landing page */
export const CALENDAR_TIMES_FULL = ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM"];

/** Compact set of time slots for the login page */
export const CALENDAR_TIMES_COMPACT = ["9 AM", "10 AM", "11 AM", "12 PM"];

/** Full set of events for the landing page */
export const CALENDAR_EVENTS_FULL: CalendarEvent[] = [
  { row: 0, col: 0, span: 1, label: "Team Standup", room: "Room A", variant: "primary" },
  { row: 1, col: 1, span: 2, label: "Design Review", room: "Room B", variant: "emerald" },
  { row: 3, col: 2, span: 1, label: "Pending Review", room: "Room C", variant: "amber" },
  { row: 2, col: 4, span: 1, label: "1:1 Meeting", room: "Room B", variant: "emerald" },
  { row: 4, col: 3, span: 2, label: "Sprint Planning", room: "Room A", variant: "primary" },
  { row: 5, col: 0, span: 1, label: "All Hands", room: "Room C", variant: "primary" },
];

/** Compact set of events for the login page (only rows 0-3) */
export const CALENDAR_EVENTS_COMPACT: CalendarEvent[] = [
  { row: 0, col: 0, span: 1, label: "Team Standup", room: "Room A", variant: "primary" },
  { row: 1, col: 1, span: 2, label: "Design Review", room: "Room B", variant: "emerald" },
  { row: 3, col: 2, span: 1, label: "Pending Review", room: "Room C", variant: "amber" },
  { row: 2, col: 4, span: 1, label: "1:1 Meeting", room: "Room B", variant: "emerald" },
];

const EVENT_STYLES = {
  primary: { bg: "bg-primary/15", border: "border-primary", text: "text-primary", sub: "text-primary/60" },
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500", text: "text-emerald-700", sub: "text-emerald-600/60" },
  amber: { bg: "bg-amber-500/15", border: "border-amber-500", text: "text-amber-700", sub: "text-amber-600/60" },
};

export function CalendarEventBlock({ event }: { event: CalendarEvent }) {
  const s = EVENT_STYLES[event.variant];
  const height = event.span > 1 ? `calc(${event.span * 100}% + ${(event.span - 1) * 1}px)` : undefined;

  return (
    <div
      className={`absolute inset-x-0.5 top-0.5 ${s.bg} border-l-2 ${s.border} rounded-r-sm px-1 py-0.5 overflow-hidden`}
      style={height ? { height, zIndex: 1 } : undefined}
    >
      <span className={`font-medium ${s.text} leading-tight block truncate`}>{event.label}</span>
      <span className={`${s.sub} truncate block`}>{event.room}</span>
    </div>
  );
}

/** Reusable calendar grid — renders a weekly calendar mockup */
export function CalendarGrid({
  times,
  events,
  cellSize = "normal",
}: {
  times: string[];
  events: CalendarEvent[];
  cellSize?: "normal" | "compact";
}) {
  const gridCols = cellSize === "compact"
    ? "grid-cols-[36px_repeat(5,1fr)]"
    : "grid-cols-[40px_repeat(5,1fr)] sm:grid-cols-[48px_repeat(5,1fr)]";
  const textSize = cellSize === "compact" ? "text-[9px]" : "text-[10px]";
  const minH = cellSize === "compact" ? "min-h-[24px]" : "min-h-[28px]";
  const pad = cellSize === "compact" ? "p-1" : "p-1.5";

  return (
    <div className={`grid ${gridCols} gap-px bg-slate-100 rounded-lg overflow-hidden ${textSize}`}>
      <div className={`bg-white ${pad}`} />
      {CALENDAR_DAYS.map((day) => (
        <div key={day} className={`bg-slate-50 ${pad} text-center font-medium text-slate-500`}>
          {day}
        </div>
      ))}
      {times.map((time, rowIdx) => (
        <Fragment key={time}>
          <div className={`bg-white ${pad} text-right text-slate-400 pr-2`}>
            {time}
          </div>
          {CALENDAR_DAYS.map((_, colIdx) => {
            const event = events.find((e) => e.row === rowIdx && e.col === colIdx);
            return (
              <div key={colIdx} className={`bg-white p-0.5 ${minH} relative`}>
                {event && <CalendarEventBlock event={event} />}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
