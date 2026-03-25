import { describe, it, expect } from "vitest";
import {
  parseRRule,
  buildRRule,
  generateInstances,
  describeRRule,
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

    // Only the 15th of each month should match
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
});
