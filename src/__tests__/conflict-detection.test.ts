import { describe, it, expect, vi } from "vitest";

// Mock Prisma — only needed when getBufferMinutes queries reconfiguration_times
// (triggered when both configIds are non-null and different)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reconfigurationTime: {
      findFirst: vi.fn().mockResolvedValue(null), // No config-specific buffer → falls back to room default
    },
  },
}));

import { checkConflictsForInstance } from "@/lib/conflict-detection";

// Helper to create dates concisely
function dt(hour: number, minute = 0, day = 1): Date {
  return new Date(2026, 2, day, hour, minute); // March 2026
}

// Standard room for most tests
const baseRoom = {
  id: "room-1",
  name: "Aula A",
  bufferMinutes: 0,
  concurrentEventLimit: 1,
  parentRoomId: null,
  parentConversionMinutes: 0,
};

// Helper to build an existing instance
function existing(
  startHour: number,
  endHour: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    eventId: "evt-existing",
    roomId: "room-1",
    roomName: "Aula A",
    parentRoomId: null as string | null,
    parentConversionMinutes: 0,
    startDateTime: dt(startHour),
    endDateTime: dt(endHour),
    roomConfigurationId: null as string | null,
    concurrentEventLimit: 1,
    ...overrides,
  };
}

// ============================================================
// DIRECT OVERLAP
// ============================================================

describe("direct overlap", () => {
  it("detects when proposed fully overlaps existing", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(8), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("direct_overlap");
  });

  it("detects when proposed partially overlaps start of existing", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(8), endDateTime: dt(10) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("direct_overlap");
  });

  it("detects when proposed partially overlaps end of existing", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(10), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("direct_overlap");
  });

  it("detects when proposed is inside existing", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9, 30), endDateTime: dt(10, 30) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(1);
  });

  it("allows adjacent events with no gap (end == start)", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(0);
  });

  it("allows completely separate time ranges", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(14), endDateTime: dt(16) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(0);
  });

  it("ignores events in a different room", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      null,
      [existing(9, 11, { roomId: "room-other", roomName: "Other Room" })],
      baseRoom
    );
    expect(conflicts).toHaveLength(0);
  });
});

// ============================================================
// BUFFER / RECONFIGURATION TIME
// ============================================================

describe("buffer conflicts", () => {
  const roomWith30minBuffer = { ...baseRoom, bufferMinutes: 30 };

  it("detects conflict within buffer zone after existing event", async () => {
    // Existing: 9-11, buffer: 30min → clear at 11:30
    // Proposed: 11:15 - 12:00 → starts within buffer
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11, 15), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      roomWith30minBuffer
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("buffer_conflict");
    expect(conflicts[0].canOverride).toBe(true);
    expect(conflicts[0].message).toContain("insufficient time to reconfigure");
    expect(conflicts[0].message).toContain("30-minute buffer");
  });

  it("detects conflict within buffer zone before existing event", async () => {
    // Existing: 11-13, buffer: 30min → needs clear from 10:30
    // Proposed: 9-10:45 → extends into buffer
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(10, 45) },
      "room-1",
      null,
      [existing(11, 13)],
      roomWith30minBuffer
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("buffer_conflict");
  });

  it("allows events outside buffer zone", async () => {
    // Existing: 9-11, buffer: 30min → clear at 11:30
    // Proposed: 11:30 - 13:00 → starts exactly at buffer end
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11, 30), endDateTime: dt(13) },
      "room-1",
      null,
      [existing(9, 11)],
      roomWith30minBuffer
    );
    expect(conflicts).toHaveLength(0);
  });

  it("skips buffer check when overrideBuffer is true", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11, 15), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      roomWith30minBuffer,
      false,
      true // overrideBuffer
    );
    expect(conflicts).toHaveLength(0);
  });
});

// ============================================================
// PARENT / CHILD ROOM
// ============================================================

describe("parent/child room conflicts", () => {
  it("detects conflict when child room event overlaps parent room event", async () => {
    // Room-1 is a child of room-parent.
    // EWL convention: parentConversionMinutes lives on the PARENT room.
    const childRoom = {
      ...baseRoom,
      parentRoomId: "room-parent",
      parentConversionMinutes: 0, // child doesn't store conversion time
    };

    const parentInstance = existing(9, 11, {
      roomId: "room-parent",
      roomName: "Foro (Parent)",
      parentConversionMinutes: 15, // parent stores the conversion time
    });

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(10), endDateTime: dt(12) },
      "room-1",
      null,
      [parentInstance],
      childRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("parent_child_conflict");
    expect(conflicts[0].message).toContain("parent room");
  });

  it("detects conflict when parent room event overlaps child room event", async () => {
    // EWL convention: parentConversionMinutes lives on the PARENT room.
    // Proposed room IS the parent, so room.parentConversionMinutes has the value.
    const parentRoom = {
      ...baseRoom,
      parentConversionMinutes: 15, // parent stores the conversion time
    };

    const childInstance = existing(9, 11, {
      roomId: "room-child",
      roomName: "Foro Sub-A",
      parentRoomId: "room-1",
      parentConversionMinutes: 0, // child doesn't store conversion time
    });

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(10), endDateTime: dt(12) },
      "room-1",
      null,
      [childInstance],
      parentRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("parent_child_conflict");
    expect(conflicts[0].message).toContain("child room");
  });

  it("detects buffer conflict when parent event is adjacent to child event", async () => {
    // Proposed parent event 11:10-13:00, existing child event 9-11
    // Parent's parentConversionMinutes = 15 → need 15min buffer
    // 11:10 is within 15min of 11:00 → buffer conflict
    const parentRoom = {
      ...baseRoom,
      parentConversionMinutes: 15, // parent stores the conversion time
    };

    const childInstance = existing(9, 11, {
      roomId: "room-child",
      roomName: "Foro Sub-A",
      parentRoomId: "room-1",
      parentConversionMinutes: 0, // child doesn't store conversion time
    });

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11, 10), endDateTime: dt(13) },
      "room-1",
      null,
      [childInstance],
      parentRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("buffer_conflict");
  });

  it("detects buffer conflict when child event is adjacent to parent event", async () => {
    // Proposed child event 11:10-13:00, existing parent event 9-11
    // Parent's parentConversionMinutes = 15 (on the existing instance) → buffer
    const childRoom = {
      ...baseRoom,
      parentRoomId: "room-parent",
      parentConversionMinutes: 0, // child doesn't store conversion time
    };

    const parentInstance = existing(9, 11, {
      roomId: "room-parent",
      roomName: "Foro (Parent)",
      parentConversionMinutes: 15, // parent stores the conversion time
    });

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11, 10), endDateTime: dt(13) },
      "room-1",
      null,
      [parentInstance],
      childRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("buffer_conflict");
  });

  it("allows non-overlapping events in parent/child rooms", async () => {
    const childRoom = {
      ...baseRoom,
      parentRoomId: "room-parent",
      parentConversionMinutes: 15,
    };

    const parentInstance = existing(9, 11, {
      roomId: "room-parent",
      roomName: "Foro (Parent)",
    });

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(12), endDateTime: dt(14) },
      "room-1",
      null,
      [parentInstance],
      childRoom
    );
    expect(conflicts).toHaveLength(0);
  });
});

// ============================================================
// CONCURRENT EVENT LIMIT
// ============================================================

describe("concurrent event limit", () => {
  const roomWith3Limit = {
    ...baseRoom,
    concurrentEventLimit: 3,
  };

  it("allows events up to the concurrent limit", async () => {
    const configId = "config-A";
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: configId }),
      existing(9, 11, { roomConfigurationId: configId, eventId: "evt-2" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      configId,
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(0);
  });

  it("detects when concurrent limit is exceeded", async () => {
    const configId = "config-A";
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: configId, eventId: "evt-1" }),
      existing(9, 11, { roomConfigurationId: configId, eventId: "evt-2" }),
      existing(9, 11, { roomConfigurationId: configId, eventId: "evt-3" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      configId,
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("concurrent_limit_exceeded");
    expect(conflicts[0].message).toContain("concurrent event limit (3)");
  });

  it("staggered events stay within limit using running-count algorithm", async () => {
    // Limit: 3. Three 2-hour events staggered by 1 hour.
    // At 10:00, events at [9-11], [10-12], [proposed 10-12] = 3 concurrent = ok
    const configId = "config-A";
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: configId, eventId: "evt-1" }),
      existing(10, 12, { roomConfigurationId: configId, eventId: "evt-2" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(10), endDateTime: dt(12) },
      "room-1",
      configId,
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(0);
  });

  it("detects direct overlap for different configurations in multi-concurrent room", async () => {
    // Two different configs represent different physical arrangements that can't coexist.
    // Even in a multi-concurrent room, config-A and config-B should conflict on overlap.
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-B", eventId: "evt-1" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(10), endDateTime: dt(12) },
      "room-1",
      "config-A",
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("direct_overlap");
  });

  it("allows non-overlapping different configurations in multi-concurrent room", async () => {
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-B", eventId: "evt-1" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(12), endDateTime: dt(14) },
      "room-1",
      "config-A",
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(0);
  });

  it("defers null-config events to concurrent limit (not direct overlap) in multi-concurrent room", async () => {
    // If proposed has no config, we can't know it conflicts by config.
    // Defer to concurrent limit check, which counts null-config against all.
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-1" }),
    ];

    // With limit 3 and only 1 existing + 1 proposed = 2, should be fine
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      null,
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(0);
  });

  it("ignores different configuration IDs in concurrent counting", async () => {
    // Only same-config events count toward the concurrent limit.
    // 2 config-A existing + 1 config-A proposed = 3 = at limit → no conflict.
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-1" }),
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-2" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      "config-A",
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(0);
  });

  it("different-config overlap AND concurrent limit: both reported", async () => {
    // Config-B overlaps → direct overlap. Config-A events also push over limit.
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-1" }),
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-2" }),
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-3" }),
      existing(9, 11, { roomConfigurationId: "config-B", eventId: "evt-4" }),
    ];

    // Proposed config-A: direct overlap with config-B + concurrent limit exceeded (3 config-A + proposed = 4 > 3)
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      "config-A",
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts.some((c) => c.reason === "direct_overlap")).toBe(true);
    expect(conflicts.some((c) => c.reason === "concurrent_limit_exceeded")).toBe(true);
  });

  it("null configId counts against ALL events (cannot bypass limit)", async () => {
    // When proposed has no config, it counts against ALL same-room events regardless
    // of their config. 3 existing + 1 proposed = 4 > limit 3.
    // (null proposed config means no different-config check — all defer to concurrent limit)
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-1" }),
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-2" }),
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-3" }),
    ];

    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      null,
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("concurrent_limit_exceeded");
  });

  it("config-less existing events count against specific config proposals", async () => {
    const existingInstances = [
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-1" }),
      existing(9, 11, { roomConfigurationId: "config-A", eventId: "evt-2" }),
      existing(9, 11, { roomConfigurationId: null, eventId: "evt-3" }), // no config
    ];

    // Proposed with config-A: 2 config-A + 1 config-less + proposed = 4 > limit 3
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      "config-A",
      existingInstances,
      roomWith3Limit
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("concurrent_limit_exceeded");
  });
});

// ============================================================
// RECURRING EVENT — DATE STRINGS IN MESSAGES
// ============================================================

describe("recurring event context", () => {
  it("includes date in conflict message when isRecurring=true", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9, 0, 5), endDateTime: dt(11, 0, 5) }, // March 5
      "room-1",
      null,
      [existing(9, 11, { startDateTime: dt(9, 0, 5), endDateTime: dt(11, 0, 5) })],
      baseRoom,
      true // isRecurring
    );
    expect(conflicts).toHaveLength(1);
    // Should contain the date string for this instance
    expect(conflicts[0].message).toMatch(/3\/5\/2026|March 5/);
  });

  it("omits date in conflict message when isRecurring=false", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom,
      false
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].message).not.toMatch(/\/2026/);
  });
});

// ============================================================
// MULTIPLE CONFLICTS
// ============================================================

describe("multiple conflicts", () => {
  it("reports all overlapping existing instances", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(17) }, // All day
      "room-1",
      null,
      [
        existing(8, 10, { eventId: "evt-1" }),
        existing(12, 14, { eventId: "evt-2" }),
        existing(15, 17, { eventId: "evt-3" }),
      ],
      baseRoom
    );
    expect(conflicts).toHaveLength(3);
  });

  it("reports zero conflicts for empty existing instances", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      null,
      [],
      baseRoom
    );
    expect(conflicts).toHaveLength(0);
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe("edge cases", () => {
  it("handles exact same time range as existing", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(9), endDateTime: dt(11) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe("direct_overlap");
  });

  it("handles 1-minute overlap at boundary", async () => {
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(10, 59), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      baseRoom
    );
    expect(conflicts).toHaveLength(1);
  });

  it("handles zero-buffer room correctly", async () => {
    // Adjacent events should be allowed with 0 buffer
    const conflicts = await checkConflictsForInstance(
      { startDateTime: dt(11), endDateTime: dt(12) },
      "room-1",
      null,
      [existing(9, 11)],
      { ...baseRoom, bufferMinutes: 0 }
    );
    expect(conflicts).toHaveLength(0);
  });
});
