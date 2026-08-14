import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { currentSemester } from "@/lib/semester";
import { orgNow, buildFacultyCards } from "@/lib/office-hours";

/**
 * Public, unauthenticated — the student-facing door (like /api/rooms/status).
 * It returns ONLY what faculty chose to publish; nothing here is guessed. The
 * `live` dial is honored inside buildFacultyCards, server-side, so a withheld
 * location never reaches the client.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "org parameter required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, appDisplayName: true, timezone: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const semester = currentSemester();
  const { dayToken, minute } = orgNow(org.timezone);

  const published = await prisma.officeHours.findMany({
    where: { organizationId: org.id, semester, publish: true },
    select: { userId: true, live: true, note: true, blocks: true },
  });

  // Names live on User (OfficeHours holds a scalar userId, like Declaration) —
  // one lookup, mapped in.
  const names = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: published.map((p) => p.userId) } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name]),
  );

  const faculty = buildFacultyCards(
    published,
    (userId) => names.get(userId) || "(unnamed)",
    dayToken,
    minute,
  );

  return NextResponse.json({
    org: { name: org.appDisplayName || org.name, timezone: org.timezone },
    semester,
    nScope: await prisma.organizationMember.count({ where: { organizationId: org.id } }),
    nPublished: faculty.length,
    serverTime: new Date().toISOString(),
    faculty,
  });
}
