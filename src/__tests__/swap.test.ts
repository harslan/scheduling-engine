import { describe, it, expect } from "vitest";
import { affectedUsers, applySwap, type Asg } from "@/lib/swap";

// a pair office (5203: vera + rob) and a pool office (5205: quinn + tessa)
const ASGS: Asg[] = [
  { userId: "vera", roomSlug: "5203", tier: "pair", withUserIds: "rob", placed: true },
  { userId: "rob", roomSlug: "5203", tier: "pair", withUserIds: "vera", placed: true },
  { userId: "quinn", roomSlug: "5205", tier: "pool", withUserIds: "tessa", placed: true },
  { userId: "tessa", roomSlug: "5205", tier: "pool", withUserIds: "quinn", placed: true },
  { userId: "kofi", roomSlug: "5201", tier: "ded", withUserIds: "", placed: true },
  { userId: "uma", roomSlug: "", tier: "bookable", withUserIds: "", placed: true },
];

describe("swap consent set (charter 5.3)", () => {
  it("everyone sharing either office must consent — minus the proposer", () => {
    expect(affectedUsers(ASGS, "vera", "quinn")).toEqual([
      "quinn",
      "rob",
      "tessa",
    ]);
  });

  it("a dedicated-to-dedicated swap needs only the counterparty", () => {
    // kofi proposes to vera: affected = vera + rob (vera's officemate)
    expect(affectedUsers(ASGS, "kofi", "vera")).toEqual(["rob", "vera"]);
  });

  it("refuses swaps without two placed office assignments", () => {
    expect(affectedUsers(ASGS, "vera", "uma")).toHaveProperty("error");
    expect(affectedUsers(ASGS, "vera", "rob")).toHaveProperty("error"); // same office
  });
});

describe("applying an accepted swap", () => {
  it("exchanges the two people; tier and placement follow the office", () => {
    const changed = applySwap(ASGS, "vera", "quinn");
    const get = (u: string) => changed.find((c) => c.userId === u)!;
    expect(get("vera").roomSlug).toBe("5205");
    expect(get("vera").tier).toBe("pool");
    expect(get("quinn").roomSlug).toBe("5203");
    expect(get("quinn").tier).toBe("pair");
    // officemates recomputed for EVERYONE in both rooms
    expect(get("rob").withUserIds).toBe("quinn");
    expect(get("tessa").withUserIds).toBe("vera");
    expect(get("vera").withUserIds).toBe("tessa");
    expect(get("quinn").withUserIds).toBe("rob");
  });
});
