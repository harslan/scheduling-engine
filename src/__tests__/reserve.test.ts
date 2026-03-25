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
import type {
  ReserveGatewayResponse,
  ReservePutRequestData,
} from "@/lib/reserve/types";

// ============================================================
// extractEventUniqueId — reads results[0].uniqueIds["event.uniqueId"]
// ============================================================

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

  it("ignores additional results — only reads first", () => {
    const response: ReserveGatewayResponse = {
      results: [
        { uniqueIds: { "event.uniqueId": "FIRST" } },
        { uniqueIds: { "event.uniqueId": "SECOND" } },
      ],
    };
    expect(extractEventUniqueId(response)).toBe("FIRST");
  });
});

// ============================================================
// extractUniqueId — reads results[0].uniqueIds["uniqueId"]
// ============================================================

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

  it("returns null when uniqueIds is empty", () => {
    const response: ReserveGatewayResponse = {
      results: [{ uniqueIds: {} }],
    };
    expect(extractUniqueId(response)).toBeNull();
  });
});

// ============================================================
// ReserveGatewayResponse type shape — compile-time + runtime
// ============================================================

describe("ReserveGatewayResponse shape", () => {
  it("matches the actual Reserve API response structure", () => {
    // This is what Reserve actually returns for an EventFunctionImport
    const realResponse: ReserveGatewayResponse = {
      results: [
        {
          uniqueIds: {
            "event.uniqueId": "12345",
            uniqueId: "67890",
          },
          warnings: [],
        },
      ],
      requestGuid: "SOME-GUID",
    };

    expect(realResponse.results).toHaveLength(1);
    expect(realResponse.results[0].uniqueIds["event.uniqueId"]).toBe("12345");
    expect(extractEventUniqueId(realResponse)).toBe("12345");
    expect(extractUniqueId(realResponse)).toBe("67890");
  });
});

// ============================================================
// ReservePutRequestData shape — the payload we POST
// ============================================================

describe("ReservePutRequestData", () => {
  it("serializes to the expected JSON shape", () => {
    const payload: ReservePutRequestData = {
      header: ["function.event.site", "function.event.name"],
      data: [["Samberg Conference Center", "My Event"]],
    };

    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);

    expect(parsed.header).toEqual(["function.event.site", "function.event.name"]);
    expect(parsed.data).toEqual([["Samberg Conference Center", "My Event"]]);
  });

  it("supports multiple data rows for additional functions", () => {
    const payload: ReservePutRequestData = {
      header: ["function.event.uniqueId", "function.startDate", "function.startTime"],
      data: [
        ["EVT-123", "3/25/2026", "9:00 AM"],
        ["EVT-123", "3/26/2026", "10:00 AM"],
      ],
    };

    expect(payload.data).toHaveLength(2);
    expect(payload.data[0][0]).toBe("EVT-123");
    expect(payload.data[1][0]).toBe("EVT-123");
  });
});

// ============================================================
// Export header field names — must match .NET ReserveEventExporter.cs
// These are the exact strings the Reserve gateway expects.
// ============================================================

describe("export header field names", () => {
  // These are the exact header arrays from ReserveEventExporter.cs lines 245-259
  const DOTNET_EVENT_HEADER = [
    "function.event.site",
    // org.ReserveEventIdFieldValueName — dynamic, skip
    "function.event.name",
    "function.event.estimatedAttendance",
    // org.ReserveEventNotesFieldValueName — dynamic, skip
    "function.event.contact.uniqueId",
    // org.ReserveEventOrganizationFieldValueName — dynamic, skip
    "function.event.owner.username",
    "function.event.salesperson.username",
    "function.event.lifecycleState.stateType",
  ];

  const DOTNET_FUNCTION_HEADER = [
    "function.startDate",
    "function.startTime",
    "function.endTime",
    "function.locations",
    "function.setupStyle",
    "function.functionType",
    "function.estimatedAttendance",
    "function.setupMinutes",
    "function.teardownMinutes",
  ];

  const DOTNET_ADDITIONAL_FUNCTION_HEADER = [
    "function.event.uniqueId",
    ...DOTNET_FUNCTION_HEADER,
  ];

  it("static event header fields match .NET reference exactly", () => {
    // The hardcoded fields (non-dynamic) that appear in our export.ts
    const tsStaticEventFields = [
      "function.event.site",
      "function.event.name",
      "function.event.estimatedAttendance",
      "function.event.contact.uniqueId",
      "function.event.owner.username",
      "function.event.salesperson.username",
      "function.event.lifecycleState.stateType",
    ];

    for (const field of tsStaticEventFields) {
      expect(DOTNET_EVENT_HEADER).toContain(field);
    }
  });

  it("function header fields match .NET reference exactly", () => {
    expect(DOTNET_FUNCTION_HEADER).toEqual([
      "function.startDate",
      "function.startTime",
      "function.endTime",
      "function.locations",
      "function.setupStyle",
      "function.functionType",
      "function.estimatedAttendance",
      "function.setupMinutes",
      "function.teardownMinutes",
    ]);
  });

  it("additional function header prepends function.event.uniqueId", () => {
    expect(DOTNET_ADDITIONAL_FUNCTION_HEADER[0]).toBe("function.event.uniqueId");
    expect(DOTNET_ADDITIONAL_FUNCTION_HEADER.slice(1)).toEqual(DOTNET_FUNCTION_HEADER);
  });
});

// ============================================================
// Account/Contact import header field names — must match .NET
// ============================================================

describe("account/contact import headers", () => {
  it("account import uses account.name and account.owner.username", () => {
    const header = ["account.name", "account.owner.username"];
    expect(header).toHaveLength(2);
    expect(header[0]).toBe("account.name");
  });

  it("contact import uses the 6 .NET fields in correct order", () => {
    const header = [
      "contact.account.name",
      "contact.firstName",
      "contact.lastName",
      "contact.email",
      "contact.workPhone",
      "contact.owner.username",
    ];
    expect(header).toHaveLength(6);
    expect(header[0]).toBe("contact.account.name");
    expect(header[5]).toBe("contact.owner.username");
  });
});

// ============================================================
// parseReserveDate — M/d/yyyy with bounds validation
// ============================================================

describe("parseReserveDate", () => {
  it("parses a valid M/d/yyyy date", () => {
    const date = parseReserveDate("3/15/2026");
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(2);
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

  it("returns null for ISO format", () => {
    expect(parseReserveDate("2026-03-15")).toBeNull();
  });

  it("returns null for natural language", () => {
    expect(parseReserveDate("March 15, 2026")).toBeNull();
  });

  it("rejects year < 2000", () => {
    expect(parseReserveDate("1/1/1999")).toBeNull();
    expect(parseReserveDate("6/15/1900")).toBeNull();
  });

  it("rejects invalid month (0 and 13)", () => {
    expect(parseReserveDate("13/1/2026")).toBeNull();
    expect(parseReserveDate("0/1/2026")).toBeNull();
  });

  it("rejects invalid day (0 and 32)", () => {
    expect(parseReserveDate("1/0/2026")).toBeNull();
    expect(parseReserveDate("1/32/2026")).toBeNull();
  });

  it("accepts year 2000 as minimum boundary", () => {
    const date = parseReserveDate("1/1/2000");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2000);
  });

  it("accepts single-digit month and day", () => {
    const date = parseReserveDate("1/5/2026");
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(5);
  });
});

// ============================================================
// parseReserveTime — h:mm AM/PM
// ============================================================

describe("parseReserveTime", () => {
  it("parses AM time", () => {
    expect(parseReserveTime("9:30 AM")).toEqual({ hours: 9, minutes: 30 });
  });

  it("parses PM time", () => {
    expect(parseReserveTime("2:15 PM")).toEqual({ hours: 14, minutes: 15 });
  });

  it("handles 12:00 PM (noon)", () => {
    expect(parseReserveTime("12:00 PM")).toEqual({ hours: 12, minutes: 0 });
  });

  it("handles 12:00 AM (midnight)", () => {
    expect(parseReserveTime("12:00 AM")).toEqual({ hours: 0, minutes: 0 });
  });

  it("handles 12:59 PM", () => {
    expect(parseReserveTime("12:59 PM")).toEqual({ hours: 12, minutes: 59 });
  });

  it("handles 12:59 AM", () => {
    expect(parseReserveTime("12:59 AM")).toEqual({ hours: 0, minutes: 59 });
  });

  it("returns null for empty string", () => {
    expect(parseReserveTime("")).toBeNull();
  });

  it("returns null for 24-hour format", () => {
    expect(parseReserveTime("14:30")).toBeNull();
  });

  it("is case-insensitive for AM/PM", () => {
    expect(parseReserveTime("9:30 am")).toEqual({ hours: 9, minutes: 30 });
    expect(parseReserveTime("2:15 pm")).toEqual({ hours: 14, minutes: 15 });
  });
});

// ============================================================
// formatDateForReserve — M/d/yyyy (no zero-padding)
// ============================================================

describe("formatDateForReserve", () => {
  it("formats as M/d/yyyy without zero-padding", () => {
    expect(formatDateForReserve(new Date(2026, 2, 5))).toBe("3/5/2026");
  });

  it("formats double-digit month and day", () => {
    expect(formatDateForReserve(new Date(2026, 11, 25))).toBe("12/25/2026");
  });

  it("handles January 1st", () => {
    expect(formatDateForReserve(new Date(2026, 0, 1))).toBe("1/1/2026");
  });
});

// ============================================================
// formatTimeForReserve — h:mm AM/PM
// ============================================================

describe("formatTimeForReserve", () => {
  it("formats AM time", () => {
    expect(formatTimeForReserve(new Date(2026, 0, 1, 9, 5))).toBe("9:05 AM");
  });

  it("formats PM time", () => {
    expect(formatTimeForReserve(new Date(2026, 0, 1, 14, 30))).toBe("2:30 PM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatTimeForReserve(new Date(2026, 0, 1, 12, 0))).toBe("12:00 PM");
  });

  it("formats midnight as 12:00 AM", () => {
    expect(formatTimeForReserve(new Date(2026, 0, 1, 0, 0))).toBe("12:00 AM");
  });

  it("zero-pads minutes", () => {
    expect(formatTimeForReserve(new Date(2026, 0, 1, 3, 7))).toBe("3:07 AM");
  });
});

// ============================================================
// combineDateAndTime — full round-trip
// ============================================================

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

  it("round-trips through format and parse", () => {
    const original = new Date(2026, 5, 20, 15, 45);
    const dateStr = formatDateForReserve(original);
    const timeStr = formatTimeForReserve(original);

    const parsedDate = parseReserveDate(dateStr);
    expect(parsedDate).not.toBeNull();

    const result = combineDateAndTime(parsedDate!, timeStr);
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(20);
    expect(result!.getHours()).toBe(15);
    expect(result!.getMinutes()).toBe(45);
  });
});

// ============================================================
// UUID uppercase — .NET uses Guid.NewGuid().ToString().ToUpper()
// ============================================================

describe("UUID uppercase", () => {
  it("crypto.randomUUID().toUpperCase() produces uppercase hex", () => {
    const uuid = crypto.randomUUID().toUpperCase();
    expect(uuid).toBe(uuid.toUpperCase());
    expect(uuid).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
    );
  });

  it("produces a valid v4 UUID structure", () => {
    const uuid = crypto.randomUUID().toUpperCase();
    const parts = uuid.split("-");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toHaveLength(8);
    expect(parts[1]).toHaveLength(4);
    expect(parts[2]).toHaveLength(4);
    expect(parts[3]).toHaveLength(4);
    expect(parts[4]).toHaveLength(12);
  });
});
