import { describe, it, expect } from "vitest";
import { wallTimeToUtc, utcToWallTime, orgDayBounds } from "@/lib/orgtime";

const NY = "America/New_York";

describe("wallTimeToUtc", () => {
  it("parses EDT wall time to the true instant", () => {
    // 10:00 AM in Boston on Aug 6 2026 is 14:00 UTC (EDT = UTC-4)
    expect(wallTimeToUtc("2026-08-06T10:00", NY).toISOString()).toBe(
      "2026-08-06T14:00:00.000Z",
    );
  });

  it("parses EST wall time to the true instant", () => {
    // 10:00 AM in Boston on Dec 1 2026 is 15:00 UTC (EST = UTC-5)
    expect(wallTimeToUtc("2026-12-01T10:00", NY).toISOString()).toBe(
      "2026-12-01T15:00:00.000Z",
    );
  });

  it("handles the fall-back day (Nov 1 2026)", () => {
    // After the 2 AM fall-back, 10:00 is EST
    expect(wallTimeToUtc("2026-11-01T10:00", NY).toISOString()).toBe(
      "2026-11-01T15:00:00.000Z",
    );
    // Before the transition, 00:30 is still EDT
    expect(wallTimeToUtc("2026-11-01T00:30", NY).toISOString()).toBe(
      "2026-11-01T04:30:00.000Z",
    );
  });

  it("resolves inside the nonexistent spring-forward hour without NaN", () => {
    // 2:30 AM on Mar 8 2026 does not exist in NY; must return a valid instant
    const d = wallTimeToUtc("2026-03-08T02:30", NY);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it("accepts seconds and defaults timezone when null", () => {
    expect(wallTimeToUtc("2026-08-06T10:00:00", NY).toISOString()).toBe(
      "2026-08-06T14:00:00.000Z",
    );
    expect(isNaN(wallTimeToUtc("2026-08-06T10:00", null).getTime())).toBe(false);
  });
});

describe("utcToWallTime", () => {
  it("round-trips with wallTimeToUtc", () => {
    for (const wall of ["2026-08-06T10:00", "2026-12-01T09:30", "2026-11-01T13:00"]) {
      expect(utcToWallTime(wallTimeToUtc(wall, NY), NY)).toBe(wall);
    }
  });

  it("renders org-local midnight as 00", () => {
    expect(utcToWallTime(wallTimeToUtc("2026-08-06T00:00", NY), NY)).toBe(
      "2026-08-06T00:00",
    );
  });
});

describe("orgDayBounds", () => {
  it("bounds the org-local day, not the UTC day", () => {
    // 01:00 UTC on Aug 7 is still 9 PM Aug 6 in Boston
    const { start, end } = orgDayBounds(new Date("2026-08-07T01:00:00Z"), NY);
    expect(start.toISOString()).toBe("2026-08-06T04:00:00.000Z"); // Aug 6 00:00 EDT
    expect(end.toISOString()).toBe("2026-08-07T04:00:00.000Z");
  });
});
