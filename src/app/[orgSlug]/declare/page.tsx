import { prisma } from "@/lib/prisma";
import { getOrgMembership } from "@/lib/session";
import { redirect } from "next/navigation";
import { currentSemester } from "@/lib/semester";
import { DeclareForm } from "./form";

/**
 * The semester declaration (Phase 1 of the SBS product — see PRODUCT.md).
 * Charter 2.2 is the design: what you declare shapes scheduling and pairing,
 * never entitlement, so the page says so and the tier hint visibly proves it.
 * The threshold comes from the org's SpaceCharter (2.4) — never a constant.
 */

export default async function DeclarePage({
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
  const charter = await prisma.spaceCharter.findUnique({
    where: { organizationId: org.id },
  });
  const thresholdDays = charter?.thresholdDays ?? 4;

  const [mine, colleagues] = await Promise.all([
    prisma.declaration.findUnique({
      where: {
        organizationId_userId_semester: {
          organizationId: org.id,
          userId: user.id,
          semester,
        },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: org.id, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true, active: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  // Clause 4.1: pairs require BOTH to name each other — show who named you.
  const namedMe = await prisma.declaration.findMany({
    where: {
      organizationId: org.id,
      semester,
      partnerPrefUserId: user.id,
    },
    select: { userId: true },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Declare your semester — {semester}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Your declaration shapes scheduling, pairing, and adjacency —{" "}
        <span className="font-semibold text-slate-700">never entitlement</span>.
        Offices are earned by your measured teaching schedule, not by this form,
        so the useful answer is the true one.
      </p>
      <DeclareForm
        organizationId={org.id}
        orgSlug={orgSlug}
        semester={semester}
        thresholdDays={thresholdDays}
        initialDays={mine?.days ? mine.days.split(",") : []}
        initialPartner={mine?.partnerPrefUserId ?? ""}
        initialWantsDedicated={mine?.wantsDedicated ?? false}
        initialNotes={mine?.notes ?? ""}
        colleagues={colleagues
          .filter((c) => c.user.active)
          .map((c) => ({ id: c.user.id, name: c.user.name || "(unnamed)" }))}
        namedMeIds={namedMe.map((d) => d.userId)}
      />
    </div>
  );
}
