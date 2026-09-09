import { prisma } from "@/lib/prisma";
import { getOrgMembership } from "@/lib/session";
import { redirect } from "next/navigation";
import { currentSemester } from "@/lib/semester";
import Link from "next/link";
import { SwapPanel } from "./swap-panel";

/** Your office, and the reasons — the reveal with its trace (charter 3/4/6). */
export default async function MySpacePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) redirect("/");
  const { user, membership } = await getOrgMembership(org.id);
  if (!membership) redirect(`/${orgSlug}`);

  const semester = currentSemester();
  const run = await prisma.spaceRun.findFirst({
    where: { organizationId: org.id, semester },
    orderBy: { createdAt: "desc" },
    include: { assignments: true },
  });
  const mine = run?.assignments.find((a) => a.userId === user.id);
  const record = await prisma.teachingRecord.findUnique({
    where: {
      organizationId_userId_semester: {
        organizationId: org.id,
        userId: user.id,
        semester,
      },
    },
  });
  const dials = run ? JSON.parse(run.dialsSnapshot) : null;

  const mates = mine?.withUserIds
    ? await prisma.user.findMany({
        where: { id: { in: mine.withUserIds.split(",").filter(Boolean) } },
      })
    : [];
  const room = mine?.roomSlug
    ? await prisma.room.findFirst({
        where: { organizationId: org.id, slug: mine.roomSlug },
      })
    : null;

  const TIER: Record<string, string> = {
    ded: "a dedicated office",
    pair: "a shared office — stable pair",
    pool: "a guaranteed pool seat",
    bookable: "bookable private rooms",
  };
  const days = record?.days ? record.days.split(",").join(", ") : "";

  const trace: [string, string][] = [];
  if (mine && record && dials) {
    trace.push([
      "2.4",
      `You teach on ${record.days.split(",").filter(Boolean).length} distinct weekday(s); the threshold is ${dials.thresholdDays}.`,
    ]);
    if (mine.tier === "ded")
      trace.push(["2.5", "At or above the threshold, the room is not shared."]);
    if (mine.tier === "pair")
      trace.push([
        "4.2",
        `Matched with ${mates.map((m) => m.name).join(", ") || "a complementary colleague"} — stability verified: no two people would both rather have swapped.`,
      ]);
    if (mine.tier === "pool")
      trace.push(["3.3", "A guaranteed, semester-long seat — never a scramble."]);
    if (mine.tier === "bookable")
      trace.push([
        "5.1",
        "Single-section schedule with adjuncts outside the pool under the current dial — guaranteed landing via the private rooms, an hour either side of class.",
      ]);
    trace.push([
      "6.1",
      `Standard office guarantee: enclosed, lockable, ≥ ${dials.minSf} sf. A cube never counts.`,
    ]);
    if (room?.hasWindow)
      trace.push(
        dials.windowPolicy === "presence"
          ? [
              "6.3",
              "A window office. Under the ratified rule, windows go to the highest-priority schedules first, among the offices that fit yours, and yours ranked in.",
            ]
          : [
              "6.3",
              "This office has a window. The charter does not prioritize windows right now, so it came with the room, not from the rule.",
            ],
      );
    if (mates.length > 0 && (room?.deskCapacity ?? 1) >= 2)
      trace.push([
        "6.4",
        "Room enough for two desks, so you and your officemate each keep your own space, even though your days never overlap.",
      ]);
    if (!mine.placed)
      trace.push([
        "8.1",
        "Unplaced at the current dials — reported by name to the Dean, never absorbed. This is the alarm working; nothing is taken from you.",
      ]);
    trace.push([
      "8.3",
      "Disagree with any line above? Request human review — write to the Dean's office; a person, not the system, answers within ten working days. Nothing on this page is beyond appeal.",
    ]);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          My space — {semester}
        </h1>
        <p className="text-sm text-slate-500">
          {run
            ? `From the latest ${run.status.toLowerCase()} run. Nothing is final until the charter is ratified.`
            : "No allocation has been run yet."}
        </p>
      </div>

      {mine ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="text-3xl font-extrabold text-primary border-2 border-primary rounded-xl px-4 py-2">
              {room?.name ?? (mine.tier === "bookable" ? "Private rooms" : mine.roomSlug)}
            </div>
            <div>
              <div className="font-bold text-slate-900">{TIER[mine.tier]}</div>
              <div className="text-sm text-slate-500">
                {days && <>Your days: {days}. </>}
                {mates.length > 0 && (
                  <>
                    Shared with{" "}
                    <b>{mates.map((m) => m.name).join(", ")}</b> — your days
                    never collide.
                  </>
                )}
              </div>
              {(room?.hasWindow || (mates.length > 0 && (room?.deskCapacity ?? 1) >= 2)) && (
                <div className="flex gap-2 mt-2">
                  {room?.hasWindow && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      Window
                    </span>
                  )}
                  {mates.length > 0 && (room?.deskCapacity ?? 1) >= 2 && (
                    <span className="text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2.5 py-0.5">
                      Two desks
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {trace.length > 0 && (
            <ul className="mt-5 border-t border-slate-100 pt-1">
              {trace.map(([cl, tx]) => (
                <li
                  key={cl + tx.slice(0, 8)}
                  className="grid grid-cols-[44px_1fr] gap-3 py-2 border-b border-slate-100 last:border-0 text-sm text-slate-600"
                >
                  <span className="font-bold text-primary">{cl}</span>
                  <span>{tx}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : run ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-sm text-slate-600">
          You&apos;re not in this run — no measured teaching this semester. Your
          standing is fully retained (charter 1.3): you keep the private rooms,
          the open Fridays, and a guaranteed landing whenever you&apos;re on
          campus, and you&apos;ll be placed at the next allocation.
        </div>
      ) : null}

      {run && mine && mine.placed && mine.roomSlug && (
        <SwapPanel
          organizationId={org.id}
          semester={semester}
          options={await swapOptions(org.id, run.id, user.id)}
          incoming={await incomingSwaps(org.id, semester, user.id)}
          outgoing={await outgoingSwaps(org.id, semester, user.id)}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-1">Let students find you</h2>
        <p className="text-sm text-slate-500 mb-3">
          Publish your office hours — when you&apos;re in and where. It&apos;s the one thing the
          model can&apos;t read from your schedule, so it only exists if you say it. You control
          whether your live location shows.
        </p>
        <Link
          className="text-primary font-medium text-sm"
          href={`/${orgSlug}/office-hours`}
        >
          Publish my office hours →
        </Link>
      </div>

      <p className="text-sm">
        <Link className="text-primary font-medium" href={`/${orgSlug}/declare`}>
          Update my declaration →
        </Link>
      </p>
    </div>
  );
}

async function swapOptions(organizationId: string, runId: string, meId: string) {
  const asgs = await prisma.spaceAssignment.findMany({
    where: { runId, placed: true, NOT: [{ roomSlug: "" }, { userId: meId }] },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: asgs.map((a) => a.userId) } },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));
  const rooms = await prisma.room.findMany({ where: { organizationId } });
  const roomName = new Map(rooms.map((r) => [r.slug, r.name]));
  return asgs
    .map((a) => ({
      userId: a.userId,
      label: `${nameOf.get(a.userId)} — ${roomName.get(a.roomSlug) ?? a.roomSlug}`,
    }))
    .sort((x, y) => x.label.localeCompare(y.label));
}

async function incomingSwaps(organizationId: string, semester: string, meId: string) {
  const swaps = await prisma.spaceSwap.findMany({
    where: { organizationId, semester, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const approvals = swaps.length
    ? await prisma.swapApproval.findMany({
        where: { swapId: { in: swaps.map((s) => s.id) } },
      })
    : [];
  const approvedBy = new Map<string, Set<string>>();
  for (const a of approvals) {
    (approvedBy.get(a.swapId) ?? approvedBy.set(a.swapId, new Set()).get(a.swapId)!).add(a.userId);
  }
  const mine = swaps.filter(
    (s) =>
      s.neededUserIds.split(",").includes(meId) &&
      !(approvedBy.get(s.id)?.has(meId) ?? false) &&
      s.proposerId !== meId,
  );
  const ids = [...new Set(mine.flatMap((s) => [s.proposerId, s.targetId]))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));
  return mine.map((s) => ({
    id: s.id,
    label: `${nameOf.get(s.proposerId)} ⇄ ${nameOf.get(s.targetId)}`,
    progress: `${approvedBy.get(s.id)?.size ?? 0}/${s.neededUserIds.split(",").filter(Boolean).length} consented`,
  }));
}

async function outgoingSwaps(organizationId: string, semester: string, meId: string) {
  const swaps = await prisma.spaceSwap.findMany({
    where: { organizationId, semester, proposerId: meId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const ids = [...new Set(swaps.map((s) => s.targetId))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));
  return swaps.map((s) => ({
    id: s.id,
    label: `with ${nameOf.get(s.targetId)}`,
    status: s.status,
  }));
}
