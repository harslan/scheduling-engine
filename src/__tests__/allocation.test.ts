import { describe, it, expect } from "vitest";
import {
  allocate,
  blockingPair,
  deferredAcceptance,
  type Person,
} from "@/lib/allocation";

/**
 * Mirrors sbs-space/tests/test_matching.py: the stability guarantee is only
 * worth stating if the checker can FAIL. Then verifies the three-tier
 * semantics against the Python reference on a synthetic fixture.
 */

// both b's prefer a1; the stable outcome gives a1->b1, a2->b2
const A = new Map([
  ["a1", ["b1", "b2"]],
  ["a2", ["b1", "b2"]],
]);
const B = new Map([
  ["b1", ["a1", "a2"]],
  ["b2", ["a1", "a2"]],
]);

describe("stable matching", () => {
  it("deferred acceptance produces a stable match", () => {
    const m = deferredAcceptance(A, B);
    expect(m.get("b1")).toBe("a1");
    expect(m.get("b2")).toBe("a2");
    expect(blockingPair(m, A, B)).toBeNull();
  });

  it("the checker is non-vacuous: it catches a hand-built unstable match", () => {
    // a1-b2, a2-b1: a1 and b1 each prefer the other -> must block
    const bad = new Map([
      ["b2", "a1"],
      ["b1", "a2"],
    ]);
    expect(blockingPair(bad, A, B)).toEqual(["a1", "b1"]);
  });
});

// synthetic faculty covering every tier — invented ids only
const P = (id: string, days: string[], nSections: number): Person => ({
  id,
  days,
  nSections,
});
const FIXTURE: Person[] = [
  P("osei", ["M", "T", "W", "TH"], 4), // dedicated at threshold 4
  P("verhoeven", ["M", "W"], 2), // pair side A
  P("lindqvist", ["M", "W"], 3), // pair side A
  P("aldana", ["T", "TH"], 2), // pair side B
  P("chandra", ["T", "TH"], 3), // pair side B
  P("novak", ["M"], 1), // pool (adjunct)
  P("ilori", ["T"], 1), // pool (adjunct) — day-disjoint with novak
  P("tanaka", ["M", "TH"], 2), // pool (mixed pattern, not MW/TTH)
];

describe("three-tier allocation (mirrors the Python reference)", () => {
  it("fills dedicated, stable pairs, then a day-disjoint pool", () => {
    const a = allocate(FIXTURE, 10, { thresholdDays: 4 });
    expect(a.dedicated).toEqual(["osei"]);
    expect(a.pairs.length).toBe(2); // MW <-> TTH, peers by presence
    expect(a.stable).toBe(true);
    // peers-by-presence seeding pairs equals with equals
    const flat = a.pairs.map((p) => p.slice().sort().join("+"));
    expect(flat).toContain("aldana+verhoeven"); // presence 22 <-> 22
    expect(flat).toContain("chandra+lindqvist"); // presence 23 <-> 23
    // pool serves by presence: tanaka (M+TH) opens the first pool office,
    // ilori (T) is day-disjoint and joins it; novak (M) collides -> own office
    const tanakaOffice = a.assign.get("tanaka")!.office;
    expect(a.assign.get("ilori")!.office).toBe(tanakaOffice);
    expect(a.assign.get("novak")!.office).not.toBe(tanakaOffice);
    // 1 ded + 2 pairs + 2 pool offices
    expect(a.needed).toBe(5);
    expect(a.unplaced).toEqual([]);
  });

  it("reports shortfall with names instead of absorbing it (the alarm)", () => {
    const a = allocate(FIXTURE, 4, { thresholdDays: 4 }); // only 4 offices
    expect(a.needed).toBe(5);
    expect(a.usable).toBe(4);
    expect(a.unplaced.length).toBeGreaterThan(0); // named, never silent
    for (const id of a.unplaced) expect(a.assign.get(id)!.placed).toBe(false);
  });

  it("the adjunct dial removes single-section people to bookable rooms", () => {
    const a = allocate(FIXTURE, 10, { thresholdDays: 4, adjunctsInScope: false });
    expect(a.outOfScope).toEqual(["ilori", "novak"]);
    expect(a.assign.has("novak")).toBe(false);
    expect(a.needed).toBe(4); // one pool office no longer needed
  });

  it("reserved offices come off the top (charter 6.2)", () => {
    const a = allocate(FIXTURE, 10, { thresholdDays: 4, reservedOffices: 4 });
    expect(a.usable).toBe(6);
  });

  it("threshold dial moves the dedicated tier (charter 2.4)", () => {
    const a = allocate(FIXTURE, 10, { thresholdDays: 2 });
    // everyone with >= 2 days is dedicated now; only singles remain
    expect(a.dedicated.length).toBe(6);
    expect(a.pairs.length).toBe(0);
  });
});
