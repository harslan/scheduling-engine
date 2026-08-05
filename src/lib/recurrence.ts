/**
 * Recurrence rule utilities.
 * Generates event instances from an iCal-like RRULE string.
 *
 * Supported rules:
 *   FREQ=DAILY;INTERVAL=1
 *   FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR
 *   FREQ=WEEKLY;INTERVAL=2
 *   FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15
 *   FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU          (2nd Tuesday of every month)
 *   FREQ=MONTHLY;INTERVAL=1  (uses start date's day-of-month)
 */

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byDay?: string[]; // MO, TU, WE, TH, FR, SA, SU — or "2TU" (ordinal prefix) for monthly
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

/**
 * Parse an ordinal BYDAY value like "2TU" into { ordinal: 2, day: "TU" }.
 * Returns null if the value has no ordinal prefix (plain "TU").
 */
function parseOrdinalByDay(value: string): { ordinal: number; day: string } | null {
  const match = value.match(/^(\d)([A-Z]{2})$/);
  if (!match) return null;
  return { ordinal: parseInt(match[1]), day: match[2] };
}

/**
 * Find the nth occurrence of a day-of-week in a given month.
 * ordinal: 1=first, 2=second, 3=third, 4=fourth
 * Returns null if the month doesn't have that many occurrences (e.g., 5th Tuesday).
 */
function getNthDayOfWeekInMonth(year: number, month: number, dayOfWeek: number, ordinal: number): Date | null {
  // Find the first occurrence of this day in the month
  const first = new Date(year, month, 1);
  let firstOccurrence = first.getDay();
  let dayOffset = dayOfWeek - firstOccurrence;
  if (dayOffset < 0) dayOffset += 7;
  const firstDate = 1 + dayOffset;
  const targetDate = firstDate + (ordinal - 1) * 7;
  // Check if this date is still in the same month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (targetDate > daysInMonth) return null;
  return new Date(year, month, targetDate);
}

/**
 * Determine which occurrence (1-based) of its day-of-week a date is within its month.
 * e.g., March 10, 2026 (Tuesday) → 2nd Tuesday → returns 2
 */
export function getOrdinalOfDayInMonth(date: Date): number {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

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
  const originalDayOfMonth = startDateTime.getDate();

  // Detect monthly-by-day-of-week pattern (e.g., FREQ=MONTHLY;BYDAY=2TU)
  const monthlyByDow = rule.freq === "MONTHLY" && rule.byDay && rule.byDay.length === 1
    ? parseOrdinalByDay(rule.byDay[0])
    : null;

  if (monthlyByDow) {
    // Monthly by day-of-week: find the nth weekday in each month
    const dayOfWeek = DAY_MAP[monthlyByDow.day];
    if (dayOfWeek === undefined) return instances;

    // Start from the month of startDateTime
    let year = current.getFullYear();
    let month = current.getMonth();
    const timeOfDay = current.getHours() * 3600000 + current.getMinutes() * 60000 +
      current.getSeconds() * 1000 + current.getMilliseconds();

    while (instances.length < maxInstances) {
      const target = getNthDayOfWeekInMonth(year, month, dayOfWeek, monthlyByDow.ordinal);
      if (target) {
        const instStart = new Date(target.getTime() + timeOfDay);
        if (instStart > recurrenceEndDate) break;
        if (instStart >= startDateTime) {
          const dateKey = instStart.toISOString().split("T")[0];
          if (!excludedDates || !excludedDates.has(dateKey)) {
            instances.push({
              startDateTime: instStart,
              endDateTime: new Date(instStart.getTime() + duration),
            });
          }
        }
      }
      // Advance to next month
      month += rule.interval;
      if (month > 11) {
        year += Math.floor(month / 12);
        month = month % 12;
      }
    }
  } else {
    // For MONTHLY with BYMONTHDAY, reposition current to the target day
    if (rule.freq === "MONTHLY" && rule.byMonthDay !== undefined) {
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      current.setDate(Math.min(rule.byMonthDay, daysInMonth));
      // If the target day is before the start date, advance to next month
      if (current < startDateTime) {
        current = advanceDate(current, rule, originalDayOfMonth);
      }
    }

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
        } else {
          instances.push({
            startDateTime: new Date(current),
            endDateTime: new Date(current.getTime() + duration),
          });
        }
      }

      // Advance to next occurrence
      current = advanceDate(current, rule, originalDayOfMonth);
    }
  }

  return instances;
}

function advanceDate(date: Date, rule: RecurrenceRule, originalDayOfMonth?: number): Date {
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
    case "MONTHLY": {
      // Use byMonthDay if set, otherwise the original start day to avoid "sticky" clamping
      // (e.g., Jan 31 → Feb 28 → Mar 31, not Mar 28)
      const targetDay = rule.byMonthDay ?? originalDayOfMonth ?? date.getDate();
      next.setDate(1); // Avoid overflow when setting month (e.g., Jan 31 + 1 month)
      next.setMonth(next.getMonth() + rule.interval);
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDay, daysInMonth));
      break;
    }
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
    case "MONTHLY": {
      // Check for monthly-by-day-of-week (e.g., BYDAY=2TU)
      if (rule.byDay && rule.byDay.length === 1) {
        const parsed = parseOrdinalByDay(rule.byDay[0]);
        if (parsed) {
          const ordinalNames: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };
          const ordLabel = ordinalNames[parsed.ordinal] || `${parsed.ordinal}th`;
          const dayLabel = dayNames[parsed.day] || parsed.day;
          return rule.interval === 1
            ? `Monthly on the ${ordLabel} ${dayLabel}`
            : `Every ${rule.interval} months on the ${ordLabel} ${dayLabel}`;
        }
      }
      return rule.interval === 1 ? "Every month" : `Every ${rule.interval} months`;
    }
    default:
      return rrule;
  }
}
