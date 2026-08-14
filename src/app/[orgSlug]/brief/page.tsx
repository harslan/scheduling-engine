import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { currentSemester } from "@/lib/semester";
import { redirect } from "next/navigation";
import Link from "next/link";
import { declaredPresence, DAY_ORDER } from "@/lib/office-hours";

/**
 * The Dean's brief — the whole argument on one screen, in the Dean's
 * vocabulary. This is the pilot's front door for administrators: the
 * question, the number, the three open decisions, and where to poke it.
 * Everything else in the product is the appendix.
 */
export default async function BriefPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) redirect("/");
  await requireOrgRole(org.id, ["ADMIN", "MANAGER"]);

  const semester = currentSemester();
  const charter = await prisma.spaceCharter.findUnique({
    where: { organizationId: org.id },
  });
  const run = await prisma.spaceRun.findFirst({
    where: { organizationId: org.id, semester },
    orderBy: { createdAt: "desc" },
    include: { assignments: true },
  });

  const unplaced = run?.assignments.filter((a) => !a.placed) ?? [];
  const unplacedUsers = unplaced.length
    ? await prisma.user.findMany({
        where: { id: { in: unplaced.map((a) => a.userId) } },
      })
    : [];
  const tierCount = (t: string) =>
    run?.assignments.filter((a) => a.tier === t && a.placed).length ?? 0;
  const inScope = run
    ? run.assignments.filter((a) => a.tier !== "bookable").length
    : 0;

  // Office hours — the demand model's first admitted blind spot, turned into
  // faculty-signed data. A coverage instrument, not a finished number.
  const officeHours = await prisma.officeHours.findMany({
    where: { organizationId: org.id, semester, publish: true },
    select: { blocks: true },
  });
  const declared = declaredPresence(officeHours);
  const nScope = await prisma.organizationMember.count({
    where: { organizationId: org.id },
  });
  const nPublished = officeHours.filter((o) => o.blocks.length > 0).length;
  const coveragePct = nScope ? Math.round((100 * nPublished) / nScope) : 0;

  const undecided = (label: string) => (
    <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs font-bold">
      {label}
    </span>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Does SBS fit in Sargent 5 — and on what rule?
        </h1>
        <p className="text-sm text-slate-500">
          {semester}, the real registrar schedule under invented names. Every
          number below is produced by the run, not typed into a slide.
        </p>
      </div>

      {run ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-baseline gap-4 flex-wrap">
            <div className="text-5xl font-extrabold text-slate-900">
              {run.needed}&thinsp;/&thinsp;{run.usable}
            </div>
            <div className="text-sm text-slate-600">
              offices needed / usable —{" "}
              <b>
                {run.needed > run.usable
                  ? `short by ${run.needed - run.usable}`
                  : "it fits"}
              </b>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The rule fits {inScope} teaching faculty into {run.needed} offices
            instead of {inScope}: {tierCount("ded")} earn a dedicated office
            (4-day schedules), {tierCount("pair")} share in stable pairs whose
            days never collide, {tierCount("pool")} hold guaranteed pool seats.
            {unplaced.length > 0 && (
              <>
                {" "}
                The shortfall has names, not a percentage:{" "}
                <b>
                  {unplacedUsers.map((u) => u.name || u.email).join(", ")}
                </b>
                . &ldquo;Short by one&rdquo; is the system working — it turns
                &ldquo;does SBS fit?&rdquo; into &ldquo;we need one more
                room.&rdquo;
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
          No allocation has been run yet this semester.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          Office hours — the invisible gap, closing
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          The demand model lists office hours <i>first</i> under &ldquo;not modeled &mdash;
          biases demand downward,&rdquo; because the registrar feed can&rsquo;t see them. As
          faculty publish on the{" "}
          <Link className="text-primary" href={`/find/${orgSlug}`}>
            student map
          </Link>
          , that guess becomes signed data &mdash; and unlike the buffer, it&rsquo;s measured.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-slate-50 border border-slate-200 rounded-lg py-3">
            <div className="text-2xl font-bold text-slate-900">
              {nPublished}
              <span className="text-sm text-slate-400">/{nScope}</span>
            </div>
            <div className="text-xs text-slate-500">faculty declared</div>
          </div>
          <div className="text-center bg-slate-50 border border-slate-200 rounded-lg py-3">
            <div className="text-2xl font-bold text-slate-900">{coveragePct}%</div>
            <div className="text-xs text-slate-500">coverage</div>
          </div>
          <div className="text-center bg-slate-50 border border-slate-200 rounded-lg py-3">
            <div className="text-2xl font-bold text-slate-900">{declared.peakOverall}</div>
            <div className="text-xs text-slate-500">peak in office at once</div>
          </div>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {DAY_ORDER.map((d) => (
              <tr key={d} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 text-slate-500 font-semibold w-16">{d}</td>
                <td className="py-1.5 text-slate-700">
                  {declared.perDay[d].peak}
                  {declared.perDay[d].atClock && (
                    <span className="text-slate-400"> @ {declared.perDay[d].atClock}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-3">
          <b>Read this as a floor, not a total.</b> It reflects only the {nPublished} who have
          published &mdash; at {coveragePct}% coverage it is nowhere near complete. Virtual hours
          are excluded: they serve students but occupy no office. Shown as its own series, never
          added to the buffer estimate &mdash; overlap would double-count, the quiet imputation
          this project refuses.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          Your three decisions — deliberately still open
        </h2>
        <ul className="text-sm text-slate-600 space-y-2">
          <li>
            <b>Dedicated threshold:</b> {charter?.thresholdDays ?? 4} teaching
            days currently earn an unshared office.
          </li>
          <li>
            <b>Adjuncts in the shared pool:</b>{" "}
            {charter?.adjunctsInScope === null || charter?.adjunctsInScope === undefined
              ? undecided("UNDECIDED")
              : String(charter.adjunctsInScope)}
          </li>
          <li>
            <b>Slack reserve held back:</b>{" "}
            {charter?.slackFraction === null || charter?.slackFraction === undefined
              ? undecided("UNDECIDED")
              : charter.slackFraction}
          </li>
        </ul>
        <p className="text-xs text-slate-400 mt-3">
          Each is a setting, not code — changing one requires a written reason
          that lands in a public log, and the run recomputes instantly.
        </p>
      </div>

      <div className="text-sm text-slate-600 leading-relaxed">
        <b>The rule in one sentence:</b> offices are earned by measured teaching
        from the registrar&rsquo;s feed — never by rank or negotiation; the
        four Law School offices are protected by name; Fridays the floor runs
        open; nobody&rsquo;s office changes without their written consent; and
        every run is a simulation until faculty ratify the rule.
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${orgSlug}/admin/space`}
          className="bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90"
        >
          See the full run &amp; the dials
        </Link>
        <Link
          href={`/${orgSlug}/admin/space/insights`}
          className="border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Day-by-day presence
        </Link>
        <Link
          href={`/${orgSlug}/admin/space/charter`}
          className="border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          The charter &amp; its log
        </Link>
      </div>

      <p className="text-xs text-slate-400 border-t border-slate-100 pt-4">
        The faculty side of this story — the clause-numbered office reveal and
        swap-by-consent — is best seen through the faculty demo login. Nothing
        anywhere in this pilot assigns anyone anything.
      </p>
    </div>
  );
}
