/**
 * Recurrence rule utilities.
 * Generates event instances from an iCal-like RRULE string.
 *
 * Supported rules:
 *   FREQ=DAILY;INTERVAL=1
 *   FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR
 *   FREQ=WEEKLY;INTERVAL=2
 *   FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15
 *   FREQ=MONTHLY;INTERVAL=1  (uses start date's day-of-month)
 */

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byDay?: string[]; // MO, TU, WE, TH, FR, SA, SU
  byMonthDay?: number;
  until?: Date;
  count?: number;
}

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export function parseRRule(rrule: string): RecurrenceRule {
  const parts: Record<string, string> = {};
  for (const segment of rrule.split(";")) {
    const [key, val] = segment.split("=");
    parts[key] = val;
  }

  const rule: RecurrenceRule = {
    freq: (parts.FREQ as RecurrenceRule["freq"]) || "WEEKLY",
    interval: parseInt(parts.INTERVAL || "1"),
  };

  if (parts.BYDAY) {
    rule.byDay = parts.BYDAY.split(",");
  }
  if (parts.BYMONTHDAY) {
    rule.byMonthDay = parseInt(parts.BYMONTHDAY);
  }
  if (parts.UNTIL) {
    rule.until = new Date(parts.UNTIL);
  }
  if (parts.COUNT) {
    rule.count = parseInt(parts.COUNT);
  }

  return rule;
}

export function buildRRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`, `INTERVAL=${rule.interval}`];

  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(",")}`);
  }
  if (rule.byMonthDay !== undefined) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  }
  if (rule.until) {
    parts.push(`UNTIL=${rule.until.toISOString()}`);
  }
  if (rule.count !== undefined) {
    parts.push(`COUNT=${rule.count}`);
  }

  return parts.join(";");
}

export interface GeneratedInstance {
  startDateTime: Date;
  endDateTime: Date;
}

/**
 * Generate all instances of a recurring event between the start date and the recurrence end date.
 * The first instance is the original event itself.
 * Max 200 instances to prevent runaway generation.
 */
export function generateInstances(
  startDateTime: Date,
  endDateTime: Date,
  rrule: string,
  recurrenceEndDate: Date,
  excludedDates?: Set<string> // ISO date strings (YYYY-MM-DD)
): GeneratedInstance[] {
  const rule = parseRRule(rrule);
  const duration = endDateTime.getTime() - startDateTime.getTime();
  const instances: GeneratedInstance[] = [];
  const maxInstances = rule.count || 200;

  let current = new Date(startDateTime);

  while (current <= recurrenceEndDate && instances.length < maxInstances) {
    const dateKey = current.toISOString().split("T")[0];

    if (!excludedDates || !excludedDates.has(dateKey)) {
      if (rule.freq === "WEEKLY" && rule.byDay && rule.byDay.length > 0) {
        // For weekly with specific days, check if current day matches
        const dayOfWeek = current.getDay();
        const dayAbbr = Object.entries(DAY_MAP).find(
          ([, v]) => v === dayOfWeek
        )?.[0];
        if (dayAbbr && rule.byDay.includes(dayAbbr)) {
          instances.push({
            startDateTime: new Date(current),
            endDateTime: new Date(current.getTime() + duration),
          });
        }
      } else if (rule.freq === "MONTHLY" && rule.byMonthDay !== undefined) {
        if (current.getDate() === rule.byMonthDay) {
          instances.push({
            startDateTime: new Date(current),
            endDateTime: new Date(current.getTime() + duration),
          });
        }
      } else {
        instances.push({
          startDateTime: new Date(current),
          endDateTime: new Date(current.getTime() + duration),
        });
      }
    }

    // Advance to next occurrence
    current = advanceDate(current, rule);
  }

  return instances;
}

function advanceDate(date: Date, rule: RecurrenceRule): Date {
  const next = new Date(date);

  switch (rule.freq) {
    case "DAILY":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "WEEKLY":
      if (rule.byDay && rule.byDay.length > 0) {
        // Move to next day, then check if it's a matching day
        next.setDate(next.getDate() + 1);
        // If we've gone past all days in this week, skip to next interval week
        const startDayOfWeek = date.getDay();
        const nextDayOfWeek = next.getDay();
        if (nextDayOfWeek < startDayOfWeek || (nextDayOfWeek === 0 && startDayOfWeek !== 0)) {
          // Wrapped to next week
          if (rule.interval > 1) {
            next.setDate(next.getDate() + 7 * (rule.interval - 1));
          }
        }
      } else {
        next.setDate(next.getDate() + 7 * rule.interval);
      }
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + rule.interval);
      break;
  }

  return next;
}

/**
 * Human-readable description of a recurrence rule.
 */
export function describeRRule(rrule: string): string {
  const rule = parseRRule(rrule);
  const dayNames: Record<string, string> = {
    MO: "Monday",
    TU: "Tuesday",
    WE: "Wednesday",
    TH: "Thursday",
    FR: "Friday",
    SA: "Saturday",
    SU: "Sunday",
  };

  switch (rule.freq) {
    case "DAILY":
      return rule.interval === 1 ? "Every day" : `Every ${rule.interval} days`;
    case "WEEKLY":
      if (rule.byDay && rule.byDay.length > 0) {
        const days = rule.byDay.map((d) => dayNames[d] || d).join(", ");
        return rule.interval === 1
          ? `Weekly on ${days}`
          : `Every ${rule.interval} weeks on ${days}`;
      }
      return rule.interval === 1 ? "Every week" : `Every ${rule.interval} weeks`;
    case "MONTHLY":
      return rule.interval === 1 ? "Every month" : `Every ${rule.interval} months`;
    default:
      return rrule;
  }
}
