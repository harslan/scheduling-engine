/**
 * Swap-by-consent, pure logic (charter 5.3): any two colleagues may trade —
 * and where a swap changes who shares a space, everyone sharing the affected
 * spaces must consent. No one's officemate changes without their agreement.
 */

export type Asg = {
  userId: string;
  roomSlug: string;
  tier: string;
  withUserIds: string;
  placed: boolean;
};

const membersOf = (asgs: Asg[], roomSlug: string) =>
  asgs.filter((a) => a.roomSlug === roomSlug && a.roomSlug !== "");

/** Everyone whose shared space changes — both offices' members, minus proposer. */
export function affectedUsers(
  asgs: Asg[],
  proposerId: string,
  targetId: string,
): string[] | { error: string } {
  const p = asgs.find((a) => a.userId === proposerId);
  const t = asgs.find((a) => a.userId === targetId);
  if (!p || !t) return { error: "Both people must be in the current run." };
  if (!p.placed || !t.placed || !p.roomSlug || !t.roomSlug)
    return { error: "Swaps need two placed office assignments." };
  if (p.roomSlug === t.roomSlug)
    return { error: "You already share this office." };
  const affected = new Set<string>();
  for (const m of [...membersOf(asgs, p.roomSlug), ...membersOf(asgs, t.roomSlug)])
    affected.add(m.userId);
  affected.delete(proposerId);
  return [...affected].sort();
}

/** Apply an accepted swap: exchange the two people between offices and
 * recompute officemates for everyone in both rooms. Tier and placement follow
 * the office. Returns ONLY the changed assignments. */
export function applySwap(
  asgs: Asg[],
  proposerId: string,
  targetId: string,
): Asg[] {
  const p = asgs.find((a) => a.userId === proposerId)!;
  const t = asgs.find((a) => a.userId === targetId)!;
  const roomA = p.roomSlug;
  const roomB = t.roomSlug;
  const tierA = p.tier;
  const tierB = t.tier;
  const placedA = p.placed;
  const placedB = t.placed;

  const newA = [
    ...membersOf(asgs, roomA).filter((a) => a.userId !== proposerId),
    t,
  ].map((a) => a.userId);
  const newB = [
    ...membersOf(asgs, roomB).filter((a) => a.userId !== targetId),
    p,
  ].map((a) => a.userId);

  const changed: Asg[] = [];
  for (const uid of newA) {
    changed.push({
      userId: uid,
      roomSlug: roomA,
      tier: uid === targetId ? tierA : asgs.find((a) => a.userId === uid)!.tier,
      withUserIds: newA.filter((x) => x !== uid).join(","),
      placed: placedA,
    });
  }
  for (const uid of newB) {
    changed.push({
      userId: uid,
      roomSlug: roomB,
      tier: uid === proposerId ? tierB : asgs.find((a) => a.userId === uid)!.tier,
      withUserIds: newB.filter((x) => x !== uid).join(","),
      placed: placedB,
    });
  }
  return changed;
}
