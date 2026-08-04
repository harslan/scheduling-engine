import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { CharterForm } from "./charter-form";

/** The dials, changeable only with a reason — and the log that proves it. */
export default async function CharterPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) redirect("/");
  await requireOrgRole(org.id, ["ADMIN"]);

  const charter =
    (await prisma.spaceCharter.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.spaceCharter.create({ data: { organizationId: org.id } }));

  const changes = await prisma.charterChange.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const byIds = [...new Set(changes.map((c) => c.byUserId))];
  const users = byIds.length
    ? await prisma.user.findMany({ where: { id: { in: byIds } } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          The charter — dials and log
        </h1>
        <p className="text-sm text-slate-500">
          Every change requires a written reason and lands in the log below. A
          quiet edit is not an amendment. Status:{" "}
          {charter.ratifiedBy ? (
            <span className="font-semibold text-emerald-700">
              RATIFIED by {charter.ratifiedBy}
            </span>
          ) : (
            <span className="font-semibold text-amber-700">
              DRAFT — every run is a simulation
            </span>
          )}
        </p>
      </div>

      <CharterForm
        organizationId={org.id}
        charter={{
          thresholdDays: charter.thresholdDays,
          reservedOffices: charter.reservedOffices,
          slackFraction: charter.slackFraction,
          adjunctsInScope: charter.adjunctsInScope,
          minSf: charter.minSf,
          privateRoomSlugs: charter.privateRoomSlugs,
          ratified: Boolean(charter.ratifiedBy),
        }}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          Change log — the boundary log, in product
        </h2>
        {changes.length === 0 ? (
          <p className="text-sm text-slate-400">
            No changes yet. When there are, each will show who, when, what, and
            why.
          </p>
        ) : (
          <ul className="space-y-3">
            {changes.map((c) => (
              <li
                key={c.id}
                className="text-sm border-b border-slate-100 last:border-0 pb-3 last:pb-0"
              >
                <div className="text-slate-800">
                  <b>{c.field}</b>: {c.fromValue} → {c.toValue}
                </div>
                <div className="text-slate-500">{c.reason}</div>
                <div className="text-xs text-slate-400">
                  {nameOf.get(c.byUserId) ?? c.byUserId} ·{" "}
                  {c.createdAt.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
