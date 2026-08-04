import { prisma } from "@/lib/prisma";
import { getOrgMembership } from "@/lib/session";
import { redirect } from "next/navigation";
import { currentSemester } from "@/lib/semester";
import Link from "next/link";

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
    if (!mine.placed)
      trace.push([
        "8.1",
        "Unplaced at the current dials — reported by name to the Dean, never absorbed. This is the alarm working; nothing is taken from you.",
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

      <p className="text-sm">
        <Link className="text-primary font-medium" href={`/${orgSlug}/declare`}>
          Update my declaration →
        </Link>
      </p>
    </div>
  );
}
