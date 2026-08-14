import { describe, it, expect } from "vitest";
import {
  clock,
  orgNow,
  buildFacultyCards,
  declaredPresence,
  type RawRecord,
} from "@/lib/office-hours";

describe("clock", () => {
  it("formats minute-of-day as 12-hour with meridiem", () => {
    expect(clock(0)).toBe("12:00am");
    expect(clock(540)).toBe("9:00am");
    expect(clock(570)).toBe("9:30am");
    expect(clock(720)).toBe("12:00pm");
    expect(clock(780)).toBe("1:00pm");
  });
});

describe("orgNow", () => {
  it("maps a UTC instant to org-local weekday token + minute", () => {
    // 2026-08-14 is a Friday; 13:00Z = 09:00 EDT (UTC-4)
    const now = new Date("2026-08-14T13:00:00Z");
    expect(orgNow("America/New_York", now)).toEqual({ dayToken: "F", minute: 540 });
  });
  it("returns an empty token on weekends (no weekday hours)", () => {
    const sat = new Date("2026-08-15T16:00:00Z");
    expect(orgNow("America/New_York", sat).dayToken).toBe("");
  });
});

describe("buildFacultyCards — the live dial is enforced here", () => {
  const recs: RawRecord[] = [
    { userId: "a", live: true, note: "", blocks: [block("F", 540, 600, "5305")] },
    { userId: "b", live: false, note: "", blocks: [block("F", 540, 600, "5312")] },
    { userId: "c", live: true, note: "", blocks: [block("M", 540, 600, "5300")] },
  ];
  const nameOf = (id: string) => ({ a: "Ana", b: "Bo", c: "Cy" })[id]!;
  const cards = buildFacultyCards(recs, nameOf, "F", 550);

  it("broadcasts the room when live is on", () => {
    expect(cards.find((c) => c.name === "Ana")!.openNow).toEqual({
      room: "5305",
      end: "10:00am",
    });
  });

  it("WITHHOLDS the room when live is off, but still shows open-now", () => {
    const bo = cards.find((c) => c.name === "Bo")!;
    expect(bo.openNow).toEqual({ room: null, end: "10:00am" });
  });

  it("shows next (not open) for a different weekday", () => {
    const cy = cards.find((c) => c.name === "Cy")!;
    expect(cy.openNow).toBeNull();
    expect(cy.next).toEqual({ day: "M", start: "9:00am" });
  });

  it("sorts open-now first, then alphabetical", () => {
    expect(cards.map((c) => c.name)).toEqual(["Ana", "Bo", "Cy"]);
  });
});

describe("declaredPresence — in-person only, its own series", () => {
  const recs = [
    { blocks: [block("F", 540, 600, "x", "in-person")] },
    { blocks: [block("F", 570, 630, "y", "in-person")] }, // overlaps 570–600
    { blocks: [block("F", 540, 600, "z", "virtual")] }, // excluded
    { blocks: [block("M", 540, 600, "w", "in-person")] },
  ];
  const d = declaredPresence(recs);

  it("counts peak simultaneous in-person, excluding virtual", () => {
    expect(d.perDay["F"].peak).toBe(2);
    expect(d.perDay["F"].atClock).toBe("9:30am");
    expect(d.perDay["M"].peak).toBe(1);
    expect(d.perDay["T"].peak).toBe(0);
    expect(d.peakOverall).toBe(2);
  });
});

function block(
  day: string,
  startMin: number,
  endMin: number,
  roomSlug: string,
  mode = "in-person",
) {
  return { day, startMin, endMin, roomSlug, mode };
}
