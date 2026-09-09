import { describe, it, expect } from "vitest";
import {
  assignRoomsToGroups,
  groupsFromAssignments,
  type OfficeGroup,
} from "@/lib/room-assignment";

// slug, sortOrder, hasWindow, deskCapacity
const room = (slug: string, sortOrder: number, hasWindow: boolean, deskCapacity: number) => ({
  slug,
  sortOrder,
  hasWindow,
  deskCapacity,
});

const solo = (office: string): OfficeGroup => ({ office, size: 1, tier: "ded" });
const pair = (office: string): OfficeGroup => ({ office, size: 2, tier: "pair" });

describe("assignRoomsToGroups — window policy is a ratified choice", () => {
  // window room D2 has a HIGHER sort order, so only a window-prioritizing
  // policy would pick it before the plain room.
  const rooms = () => [
    room("PLAIN", 1, false, 1), // no window, first in sort order
    room("WIN", 2, true, 1), // window, later in sort order
  ];

  it("earns windows by priority when the charter says 'presence'", () => {
    const map = assignRoomsToGroups([solo("O001"), solo("O002")], rooms(), {
      prioritizeWindows: true,
    });
    expect(map.get("O001")!.slug).toBe("WIN"); // top priority earns the window
    expect(map.get("O002")!.slug).toBe("PLAIN");
  });

  it("does NOT prioritize windows by default (policy 'none')", () => {
    const map = assignRoomsToGroups([solo("O001"), solo("O002")], rooms());
    expect(map.get("O001")!.slug).toBe("PLAIN"); // sort order only — window is incidental
    expect(map.get("O002")!.slug).toBe("WIN");
  });
});

describe("assignRoomsToGroups — two desks for sharers", () => {
  it("places a shared office in a two-desk room, window preferred", () => {
    const rooms = [
      room("A", 1, true, 2), // 2-desk window
      room("B", 2, false, 2), // 2-desk no window
    ];
    const map = assignRoomsToGroups([pair("O001"), pair("O002")], rooms);
    expect(map.get("O001")!.slug).toBe("A");
    expect(map.get("O002")!.slug).toBe("B");
  });

  it("does not let a solo hog a two-desk room the sharer needs", () => {
    const rooms = [
      room("A", 1, true, 2), // 2-desk window
      room("C", 3, true, 1), // 1-desk window
    ];
    // Solo is higher priority but should take the 1-desk room, leaving the
    // two-desk room for the pair behind it.
    const map = assignRoomsToGroups([solo("O001"), pair("O002")], rooms);
    expect(map.get("O001")!.slug).toBe("C"); // solo -> 1-desk window
    expect(map.get("O002")!.slug).toBe("A"); // pair -> 2-desk window
  });

  it("falls back to a one-desk room when no two-desk room is left (hot-desk)", () => {
    const rooms = [room("C", 3, true, 1), room("D", 4, false, 1)];
    const map = assignRoomsToGroups([pair("O001")], rooms);
    expect(map.get("O001")!.slug).toBe("C"); // best available, window preferred
    expect(map.get("O001")!.deskCapacity).toBe(1);
  });
});

describe("assignRoomsToGroups — stock limits", () => {
  it("leaves groups past the room stock unassigned", () => {
    const rooms = [room("A", 1, false, 2), room("B", 2, false, 2)];
    const map = assignRoomsToGroups([pair("O001"), pair("O002"), pair("O003")], rooms);
    expect(map.size).toBe(2);
    expect(map.has("O003")).toBe(false);
  });
});

describe("groupsFromAssignments", () => {
  it("rebuilds groups in office order with size and tier", () => {
    const assign = new Map([
      ["u1", { office: "O001", tier: "pair" as const, with: ["u2"] }],
      ["u2", { office: "O001", tier: "pair" as const, with: ["u1"] }],
      ["u3", { office: "O002", tier: "ded" as const, with: [] }],
    ]);
    const groups = groupsFromAssignments(assign);
    expect(groups).toEqual([
      { office: "O001", size: 2, tier: "pair" },
      { office: "O002", size: 1, tier: "ded" },
    ]);
  });
});
