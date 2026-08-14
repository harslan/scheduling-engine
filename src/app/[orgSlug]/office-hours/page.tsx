import { prisma } from "@/lib/prisma";
import { getOrgMembership } from "@/lib/session";
import { redirect } from "next/navigation";
import { currentSemester } from "@/lib/semester";
import { OfficeHoursForm } from "./form";

/**
 * Publish office hours — the SERVICE facet of the declaration (charter 2.2).
 * It's the one thing the registrar feed can never see, so it only exists if the
 * faculty member says it. Two consent dials stay theirs; nothing here can change
 * what they're owed, and nothing reaches a student until they publish.
 */

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default async function OfficeHoursPage({
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

  const [mine, assignment] = await Promise.all([
    prisma.officeHours.findUnique({
      where: {
        organizationId_userId_semester: {
          organizationId: org.id,
          userId: user.id,
          semester,
        },
      },
      include: { blocks: true },
    }),
    // default room = this faculty's most recent assigned office, if a run exists
    prisma.spaceAssignment.findFirst({
      where: { userId: user.id, run: { organizationId: org.id, semester } },
      orderBy: { run: { createdAt: "desc" } },
      select: { roomSlug: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Your office hours — {semester}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Tell students when you&rsquo;re there and where. This is the one thing the model
        can never read from the registrar —{" "}
        <span className="font-semibold text-slate-700">so it only exists if you say it</span>.
        Nothing here is guessed, and nothing shows to a student until you publish it.
      </p>
      <OfficeHoursForm
        organizationId={org.id}
        orgSlug={orgSlug}
        semester={semester}
        defaultRoom={assignment?.roomSlug ?? ""}
        initialPublish={mine?.publish ?? true}
        initialLive={mine?.live ?? false}
        initialNote={mine?.note ?? ""}
        initialBlocks={(mine?.blocks ?? [])
          .slice()
          .sort((a, b) => a.startMin - b.startMin)
          .map((b) => ({
            day: b.day,
            start: toHHMM(b.startMin),
            end: toHHMM(b.endMin),
            room: b.roomSlug,
            mode: b.mode,
          }))}
      />
    </div>
  );
}
