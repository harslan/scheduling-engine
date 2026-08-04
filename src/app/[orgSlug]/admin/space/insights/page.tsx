import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { currentSemester } from "@/lib/semester";

/**
 * The utilization picture the Dean asked for — computed from measured
 * teaching records, honest about what needs the full time-of-day feed.
 */
export default async function InsightsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) redirect("/");
  await requireOrgRole(org.id, ["ADMIN", "MANAGER"]);

  const semester = currentSemester();
  const records = await prisma.teachingRecord.findMany({
    where: { organizationId: org.id, semester },
  });
  const run = await prisma.spaceRun.findFirst({
    where: { organizationId: org.id, semester },
    orderBy: { createdAt: "desc" },
  });

  const DAYS = ["M", "T", "W", "TH", "F"];
  const DAYN: Record<string, string> = { M: "Mon", T: "Tue", W: "Wed", TH: "Thu", F: "Fri" };
  const daysOf = (r: { days: string }) => r.days.split(",").filter(Boolean);

  const perDay = DAYS.map((d) => ({
    day: DAYN[d],
    n: records.filter((r) => daysOf(r).includes(d)).length,
  }));
  const patterns = new Map<string, number>();
  for (const r of records) {
    const key = daysOf(r).join("/") || "—";
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }
  const topPatterns = [...patterns].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const qualifying = [2, 3, 4, 5].map((t) => ({
    t,
    n: records.filter((r) => daysOf(r).length >= t).length,
  }));
  const freed = run ? records.length - run.needed : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          Space insights — {semester}
        </h1>
        <p className="text-sm text-slate-500">
          Measured teaching, {records.length} faculty. The floor on presence —
          office hours, advising, and research days are invisible to this data
          and can only raise these numbers.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          Faculty on campus, by day
        </h2>
        <div className="space-y-2">
          {perDay.map(({ day, n }) => (
            <div key={day} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-slate-500">{day}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-primary h-4"
                  style={{
                    width: `${records.length ? (n / records.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="w-8 text-right font-semibold text-slate-700">
                {n}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Friday tells the story: capacity for occasional needs, nearly free.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            Teaching patterns
          </h2>
          <ul className="text-sm text-slate-600 space-y-1">
            {topPatterns.map(([p, n]) => (
              <li key={p} className="flex justify-between">
                <span>{p}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            Complementary patterns are why sharing works — they interleave.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            Dedicated tier at each threshold
          </h2>
          <ul className="text-sm text-slate-600 space-y-1">
            {qualifying.map(({ t, n }) => (
              <li key={t} className="flex justify-between">
                <span>{t}+ teaching days</span>
                <span className="font-semibold">
                  {n} of {records.length}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            The charter dial (2.4) decides which line is the rule.
          </p>
        </div>
      </div>

      {run && freed !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="text-2xl font-extrabold text-amber-800">
            {freed} offices freed
          </div>
          <p className="text-sm text-amber-900 mt-1">
            {records.length} faculty served by {run.needed} offices under the
            latest run, versus one office per person. Space that can become
            student space — the objective, inverted: this system maximizes what
            sharing makes possible, subject to the fairness floors.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Peak simultaneous presence by clock time needs the full time-of-day
        registrar feed — it arrives with the registrar connection, and these
        numbers are labeled a floor until then.
      </p>
    </div>
  );
}
