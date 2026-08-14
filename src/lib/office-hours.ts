/**
 * Pure office-hours logic, shared by the public API, the Dean's brief panel,
 * and the tests. No Prisma, no I/O — just the honest transforms:
 *   - "open now / next" from declared blocks, in the org's timezone;
 *   - the declared-presence coverage instrument (in-person only, a FLOOR that
 *     grows), which converts the demand model's first NOT-MODELED blind spot
 *     (office hours) into measured, faculty-signed presence.
 */

export const DAY_ORDER = ["M", "T", "W", "TH", "F"] as const;
export type DayToken = (typeof DAY_ORDER)[number];

const WEEKDAY_TO_TOKEN: Record<string, string> = {
  Mon: "M",
  Tue: "T",
  Wed: "W",
  Thu: "TH",
  Fri: "F",
};

const SLOT = 15; // minutes — the demand model's presence-curve resolution

/** Current weekday token + minute-of-day in the org timezone (Sat/Sun → ""). */
export function orgNow(
  timeZone: string,
  now: Date = new Date(),
): { dayToken: string; minute: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return {
    dayToken: WEEKDAY_TO_TOKEN[p.weekday] ?? "",
    minute: (Number(p.hour) % 24) * 60 + Number(p.minute),
  };
}

export function clock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

export function dayIndex(d: string): number {
  const i = DAY_ORDER.indexOf(d as DayToken);
  return i === -1 ? 99 : i;
}

export interface RawBlock {
  day: string;
  startMin: number;
  endMin: number;
  roomSlug: string;
  mode: string;
}
export interface RawRecord {
  userId: string;
  live: boolean;
  note: string;
  blocks: RawBlock[];
}

export interface FacultyCard {
  name: string;
  note: string;
  live: boolean;
  blocks: { day: string; start: string; end: string; room: string; mode: string }[];
  openNow: { room: string | null; end: string } | null;
  next: { day: string; start: string } | null;
}

/** Build the student-facing cards. `live` is honored here: with it off, the
 *  open-now room is withheld, so a private location never leaves the server. */
export function buildFacultyCards(
  records: RawRecord[],
  nameOf: (userId: string) => string,
  dayToken: string,
  minute: number,
): FacultyCard[] {
  const todayIndex = dayIndex(dayToken);

  const cards = records
    // A record with no blocks is not "published nothing" — it's absent.
    .filter((oh) => oh.blocks.length > 0)
    .map((oh) => {
      const blocks = [...oh.blocks].sort(
        (a, b) => dayIndex(a.day) - dayIndex(b.day) || a.startMin - b.startMin,
      );
      const openBlock = blocks.find(
        (b) => b.day === dayToken && b.startMin <= minute && minute < b.endMin,
      );
      const nextBlock =
        blocks.find(
          (b) => dayIndex(b.day) > todayIndex || (b.day === dayToken && b.startMin > minute),
        ) ?? blocks[0];

      return {
        name: nameOf(oh.userId),
        note: oh.note,
        live: oh.live,
        blocks: blocks.map((b) => ({
          day: b.day,
          start: clock(b.startMin),
          end: clock(b.endMin),
          room: b.roomSlug,
          mode: b.mode,
        })),
        openNow: openBlock
          ? { room: oh.live ? openBlock.roomSlug : null, end: clock(openBlock.endMin) }
          : null,
        next: nextBlock ? { day: nextBlock.day, start: clock(nextBlock.startMin) } : null,
      };
    });

  // Open-now first, then alphabetical — the person you can see now leads.
  cards.sort((a, b) => {
    if (!!a.openNow !== !!b.openNow) return a.openNow ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return cards;
}

export interface DeclaredPresence {
  perDay: Record<string, { peak: number; atClock: string | null }>;
  peakOverall: number;
}

/**
 * Peak simultaneous IN-PERSON declared office hours per weekday. Virtual blocks
 * are excluded — they serve students but occupy no office. This is reported as
 * its own series, NEVER summed into the buffer estimate (overlap would
 * double-count), and always alongside coverage: a floor that grows, not a total.
 */
export function declaredPresence(records: { blocks: RawBlock[] }[]): DeclaredPresence {
  const perDay: Record<string, { peak: number; atClock: string | null }> = {};
  let peakOverall = 0;

  for (const day of DAY_ORDER) {
    const counts = new Map<number, number>();
    for (const rec of records) {
      for (const b of rec.blocks) {
        if (b.day !== day || b.mode !== "in-person") continue;
        const first = Math.floor(b.startMin / SLOT);
        const last = Math.ceil(b.endMin / SLOT);
        for (let s = first; s < last; s++) counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    let peak = 0;
    let at: number | null = null;
    for (const [slot, c] of counts) {
      if (c > peak || (c === peak && at !== null && slot * SLOT < at)) {
        peak = c;
        at = slot * SLOT;
      }
    }
    perDay[day] = { peak, atClock: at === null ? null : clock(at) };
    peakOverall = Math.max(peakOverall, peak);
  }

  return { perDay, peakOverall };
}
