/**
 * One time convention for the whole product:
 *   - users type WALL-CLOCK time in the org's timezone;
 *   - the database stores TRUE UTC instants;
 *   - every render formats with { timeZone: org.timezone }.
 *
 * Never `new Date("YYYY-MM-DDTHH:mm")` a form value on the server — that
 * parses in the server's timezone (UTC on Vercel) and stores a mislabeled
 * instant that validation and calendar feeds then disagree about.
 */

const DEFAULT_TZ = "America/New_York";

/** Minutes that `timeZone` is ahead of UTC at `instant` (EDT = -240). */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(
    dtf.formatToParts(instant).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Parse a wall-clock string ("2026-08-06T10:00", with optional seconds) as a
 * time in the org's timezone and return the true UTC instant. Handles DST by
 * recomputing the offset once against the first guess; times inside the
 * nonexistent spring-forward hour resolve to the post-transition offset.
 */
export function wallTimeToUtc(wall: string, timeZone?: string | null): Date {
  const tz = timeZone || DEFAULT_TZ;
  const normalized = wall.length === 16 ? `${wall}:00` : wall;
  const pretendUtc = new Date(`${normalized}Z`);
  if (isNaN(pretendUtc.getTime())) return pretendUtc;
  let guess = new Date(
    pretendUtc.getTime() - tzOffsetMinutes(pretendUtc, tz) * 60_000,
  );
  const refined = tzOffsetMinutes(guess, tz);
  if (refined !== tzOffsetMinutes(pretendUtc, tz)) {
    guess = new Date(pretendUtc.getTime() - refined * 60_000);
  }
  return guess;
}

/** The instant's wall-clock in the org timezone as "YYYY-MM-DDTHH:mm" (for
 *  prefilling datetime-local inputs from stored instants). */
export function utcToWallTime(instant: Date, timeZone?: string | null): string {
  const tz = timeZone || DEFAULT_TZ;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  const hour = String(Number(p.hour) % 24).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

/** [start, end) of the org-local calendar day containing `instant`. */
export function orgDayBounds(
  instant: Date,
  timeZone?: string | null,
): { start: Date; end: Date } {
  const tz = timeZone || DEFAULT_TZ;
  const dayStr = instant.toLocaleDateString("en-CA", { timeZone: tz });
  const start = wallTimeToUtc(`${dayStr}T00:00`, tz);
  return { start, end: new Date(start.getTime() + 24 * 3_600_000) };
}
