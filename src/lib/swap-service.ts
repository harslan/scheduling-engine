import { prisma } from "./prisma";
import { affectedUsers, applySwap, type Asg } from "./swap";
import { materializeHolds } from "./space-run";

/** Swap orchestration (charter 5.3). Auth lives in the actions; this layer is
 * scriptable and testable. A swap applies ONLY when everyone sharing either
 * office has consented; any decline kills it. */

async function latestRun(organizationId: string, semester: string) {
  return prisma.spaceRun.findFirst({
    where: { organizationId, semester },
    orderBy: { createdAt: "desc" },
    include: { assignments: true },
  });
}

const toAsg = (a: {
  userId: string;
  roomSlug: string;
  tier: string;
  withUserIds: string;
  placed: boolean;
}): Asg => ({
  userId: a.userId,
  roomSlug: a.roomSlug,
  tier: a.tier,
  withUserIds: a.withUserIds,
  placed: a.placed,
});

export async function proposeSwap(
  organizationId: string,
  semester: string,
  proposerId: string,
  targetId: string,
) {
  if (proposerId === targetId) return { error: "Pick a colleague, not yourself." };
  const run = await latestRun(organizationId, semester);
  if (!run) return { error: "No allocation run exists yet." };
  const affected = affectedUsers(run.assignments.map(toAsg), proposerId, targetId);
  if ("error" in affected) return affected;
  const swap = await prisma.spaceSwap.create({
    data: {
      organizationId,
      semester,
      runId: run.id,
      proposerId,
      targetId,
      neededUserIds: affected.join(","),
    },
  });
  return { success: true, swapId: swap.id, needed: affected };
}

export async function actOnSwap(
  swapId: string,
  userId: string,
  decision: "consent" | "decline",
) {
  const swap = await prisma.spaceSwap.findUnique({ where: { id: swapId } });
  if (!swap || swap.status !== "pending") return { error: "Swap is not pending." };

  // Belt to the run-time braces: never act on a swap proposed against a
  // superseded run — applying it would rewrite the calendar from stale
  // assignments. (Runs also expire pending swaps when created.)
  const latestRunRow = await prisma.spaceRun.findFirst({
    where: { organizationId: swap.organizationId, semester: swap.semester },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latestRunRow || latestRunRow.id !== swap.runId) {
    await prisma.spaceSwap.updateMany({
      where: { id: swapId, status: "pending" },
      data: { status: "expired" },
    });
    return {
      error:
        "The allocation has been re-run since this swap was proposed, so it expired. Propose it again against the current assignments.",
    };
  }

  const needed = swap.neededUserIds.split(",").filter(Boolean);
  if (!needed.includes(userId))
    return { error: "This swap doesn't affect your space." };

  if (decision === "decline") {
    // conditional: only a still-pending swap can be declined
    await prisma.spaceSwap.updateMany({
      where: { id: swapId, status: "pending" },
      data: { status: "declined" },
    });
    return { success: true, status: "declined" };
  }

  // Race-safe consent: an approval is a row (idempotent — the unique
  // constraint absorbs double-clicks and concurrent submits)...
  await prisma.swapApproval
    .create({ data: { swapId, userId } })
    .catch(() => undefined); // already approved: fine

  const approvals = await prisma.swapApproval.count({ where: { swapId } });
  if (approvals < needed.length) return { success: true, status: "pending" };

  // ...and the pending->accepted transition is a SINGLE-WINNER conditional
  // update: of two concurrent final consents, exactly one applies the swap.
  const won = await prisma.spaceSwap.updateMany({
    where: { id: swapId, status: "pending" },
    data: { status: "accepted", approvedUserIds: needed.join(",") },
  });
  if (won.count === 0) return { success: true, status: "accepted" };

  // unanimous — apply to the run and rewrite the calendar
  const run = await prisma.spaceRun.findUniqueOrThrow({
    where: { id: swap.runId },
    include: { assignments: true },
  });
  const changed = applySwap(
    run.assignments.map(toAsg),
    swap.proposerId,
    swap.targetId,
  );
  await prisma.$transaction(
    changed.map((c) =>
      prisma.spaceAssignment.update({
        where: { runId_userId: { runId: run.id, userId: c.userId } },
        data: {
          roomSlug: c.roomSlug,
          tier: c.tier,
          withUserIds: c.withUserIds,
          placed: c.placed,
        },
      }),
    ),
  );
  await materializeHolds(swap.organizationId, run.id, swap.semester);
  return { success: true, status: "accepted" };
}
