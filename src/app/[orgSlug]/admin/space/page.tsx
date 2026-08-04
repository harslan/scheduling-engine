import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { currentSemester } from "@/lib/semester";
import { RunButton } from "./run-button";

/** The Dean's screen: the dials, the run, the alarm. */
export default async function AdminSpacePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) redirect("/");
  await requireOrgRole(org.id, ["ADMIN", "MANAGER"]);

  const semester = currentSemester();
  const charter =
    (await prisma.spaceCharter.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.spaceCharter.create({ data: { organizationId: org.id } }));

  const run = await prisma.spaceRun.findFirst({
    where: { organizationId: org.id, semester },
    orderBy: { createdAt: "desc" },
    include: { assignments: true },
  });

  const userIds = run?.assignments.map((a) => a.userId) ?? [];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));
  const unplaced = run?.assignments.filter((a) => !a.placed) ?? [];
  const tierCount = (t: string) =>
    run?.assignments.filter((a) => a.tier === t && a.placed).length ?? 0;

  const dial = (v: unknown) =>
    v === null || v === undefined ? (
      <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs font-bold">
        UNDECIDED
      </span>
    ) : (
      <span className="font-semibold">{String(v)}</span>
    );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          Space allocation — {semester}
        </h1>
        <p className="text-sm text-slate-500">
          Measured teaching in, fair assignment out. Runs are{" "}
          <span className="font-semibold">
            {charter.ratifiedBy ? "OFFICIAL" : "simulations"}
          </span>{" "}
          until the charter is ratified.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">The dials</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600">
          <div>Dedicated threshold: {dial(charter.thresholdDays)} days</div>
          <div>Reserved offices: {dial(charter.reservedOffices)}</div>
          <div>Adjuncts in scope: {dial(charter.adjunctsInScope)}</div>
          <div>Slack reserve: {dial(charter.slackFraction)}</div>
          <div>Standard office: {dial(charter.minSf)} sf min</div>
          <div>
            Private rooms:{" "}
            {dial(charter.privateRoomSlugs || null)}
          </div>
        </div>
      </div>

      <RunButton organizationId={org.id} semester={semester} />

      {run ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Latest run — {run.status}
            </h2>
            <span className="text-xs text-slate-400">
              {run.createdAt.toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              [tierCount("ded"), "dedicated"],
              [tierCount("pair"), "in pairs"],
              [tierCount("pool"), "pool"],
              [`${run.needed} / ${run.usable}`, "needed / usable"],
            ].map(([n, l]) => (
              <div
                key={String(l)}
                className="border border-slate-200 rounded-lg py-3"
              >
                <div className="text-xl font-bold text-slate-900">{n}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {l}
                </div>
              </div>
            ))}
          </div>
          <p
            className={`text-sm rounded-lg px-4 py-3 border ${
              run.needed > run.usable
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {run.needed > run.usable ? (
              <>
                <b>Over capacity by {run.needed - run.usable}.</b> The rule
                refuses to squeeze anyone — the people affected are named below,
                and this is a signal to you, not a penalty on them.
              </>
            ) : (
              <>
                <b>Fits with {run.usable - run.needed} to spare.</b> Pair
                stability {run.stable ? "verified — no blocking pair." : "FAILED."}
              </>
            )}
          </p>
          {unplaced.length > 0 && (
            <div className="text-sm text-red-800">
              Unplaced:{" "}
              {unplaced.map((a) => nameOf.get(a.userId) ?? a.userId).join(", ")}
            </div>
          )}
          <p className="text-xs text-slate-400">
            {run.notTeaching} roster member
            {run.notTeaching === 1 ? "" : "s"} with no measured teaching this
            semester — standing retained (charter 1.3), not in this run.
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No run yet for {semester}. Run one above — it&apos;s a simulation, so
          nothing is assigned for real.
        </p>
      )}
    </div>
  );
}
