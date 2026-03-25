import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-create the validation schemas from server actions so we can test them
// without importing "use server" modules directly

const SubmitEventSchema = z.object({
  organizationId: z.string(),
  title: z.string().min(1, "Title is required"),
  eventTypeId: z.string().optional(),
  roomId: z.string().optional(),
  roomConfigurationId: z.string().optional(),
  startDateTime: z.string().min(1, "Start date is required"),
  endDateTime: z.string().min(1, "End date is required"),
  expectedAttendeeCount: z.coerce.number().int().positive().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email("Valid email is required"),
  contactPhone: z.string().optional(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  notes: z.string().optional(),
  recurrenceRule: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
});

const RoomSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1, "Name is required"),
  iconText: z.string().max(4).optional(),
  notes: z.string().optional(),
  active: z.coerce.boolean().optional(),
  managersOnly: z.coerce.boolean().optional(),
  concurrentEventLimit: z.coerce.number().int().min(1).optional(),
  bufferMinutes: z.coerce.number().int().min(0).optional(),
  capacity: z.coerce.number().int().min(1).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().optional(),
});

describe("SubmitEventSchema", () => {
  const validEvent = {
    organizationId: "org_123",
    title: "MBA Strategy Class",
    startDateTime: "2026-03-15T09:00:00",
    endDateTime: "2026-03-15T11:00:00",
    contactName: "Maria Garcia",
    contactEmail: "maria@incae.edu",
  };

  it("accepts valid event data", () => {
    const result = SubmitEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = SubmitEventSchema.safeParse({ ...validEvent, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title is required");
    }
  });

  it("rejects missing start date", () => {
    const result = SubmitEventSchema.safeParse({ ...validEvent, startDateTime: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing end date", () => {
    const result = SubmitEventSchema.safeParse({ ...validEvent, endDateTime: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing contact name", () => {
    const result = SubmitEventSchema.safeParse({ ...validEvent, contactName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = SubmitEventSchema.safeParse({
      ...validEvent,
      contactEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Valid email is required");
    }
  });

  it("accepts optional fields when omitted", () => {
    const result = SubmitEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roomId).toBeUndefined();
      expect(result.data.eventTypeId).toBeUndefined();
      expect(result.data.description).toBeUndefined();
    }
  });

  it("coerces attendee count to integer", () => {
    const result = SubmitEventSchema.safeParse({
      ...validEvent,
      expectedAttendeeCount: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedAttendeeCount).toBe(50);
    }
  });

  it("rejects negative attendee count", () => {
    const result = SubmitEventSchema.safeParse({
      ...validEvent,
      expectedAttendeeCount: "-5",
    });
    expect(result.success).toBe(false);
  });

  it("accepts event with all optional fields", () => {
    const result = SubmitEventSchema.safeParse({
      ...validEvent,
      eventTypeId: "type_1",
      roomId: "room_1",
      roomConfigurationId: "config_1",
      expectedAttendeeCount: "30",
      contactPhone: "+506 1234 5678",
      description: "A strategy class for MBA students",
      websiteUrl: "https://incae.edu/mba",
      notes: "Please set up projector",
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE",
      recurrenceEndDate: "2026-06-30",
    });
    expect(result.success).toBe(true);
  });
});

describe("RoomSchema", () => {
  const validRoom = {
    organizationId: "org_123",
    name: "Aula Manuel Jiménez",
  };

  it("accepts valid room data", () => {
    const result = RoomSchema.safeParse(validRoom);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = RoomSchema.safeParse({ ...validRoom, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects icon text longer than 4 chars", () => {
    const result = RoomSchema.safeParse({ ...validRoom, iconText: "ABCDE" });
    expect(result.success).toBe(false);
  });

  it("accepts 4-char icon text", () => {
    const result = RoomSchema.safeParse({ ...validRoom, iconText: "ABCD" });
    expect(result.success).toBe(true);
  });

  it("rejects concurrent event limit below 1", () => {
    const result = RoomSchema.safeParse({
      ...validRoom,
      concurrentEventLimit: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative buffer minutes", () => {
    const result = RoomSchema.safeParse({ ...validRoom, bufferMinutes: "-5" });
    expect(result.success).toBe(false);
  });

  it("coerces string booleans (zod coerce treats any truthy string as true)", () => {
    const result = RoomSchema.safeParse({
      ...validRoom,
      active: "true",
      managersOnly: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
      expect(result.data.managersOnly).toBe(true);
    }

    // Note: z.coerce.boolean() converts "false" to true since it's a truthy string
    // This matches how HTML form checkboxes work (present = checked, absent = unchecked)
    const result2 = RoomSchema.safeParse({
      ...validRoom,
      active: "false",
    });
    expect(result2.success).toBe(true);
    if (result2.success) {
      // z.coerce.boolean() considers "false" as truthy
      expect(result2.data.active).toBe(true);
    }
  });

  it("accepts empty string for capacity (nullable)", () => {
    const result = RoomSchema.safeParse({ ...validRoom, capacity: "" });
    expect(result.success).toBe(true);
  });

  it("coerces capacity string to number", () => {
    const result = RoomSchema.safeParse({ ...validRoom, capacity: "100" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capacity).toBe(100);
    }
  });
});

describe("Event scheduling constraints", () => {
  // Test the constraint logic that lives in submitEvent
  // These are pure functions extracted for testability

  function validateTimeRange(startDt: Date, endDt: Date): string | null {
    if (startDt >= endDt) return "End time must be after start time";
    return null;
  }

  function validateMaxDuration(
    startDt: Date,
    endDt: Date,
    maxMinutes: number
  ): string | null {
    const durationMinutes = (endDt.getTime() - startDt.getTime()) / (1000 * 60);
    if (durationMinutes > maxMinutes) {
      const hours = Math.floor(maxMinutes / 60);
      const mins = maxMinutes % 60;
      return `Event duration exceeds the maximum of ${hours > 0 ? `${hours}h` : ""}${mins > 0 ? ` ${mins}m` : ""}. Please shorten your event.`;
    }
    return null;
  }

  function validateOpeningHours(
    startDt: Date,
    endDt: Date,
    openingTime: string,
    closingTime: string
  ): string | null {
    const [openH, openM] = openingTime.split(":").map(Number);
    const [closeH, closeM] = closingTime.split(":").map(Number);
    const startMinutes = startDt.getHours() * 60 + startDt.getMinutes();
    const endMinutes = endDt.getHours() * 60 + endDt.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      return `Events must be scheduled between ${openingTime} and ${closingTime}.`;
    }
    return null;
  }

  it("rejects end time before start time", () => {
    const start = new Date("2026-03-15T10:00:00");
    const end = new Date("2026-03-15T09:00:00");
    expect(validateTimeRange(start, end)).toBe("End time must be after start time");
  });

  it("rejects same start and end time", () => {
    const dt = new Date("2026-03-15T10:00:00");
    expect(validateTimeRange(dt, dt)).toBe("End time must be after start time");
  });

  it("accepts valid time range", () => {
    const start = new Date("2026-03-15T09:00:00");
    const end = new Date("2026-03-15T10:00:00");
    expect(validateTimeRange(start, end)).toBeNull();
  });

  it("rejects event exceeding max duration (480 min = 8h)", () => {
    const start = new Date("2026-03-15T08:00:00");
    const end = new Date("2026-03-15T17:00:00"); // 9 hours
    const error = validateMaxDuration(start, end, 480);
    expect(error).toContain("8h");
  });

  it("accepts event within max duration", () => {
    const start = new Date("2026-03-15T08:00:00");
    const end = new Date("2026-03-15T12:00:00"); // 4 hours
    expect(validateMaxDuration(start, end, 480)).toBeNull();
  });

  it("rejects event starting before opening time", () => {
    const start = new Date("2026-03-15T06:00:00");
    const end = new Date("2026-03-15T08:00:00");
    const error = validateOpeningHours(start, end, "07:00", "22:00");
    expect(error).toContain("07:00");
  });

  it("rejects event ending after closing time", () => {
    const start = new Date("2026-03-15T20:00:00");
    const end = new Date("2026-03-15T23:00:00");
    const error = validateOpeningHours(start, end, "07:00", "22:00");
    expect(error).toContain("22:00");
  });

  it("accepts event within opening hours", () => {
    const start = new Date("2026-03-15T09:00:00");
    const end = new Date("2026-03-15T17:00:00");
    expect(validateOpeningHours(start, end, "07:00", "22:00")).toBeNull();
  });

  it("accepts event at exact opening and closing times", () => {
    const start = new Date("2026-03-15T07:00:00");
    const end = new Date("2026-03-15T22:00:00");
    expect(validateOpeningHours(start, end, "07:00", "22:00")).toBeNull();
  });
});

describe("Slug generation", () => {
  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  it("converts simple name to slug", () => {
    expect(slugify("Conference Room")).toBe("conference-room");
  });

  it("handles special characters", () => {
    expect(slugify("Aula Manuel Jiménez")).toBe("aula-manuel-jim-nez");
  });

  it("handles multiple spaces and hyphens", () => {
    expect(slugify("Room  A - Section 1")).toBe("room-a-section-1");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("--room--")).toBe("room");
  });

  it("handles all-special-character input", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("handles numbers", () => {
    expect(slugify("Room 101")).toBe("room-101");
  });
});
