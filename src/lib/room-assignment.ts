/**
 * Office -> room mapping, the layer beneath the stable matching.
 *
 * allocate() decides WHO shares with WHOM and the tier; it hands back abstract
 * offices O001.. in PRIORITY order (dedicated by measured presence, then pairs,
 * then pool). This module turns those into REAL rooms, and it is the only place
 * room quality — a window, room for two desks — enters the allocation.
 *
 * The rule is deliberately the same one that sets the tiers: measured priority,
 * in order. Each group, highest priority first, takes the best room for it:
 *   1. Desk-appropriate first. A shared office (two people) prefers a room that
 *      fits two desks, so each colleague keeps their own space; a solo office
 *      does not need one, so two-desk rooms are saved for sharers when possible.
 *   2. Among those, a window is preferred — so a window is earned the same way a
 *      dedicated office is: by ranking high enough, in order.
 *   3. Then the room's own sort order, keeping placement stable.
 *
 * Because everyone who shares is day-disjoint (never in on the same day), two
 * desks is a matter of each person having their own space, not of fitting two
 * people at once — so it is a preference, never a hard constraint.
 */

export type OfficeGroup = {
  office: string; // "O001"
  size: number; // people in the group (1 = solo, 2 = shared)
  tier: "ded" | "pair" | "pool";
};

export type AssignableRoom = {
  slug: string;
  sortOrder: number;
  hasWindow: boolean;
  deskCapacity: number;
};

/** Map offices (priority order) to rooms. Groups past the stock get no room. */
export function assignRoomsToGroups<R extends AssignableRoom>(
  groups: OfficeGroup[],
  rooms: R[],
): Map<string, R> {
  const available = [...rooms];
  const out = new Map<string, R>();
  for (const g of groups) {
    if (available.length === 0) break;
    const sharer = g.size >= 2;
    const score = (r: R): [number, number, number] => [
      // desk-appropriate first (sharers want >=2, solos leave >=2 for sharers)
      sharer ? (r.deskCapacity >= 2 ? 0 : 1) : r.deskCapacity < 2 ? 0 : 1,
      r.hasWindow ? 0 : 1, // then window, so windows go by priority order
      r.sortOrder, // then stable
    ];
    let best = 0;
    for (let i = 1; i < available.length; i++) {
      const a = score(available[i]);
      const b = score(available[best]);
      if (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) {
        if (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) best = i;
      }
    }
    out.set(g.office, available.splice(best, 1)[0]);
  }
  return out;
}

/** Rebuild the office groups (priority order, with size + tier) from an
 *  allocation's per-person assignments, keyed by the O00N label order. */
export function groupsFromAssignments(
  assign: Map<string, { office: string; tier: OfficeGroup["tier"]; with: string[] }>,
): OfficeGroup[] {
  const byOffice = new Map<string, OfficeGroup>();
  for (const [, a] of assign) {
    if (!byOffice.has(a.office)) {
      byOffice.set(a.office, { office: a.office, size: 1 + a.with.length, tier: a.tier });
    }
  }
  return [...byOffice.values()].sort((x, y) => x.office.localeCompare(y.office));
}
