import { describe, it, expect } from "vitest";
import {
  formatDateForReserve,
  formatTimeForReserve,
  parseReserveDate,
  parseReserveTime,
  combineDateAndTime,
  extractEventUniqueId,
  extractUniqueId,
} from "@/lib/reserve/client";
import type { ReserveGatewayResponse } from "@/lib/reserve/types";

// --------------- extractEventUniqueId ---------------

describe("extractEventUniqueId", () => {
  it("extracts event.uniqueId from a well-formed gateway response", () => {
    const response: ReserveGatewayResponse = {
      results: [
        {
          uniqueIds: {
            "event.uniqueId": "EVT-ABC-123",
            uniqueId: "FN-999",
          },
        },
      ],
    };
    expect(extractEventUniqueId(response)).toBe("EVT-ABC-123");
  });

  it("returns null when results array is empty", () => {
    const response: ReserveGatewayResponse = { results: [] };
    expect(extractEventUniqueId(response)).toBeNull();
  });

  it("returns null when event.uniqueId key is missing", () => {
    const response: ReserveGatewayResponse = {
      results: [{ uniqueIds: { uniqueId: "FN-999" } }],
    };
    expect(extractEventUniqueId(response)).toBeNull();
  });

  it("returns null when results is undefined", () => {
    const response = {} as ReserveGatewayResponse;
    expect(extractEventUniqueId(response)).toBeNull();
  });
});

// --------------- extractUniqueId ---------------

describe("extractUniqueId", () => {
  it("extracts uniqueId from a well-formed gateway response", () => {
    const response: ReserveGatewayResponse = {
      results: [{ uniqueIds: { uniqueId: "ACCT-456" } }],
    };
    expect(extractUniqueId(response)).toBe("ACCT-456");
  });

  it("returns null when results array is empty", () => {
    const response: ReserveGatewayResponse = { results: [] };
    expect(extractUniqueId(response)).toBeNull();
  });

  it("does NOT return event.uniqueId — only uniqueId", () => {
    const response: ReserveGatewayResponse = {
      results: [{ uniqueIds: { "event.uniqueId": "EVT-123" } }],
    };
    expect(extractUniqueId(response)).toBeNull();
  });
});

// --------------- parseReserveDate ---------------

describe("parseReserveDate", () => {
  it("parses a valid M/d/yyyy date", () => {
    const date = parseReserveDate("3/15/2026");
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(2); // March = 2
    expect(date!.getDate()).toBe(15);
    expect(date!.getFullYear()).toBe(2026);
  });

  it("parses MM/dd/yyyy format", () => {
    const date = parseReserveDate("12/01/2025");
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(11);
    expect(date!.getDate()).toBe(1);
  });

  it("returns null for empty string", () => {
    expect(parseReserveDate("")).toBeNull();
  });

  it("returns null for malformed string", () => {
    expect(parseReserveDate("2026-03-15")).toBeNull();
    expect(parseReserveDate("March 15, 2026")).toBeNull();
  });

  it("returns null for year < 2000 (bounds validation)", () => {
    expect(parseReserveDate("1/1/1999")).toBeNull();
    expect(parseReserveDate("6/15/1900")).toBeNull();
  });

  it("returns null for invalid month", () => {
    expect(parseReserveDate("13/1/2026")).toBeNull(); // month 13
    expect(parseReserveDate("0/1/2026")).toBeNull(); // month 0 → -1 after parse
  });

  it("returns null for invalid day", () => {
    expect(parseReserveDate("1/0/2026")).toBeNull();
    expect(parseReserveDate("1/32/2026")).toBeNull();
  });

  it("accepts year 2000 as minimum", () => {
    const date = parseReserveDate("1/1/2000");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2000);
  });
});

// --------------- parseReserveTime ---------------

describe("parseReserveTime", () => {
  it("parses AM time", () => {
    const time = parseReserveTime("9:30 AM");
    expect(time).toEqual({ hours: 9, minutes: 30 });
  });

  it("parses PM time", () => {
    const time = parseReserveTime("2:15 PM");
    expect(time).toEqual({ hours: 14, minutes: 15 });
  });

  it("handles 12:00 PM (noon)", () => {
    const time = parseReserveTime("12:00 PM");
    expect(time).toEqual({ hours: 12, minutes: 0 });
  });

  it("handles 12:00 AM (midnight)", () => {
    const time = parseReserveTime("12:00 AM");
    expect(time).toEqual({ hours: 0, minutes: 0 });
  });

  it("returns null for empty string", () => {
    expect(parseReserveTime("")).toBeNull();
  });

  it("returns null for 24-hour format", () => {
    expect(parseReserveTime("14:30")).toBeNull();
  });
});

// --------------- formatDateForReserve ---------------

describe("formatDateForReserve", () => {
  it("formats as M/d/yyyy without zero-padding", () => {
    const date = new Date(2026, 2, 5); // March 5, 2026
    expect(formatDateForReserve(date)).toBe("3/5/2026");
  });

  it("formats double-digit month and day", () => {
    const date = new Date(2026, 11, 25); // Dec 25, 2026
    expect(formatDateForReserve(date)).toBe("12/25/2026");
  });
});

// --------------- formatTimeForReserve ---------------

describe("formatTimeForReserve", () => {
  it("formats AM time", () => {
    const date = new Date(2026, 0, 1, 9, 5);
    expect(formatTimeForReserve(date)).toBe("9:05 AM");
  });

  it("formats PM time", () => {
    const date = new Date(2026, 0, 1, 14, 30);
    expect(formatTimeForReserve(date)).toBe("2:30 PM");
  });

  it("formats noon", () => {
    const date = new Date(2026, 0, 1, 12, 0);
    expect(formatTimeForReserve(date)).toBe("12:00 PM");
  });

  it("formats midnight", () => {
    const date = new Date(2026, 0, 1, 0, 0);
    expect(formatTimeForReserve(date)).toBe("12:00 AM");
  });
});

// --------------- combineDateAndTime ---------------

describe("combineDateAndTime", () => {
  it("combines date and time string", () => {
    const date = new Date(2026, 2, 15);
    const result = combineDateAndTime(date, "2:30 PM");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it("returns null for invalid time string", () => {
    const date = new Date(2026, 2, 15);
    expect(combineDateAndTime(date, "invalid")).toBeNull();
    expect(combineDateAndTime(date, "")).toBeNull();
  });
});

// --------------- UUID uppercase requirement ---------------

describe("UUID uppercase", () => {
  it("crypto.randomUUID().toUpperCase() produces uppercase", () => {
    const uuid = crypto.randomUUID().toUpperCase();
    expect(uuid).toBe(uuid.toUpperCase());
    expect(uuid).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
  });
});
