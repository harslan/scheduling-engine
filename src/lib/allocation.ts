/**
 * Faculty office allocation — TypeScript port of the reference engine
 * (sbs-space/src/allocate.py). The Python engine remains the reference
 * implementation; this module mirrors its semantics so the product and the
 * reference can be parity-checked, never assumed equal.
 *
 * Guarantees carried over:
 *  - claims are MEASURED (days/sections come from the registrar, not a form)
 *  - pairing is deferred acceptance; stability is VERIFIED by searching for a
 *    blocking pair, and the search is proven non-vacuous by tests
 *  - the allocation reports shortfall rather than absorbing it (the alarm)
 */

export type Person = {
  id: string;
  days: string[];      // subset of M T W TH F S SU — TH is one token
  nSections: number;
};

export type Dials = {
  thresholdDays: number;         // charter 2.4
  reservedOffices?: number;      // charter 6.2 (e.g. the four law offices)
  slackFraction?: number | null; // UNDECIDED -> treated as 0, caller flags it
  adjunctsInScope?: boolean | null; // UNDECIDED -> included, caller flags it
};

export type Assignment = {
  office: string;
  tier: "ded" | "pair" | "pool";
  with: string[];
  placed: boolean;
};

export type Allocation = {
  dedicated: string[];
  pairs: [string, string][];
  poolOffices: string[][];
  outOfScope: string[];          // adjuncts, when dialed out (bookable rooms)
  assign: Map<string, Assignment>;
  unplaced: string[];
  needed: number;
  usable: number;
  stable: boolean;               // verified, not assumed
};

const DAY_ORDER = ["M", "T", "W", "TH", "F", "S", "SU"];

export const presence = (p: Person) => p.days.length * 10 + p.nSections;
export const patternOf = (p: Person) =>
  DAY_ORDER.filter((d) => p.days.includes(d)).join("");

/** Gale–Shapley, A proposing. Returns Map<b, a>. Stable by construction. */
export function deferredAcceptance(
  aPref: Map<string, string[]>,
  bPref: Map<string, string[]>,
): Map<string, string> {
  const bRank = new Map<string, Map<string, number>>();
  for (const [b, order] of bPref) {
    bRank.set(b, new Map(order.map((a, i) => [a, i])));
  }
  const free = [...aPref.keys()];
  const next = new Map([...aPref.keys()].map((a) => [a, 0]));
  const match = new Map<string, string>();
  while (free.length) {
    const a = free.pop()!;
    const prefs = aPref.get(a)!;
    const i = next.get(a)!;
    if (i >= prefs.length) continue; // a exhausted its list -> unmatched
    const b = prefs[i];
    next.set(a, i + 1);
    const held = match.get(b);
    const rank = bRank.get(b)!;
    if (held === undefined) {
      match.set(b, a);
    } else if ((rank.get(a) ?? Infinity) < (rank.get(held) ?? Infinity)) {
      match.set(b, a);
      free.push(held);
    } else {
      free.push(a);
    }
  }
  return match;
}

/** A blocking pair if one exists (proof of INstability), else null. */
export function blockingPair(
  match: Map<string, string>,
  aPref: Map<string, string[]>,
  bPref: Map<string, string[]>,
): [string, string] | null {
  const partner = new Map([...match].map(([b, a]) => [a, b]));
  const aRank = new Map(
    [...aPref].map(([a, o]) => [a, new Map(o.map((b, i) => [b, i]))]),
  );
  const bRank = new Map(
    [...bPref].map(([b, o]) => [b, new Map(o.map((a, i) => [a, i]))]),
  );
  for (const [a, prefs] of aPref) {
    const cur = partner.get(a);
    for (const b of prefs) {
      if (cur !== undefined && aRank.get(a)!.get(b)! >= aRank.get(a)!.get(cur)!) break;
      const held = match.get(b);
      const rank = bRank.get(b)!;
      if (held === undefined || (rank.get(a) ?? Infinity) < (rank.get(held) ?? Infinity)) {
        return [a, b];
      }
    }
  }
  return null;
}

/** Mirrors sbs-space allocate(): dedicated -> stable pairs -> day-disjoint pool. */
export function allocate(
  people: Person[],
  offices: number,
  dials: Dials,
): Allocation {
  const reserved = dials.reservedOffices ?? 0;
  const slack = dials.slackFraction ?? 0;
  const usable = Math.floor((offices - reserved) * (1 - slack));

  const byId = new Map(people.map((p) => [p.id, p]));
  const adjuncts = people.filter((p) => p.nSections === 1).map((p) => p.id);
  const outOfScope = dials.adjunctsInScope === false ? [...adjuncts].sort() : [];
  const out = new Set(outOfScope);
  const candidates = people.filter((p) => !out.has(p.id));

  const byPresence = (a: Person, b: Person) =>
    presence(b) - presence(a) || a.id.localeCompare(b.id);

  // Tier 1 — dedicated
  const dedicated = candidates
    .filter((p) => p.days.length >= dials.thresholdDays)
    .sort(byPresence)
    .map((p) => p.id);
  const ded = new Set(dedicated);
  const rest = candidates.filter((p) => !ded.has(p.id));

  // Tier 2 — MW <-> TTH by deferred acceptance, peers-by-presence seeding
  const A = rest.filter((p) => patternOf(p) === "MW").map((p) => p.id);
  const B = rest.filter((p) => patternOf(p) === "TTH").map((p) => p.id);
  const seed = (self: string, others: string[]) =>
    [...others].sort(
      (x, y) =>
        Math.abs(presence(byId.get(self)!) - presence(byId.get(x)!)) -
          Math.abs(presence(byId.get(self)!) - presence(byId.get(y)!)) ||
        x.localeCompare(y),
    );
  const aPref = new Map(A.map((a) => [a, seed(a, B)]));
  const bPref = new Map(B.map((b) => [b, seed(b, A)]));
  const match = deferredAcceptance(aPref, bPref);
  const pairs: [string, string][] = [...match].map(([b, a]) => [a, b]);
  const stable = blockingPair(match, aPref, bPref) === null;
  const paired = new Set(pairs.flat());

  // Tier 3 — pool, served by presence, packed day-disjoint
  const pool = rest
    .filter((p) => !paired.has(p.id))
    .sort(byPresence)
    .map((p) => p.id);
  const poolOffices: string[][] = [];
  for (const id of pool) {
    const days = new Set(byId.get(id)!.days);
    const slot = poolOffices.find((o) =>
      o.every((m) => byId.get(m)!.days.every((d) => !days.has(d))),
    );
    if (slot) slot.push(id);
    else poolOffices.push([id]);
  }

  // numbering + placement, engine order: dedicated, pairs, pool
  const groups: { tier: Assignment["tier"]; members: string[] }[] = [
    ...dedicated.map((i) => ({ tier: "ded" as const, members: [i] })),
    ...pairs.map(([x, y]) => ({ tier: "pair" as const, members: [x, y] })),
    ...poolOffices.map((m) => ({ tier: "pool" as const, members: m })),
  ];
  const assign = new Map<string, Assignment>();
  const unplaced: string[] = [];
  groups.forEach((g, idx) => {
    const office = `O${String(idx + 1).padStart(3, "0")}`;
    const placed = idx + 1 <= usable;
    for (const m of g.members) {
      assign.set(m, {
        office,
        tier: g.tier,
        with: g.members.filter((x) => x !== m),
        placed,
      });
      if (!placed) unplaced.push(m);
    }
  });

  return {
    dedicated,
    pairs,
    poolOffices,
    outOfScope,
    assign,
    unplaced: unplaced.sort(),
    needed: groups.length,
    usable,
    stable,
  };
}

/**
 * Charter 4.1: colleagues who name EACH OTHER are paired first, before any
 * optimization — regardless of pattern, provided their days don't collide
 * (3.2). Everyone else flows through allocate() unchanged. Dedicated (2.4)
 * still outranks pairing, per the 3.1 tier order.
 */
export function allocateWithPreferences(
  people: Person[],
  offices: number,
  dials: Dials,
  partnerPref: Map<string, string>, // userId -> preferred partner userId
): Allocation & { namedPairs: [string, string][] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const eligible = (id: string) =>
    byId.has(id) &&
    byId.get(id)!.days.length < dials.thresholdDays && // dedicated outranks
    !(dials.adjunctsInScope === false && byId.get(id)!.nSections === 1);

  const namedPairs: [string, string][] = [];
  const taken = new Set<string>();
  for (const [a, b] of partnerPref) {
    if (taken.has(a) || taken.has(b) || a >= b) continue; // visit each pair once
    if (partnerPref.get(b) !== a) continue; // must be MUTUAL
    if (!eligible(a) || !eligible(b)) continue;
    const daysA = new Set(byId.get(a)!.days);
    const collide = byId.get(b)!.days.some((d) => daysA.has(d));
    if (collide) continue; // 3.2 — days never collide; falls back to the engine
    namedPairs.push([a, b]);
    taken.add(a);
    taken.add(b);
  }

  const rest = people.filter((p) => !taken.has(p.id));
  const base = allocate(rest, offices, dials);

  // renumber with named pairs first among pair-tier offices, after dedicated
  const groups: { tier: Assignment["tier"]; members: string[] }[] = [
    ...base.dedicated.map((i) => ({ tier: "ded" as const, members: [i] })),
    ...namedPairs.map(([x, y]) => ({ tier: "pair" as const, members: [x, y] })),
    ...base.pairs.map(([x, y]) => ({ tier: "pair" as const, members: [x, y] })),
    ...base.poolOffices.map((m) => ({ tier: "pool" as const, members: m })),
  ];
  const usable = base.usable;
  const assign = new Map<string, Assignment>();
  const unplaced: string[] = [];
  groups.forEach((g, idx) => {
    const office = `O${String(idx + 1).padStart(3, "0")}`;
    const placed = idx + 1 <= usable;
    for (const m of g.members) {
      assign.set(m, { office, tier: g.tier, with: g.members.filter((x) => x !== m), placed });
      if (!placed) unplaced.push(m);
    }
  });

  return {
    ...base,
    pairs: [...namedPairs, ...base.pairs],
    namedPairs,
    assign,
    unplaced: unplaced.sort(),
    needed: groups.length,
  };
}
