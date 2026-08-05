import { describe, it, expect } from "vitest";
import {
  parseRRule,
  buildRRule,
  generateInstances,
  describeRRule,
  getOrdinalOfDayInMonth,
} from "@/lib/recurrence";

describe("parseRRule", () => {
  it("parses a daily rule", () => {
    const rule = parseRRule("FREQ=DAILY;INTERVAL=1");
    expect(rule.freq).toBe("DAILY");
    expect(rule.interval).toBe(1);
  });

  it("parses a weekly rule with BYDAY", () => {
    const rule = parseRRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR");
    expect(rule.freq).toBe("WEEKLY");
    expect(rule.interval).toBe(1);
    expect(rule.byDay).toEqual(["MO", "WE", "FR"]);
  });

  it("parses a bi-weekly rule", () => {
    const rule = parseRRule("FREQ=WEEKLY;INTERVAL=2");
    expect(rule.freq).toBe("WEEKLY");
    expect(rule.interval).toBe(2);
    expect(rule.byDay).toBeUndefined();
  });

  it("parses a monthly rule with BYMONTHDAY", () => {
    const rule = parseRRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15");
    expect(rule.freq).toBe("MONTHLY");
    expect(rule.byMonthDay).toBe(15);
  });

  it("parses COUNT", () => {
    const rule = parseRRule("FREQ=DAILY;INTERVAL=1;COUNT=5");
    expect(rule.count).toBe(5);
  });

  it("defaults to WEEKLY and interval 1 when missing", () => {
    const rule = parseRRule("BYDAY=MO");
    expect(rule.freq).toBe("WEEKLY");
    expect(rule.interval).toBe(1);
  });
});

describe("buildRRule", () => {
  it("builds a simple daily rule", () => {
    expect(buildRRule({ freq: "DAILY", interval: 1 })).toBe(
      "FREQ=DAILY;INTERVAL=1"
    );
  });

  it("builds a weekly rule with BYDAY", () => {
    const rrule = buildRRule({
      freq: "WEEKLY",
      interval: 1,
      byDay: ["MO", "WE", "FR"],
    });
    expect(rrule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR");
  });

  it("builds a monthly rule with BYMONTHDAY", () => {
    const rrule = buildRRule({
      freq: "MONTHLY",
      interval: 1,
      byMonthDay: 15,
    });
    expect(rrule).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15");
  });

  it("roundtrips through parse and build", () => {
    const original = "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH";
    const rebuilt = buildRRule(parseRRule(original));
    expect(rebuilt).toBe(original);
  });
});

describe("generateInstances", () => {
  it("generates daily instances", () => {
    const start = new Date("2026-03-01T09:00:00");
    const end = new Date("2026-03-01T10:00:00");
    const recEnd = new Date("2026-03-05T23:59:59");

    const instances = generateInstances(start, end, "FREQ=DAILY;INTERVAL=1", recEnd);

    expect(instances.length).toBe(5); // Mar 1-5
    expect(instances[0].startDateTime).toEqual(start);
    // Each instance should be 1 hour long
    for (const inst of instances) {
      const duration = inst.endDateTime.getTime() - inst.startDateTime.getTime();
      expect(duration).toBe(60 * 60 * 1000);
    }
  });

  it("generates weekly instances", () => {
    const start = new Date("2026-03-02T14:00:00"); // Monday
    const end = new Date("2026-03-02T16:00:00");
    const recEnd = new Date("2026-03-23T23:59:59");

    const instances = generateInstances(start, end, "FREQ=WEEKLY;INTERVAL=1", recEnd);

    expect(instances.length).toBe(4); // 4 Mondays: Mar 2, 9, 16, 23
    // Each should be on a Monday
    for (const inst of instances) {
      expect(inst.startDateTime.getDay()).toBe(1); // Monday
    }
  });

  it("generates bi-weekly instances", () => {
    const start = new Date("2026-03-02T09:00:00"); // Monday
    const end = new Date("2026-03-02T10:00:00");
    const recEnd = new Date("2026-04-13T23:59:59");

    const instances = generateInstances(start, end, "FREQ=WEEKLY;INTERVAL=2", recEnd);

    expect(instances.length).toBe(4); // Mar 2, Mar 16, Mar 30, Apr 13
  });

  it("generates weekly instances with specific BYDAY", () => {
    const start = new Date("2026-03-02T09:00:00"); // Monday
    const end = new Date("2026-03-02T10:00:00");
    const recEnd = new Date("2026-03-08T23:59:59"); // Sunday

    const instances = generateInstances(
      start,
      end,
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      recEnd
    );

    // Should get Mon Mar 2, Wed Mar 4, Fri Mar 6
    expect(instances.length).toBe(3);
    expect(instances[0].startDateTime.getDay()).toBe(1); // Monday
    expect(instances[1].startDateTime.getDay()).toBe(3); // Wednesday
    expect(instances[2].startDateTime.getDay()).toBe(5); // Friday
  });

  it("generates monthly instances", () => {
    const start = new Date("2026-01-15T10:00:00");
    const end = new Date("2026-01-15T11:00:00");
    const recEnd = new Date("2026-06-30T23:59:59");

    const instances = generateInstances(start, end, "FREQ=MONTHLY;INTERVAL=1", recEnd);

    expect(instances.length).toBe(6); // Jan-Jun
  });

  it("clamps monthly recurrence on the 31st to end-of-month", () => {
    // Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31
    const start = new Date("2026-01-31T10:00:00");
    const end = new Date("2026-01-31T11:00:00");
    const recEnd = new Date("2026-05-31T23:59:59");

    const instances = generateInstances(start, end, "FREQ=MONTHLY;INTERVAL=1", recEnd);

    expect(instances.length).toBe(5);
    expect(instances[0].startDateTime.getDate()).toBe(31); // Jan 31
    expect(instances[1].startDateTime.getMonth()).toBe(1);  // February
    expect(instances[1].startDateTime.getDate()).toBe(28);  // Feb 28 (clamped)
    expect(instances[2].startDateTime.getDate()).toBe(31);  // Mar 31 (back to original)
    expect(instances[3].startDateTime.getDate()).toBe(30);  // Apr 30 (clamped)
    expect(instances[4].startDateTime.getDate()).toBe(31);  // May 31 (back to original)
  });

  it("generates monthly instances with BYMONTHDAY", () => {
    const start = new Date("2026-01-01T10:00:00");
    const end = new Date("2026-01-01T11:00:00");
    const recEnd = new Date("2026-03-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15",
      recEnd
    );

    // Should generate Jan 15, Feb 15, Mar 15
    expect(instances.length).toBe(3);
    for (const inst of instances) {
      expect(inst.startDateTime.getDate()).toBe(15);
    }
    expect(instances[0].startDateTime.getMonth()).toBe(0); // January
    expect(instances[1].startDateTime.getMonth()).toBe(1); // February
    expect(instances[2].startDateTime.getMonth()).toBe(2); // March
  });

  it("generates BYMONTHDAY instances when start day matches byMonthDay", () => {
    const start = new Date("2026-01-15T10:00:00");
    const end = new Date("2026-01-15T11:00:00");
    const recEnd = new Date("2026-03-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15",
      recEnd
    );

    expect(instances.length).toBe(3);
    for (const inst of instances) {
      expect(inst.startDateTime.getDate()).toBe(15);
    }
  });

  it("generates BYMONTHDAY instances when start day is after byMonthDay", () => {
    // Start Jan 20, byMonthDay=15 → first instance is Feb 15
    const start = new Date("2026-01-20T10:00:00");
    const end = new Date("2026-01-20T11:00:00");
    const recEnd = new Date("2026-04-30T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15",
      recEnd
    );

    expect(instances.length).toBe(3); // Feb 15, Mar 15, Apr 15
    expect(instances[0].startDateTime.getMonth()).toBe(1); // February
    for (const inst of instances) {
      expect(inst.startDateTime.getDate()).toBe(15);
    }
  });

  it("respects COUNT limit", () => {
    const start = new Date("2026-03-01T09:00:00");
    const end = new Date("2026-03-01T10:00:00");
    const recEnd = new Date("2026-12-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=DAILY;INTERVAL=1;COUNT=3",
      recEnd
    );

    expect(instances.length).toBe(3);
  });

  it("excludes specific dates", () => {
    const start = new Date("2026-03-01T09:00:00");
    const end = new Date("2026-03-01T10:00:00");
    const recEnd = new Date("2026-03-05T23:59:59");
    const excluded = new Set(["2026-03-03"]);

    const instances = generateInstances(
      start,
      end,
      "FREQ=DAILY;INTERVAL=1",
      recEnd,
      excluded
    );

    expect(instances.length).toBe(4); // 5 days minus 1 excluded
    const dates = instances.map((i) => i.startDateTime.getDate());
    expect(dates).not.toContain(3);
  });

  it("caps at 200 instances maximum", () => {
    const start = new Date("2026-01-01T09:00:00");
    const end = new Date("2026-01-01T10:00:00");
    const recEnd = new Date("2030-12-31T23:59:59"); // 5 years of daily events

    const instances = generateInstances(start, end, "FREQ=DAILY;INTERVAL=1", recEnd);

    expect(instances.length).toBe(200);
  });

  it("preserves event duration across instances", () => {
    const start = new Date("2026-03-01T09:00:00");
    const end = new Date("2026-03-01T11:30:00"); // 2.5 hours
    const recEnd = new Date("2026-03-03T23:59:59");
    const expectedDuration = 2.5 * 60 * 60 * 1000;

    const instances = generateInstances(start, end, "FREQ=DAILY;INTERVAL=1", recEnd);

    for (const inst of instances) {
      const dur = inst.endDateTime.getTime() - inst.startDateTime.getTime();
      expect(dur).toBe(expectedDuration);
    }
  });

  it("returns empty array when start is after recurrence end", () => {
    const start = new Date("2026-04-01T09:00:00");
    const end = new Date("2026-04-01T10:00:00");
    const recEnd = new Date("2026-03-01T23:59:59");

    const instances = generateInstances(start, end, "FREQ=DAILY;INTERVAL=1", recEnd);
    expect(instances.length).toBe(0);
  });
});

describe("describeRRule", () => {
  it("describes daily recurrence", () => {
    expect(describeRRule("FREQ=DAILY;INTERVAL=1")).toBe("Every day");
    expect(describeRRule("FREQ=DAILY;INTERVAL=3")).toBe("Every 3 days");
  });

  it("describes weekly recurrence", () => {
    expect(describeRRule("FREQ=WEEKLY;INTERVAL=1")).toBe("Every week");
    expect(describeRRule("FREQ=WEEKLY;INTERVAL=2")).toBe("Every 2 weeks");
  });

  it("describes weekly with specific days", () => {
    expect(describeRRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR")).toBe(
      "Weekly on Monday, Wednesday, Friday"
    );
    expect(describeRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH")).toBe(
      "Every 2 weeks on Tuesday, Thursday"
    );
  });

  it("describes monthly recurrence", () => {
    expect(describeRRule("FREQ=MONTHLY;INTERVAL=1")).toBe("Every month");
    expect(describeRRule("FREQ=MONTHLY;INTERVAL=3")).toBe("Every 3 months");
  });

  it("describes monthly-by-day-of-week recurrence", () => {
    expect(describeRRule("FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU")).toBe(
      "Monthly on the 2nd Tuesday"
    );
    expect(describeRRule("FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO")).toBe(
      "Monthly on the 1st Monday"
    );
    expect(describeRRule("FREQ=MONTHLY;INTERVAL=1;BYDAY=3FR")).toBe(
      "Monthly on the 3rd Friday"
    );
    expect(describeRRule("FREQ=MONTHLY;INTERVAL=2;BYDAY=4TH")).toBe(
      "Every 2 months on the 4th Thursday"
    );
  });
});

describe("getOrdinalOfDayInMonth", () => {
  it("returns correct ordinal for various dates", () => {
    // March 3, 2026 is a Tuesday — 1st Tuesday
    expect(getOrdinalOfDayInMonth(new Date("2026-03-03T10:00:00"))).toBe(1);
    // March 10, 2026 is a Tuesday — 2nd Tuesday
    expect(getOrdinalOfDayInMonth(new Date("2026-03-10T10:00:00"))).toBe(2);
    // March 17, 2026 is a Tuesday — 3rd Tuesday
    expect(getOrdinalOfDayInMonth(new Date("2026-03-17T10:00:00"))).toBe(3);
    // March 24, 2026 is a Tuesday — 4th Tuesday
    expect(getOrdinalOfDayInMonth(new Date("2026-03-24T10:00:00"))).toBe(4);
    // March 1, 2026 is a Sunday — 1st Sunday
    expect(getOrdinalOfDayInMonth(new Date("2026-03-01T10:00:00"))).toBe(1);
  });
});

describe("generateInstances - MonthlyByDayOfWeek", () => {
  it("generates 2nd Tuesday of every month", () => {
    // March 10, 2026 is the 2nd Tuesday
    const start = new Date("2026-03-10T10:00:00");
    const end = new Date("2026-03-10T11:00:00");
    const recEnd = new Date("2026-07-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU",
      recEnd
    );

    // Mar 10, Apr 14, May 12, Jun 9, Jul 14
    expect(instances.length).toBe(5);
    for (const inst of instances) {
      expect(inst.startDateTime.getDay()).toBe(2); // Tuesday
      const ordinal = Math.floor((inst.startDateTime.getDate() - 1) / 7) + 1;
      expect(ordinal).toBe(2); // 2nd occurrence
    }
  });

  it("generates 1st Monday of every month", () => {
    const start = new Date("2026-01-05T09:00:00"); // 1st Monday Jan 2026
    const end = new Date("2026-01-05T10:00:00");
    const recEnd = new Date("2026-04-30T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO",
      recEnd
    );

    // Jan 5, Feb 2, Mar 2, Apr 6
    expect(instances.length).toBe(4);
    for (const inst of instances) {
      expect(inst.startDateTime.getDay()).toBe(1); // Monday
      expect(inst.startDateTime.getDate()).toBeLessThanOrEqual(7); // 1st occurrence
    }
  });

  it("generates 3rd Friday of every month", () => {
    const start = new Date("2026-01-16T14:00:00"); // 3rd Friday Jan 2026
    const end = new Date("2026-01-16T15:00:00");
    const recEnd = new Date("2026-03-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=3FR",
      recEnd
    );

    // Jan 16, Feb 20, Mar 20
    expect(instances.length).toBe(3);
    for (const inst of instances) {
      expect(inst.startDateTime.getDay()).toBe(5); // Friday
      const ordinal = Math.floor((inst.startDateTime.getDate() - 1) / 7) + 1;
      expect(ordinal).toBe(3);
    }
  });

  it("preserves time-of-day for monthly-dow", () => {
    const start = new Date("2026-03-10T14:30:00"); // 2nd Tuesday
    const end = new Date("2026-03-10T16:00:00");
    const recEnd = new Date("2026-05-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU",
      recEnd
    );

    for (const inst of instances) {
      expect(inst.startDateTime.getHours()).toBe(14);
      expect(inst.startDateTime.getMinutes()).toBe(30);
    }
  });

  it("skips months where the ordinal occurrence doesn't exist", () => {
    // 5th Tuesday - only some months have this
    // Not all months have a 5th Tuesday, but the generator should handle it
    const start = new Date("2026-01-01T10:00:00");
    const end = new Date("2026-01-01T11:00:00");
    const recEnd = new Date("2026-12-31T23:59:59");

    // EWL blocks 5th occurrences, but our engine gracefully skips them
    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=5TU",
      recEnd
    );

    // Only months with a 5th Tuesday get instances
    for (const inst of instances) {
      expect(inst.startDateTime.getDay()).toBe(2); // Tuesday
      expect(inst.startDateTime.getDate()).toBeGreaterThan(28); // 5th occurrence = day 29+
    }
  });

  it("respects excludedDates for monthly-dow", () => {
    const start = new Date("2026-03-10T10:00:00");
    const end = new Date("2026-03-10T11:00:00");
    const recEnd = new Date("2026-06-30T23:59:59");
    const excluded = new Set(["2026-04-14"]); // Exclude April's 2nd Tuesday

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU",
      recEnd,
      excluded
    );

    // Mar, May, Jun (April excluded)
    expect(instances.length).toBe(3);
    const months = instances.map((i) => i.startDateTime.getMonth());
    expect(months).not.toContain(3); // April excluded
  });

  it("handles interval > 1 for monthly-dow", () => {
    const start = new Date("2026-01-05T10:00:00"); // 1st Monday
    const end = new Date("2026-01-05T11:00:00");
    const recEnd = new Date("2026-12-31T23:59:59");

    const instances = generateInstances(
      start,
      end,
      "FREQ=MONTHLY;INTERVAL=2;BYDAY=1MO",
      recEnd
    );

    // Jan, Mar, May, Jul, Sep, Nov
    expect(instances.length).toBe(6);
    const months = instances.map((i) => i.startDateTime.getMonth());
    expect(months).toEqual([0, 2, 4, 6, 8, 10]); // Even months (0-indexed)
  });
});
