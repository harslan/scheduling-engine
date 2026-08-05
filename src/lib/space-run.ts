import { prisma } from "./prisma";
import { wallTimeToUtc } from "./orgtime";
import { allocateWithPreferences, type Person } from "./allocation";

/**
 * The allocation run: measured teaching in, fair assignment out, offices on
 * the calendar. Charter discipline carried into the product:
 *  - entitlement comes ONLY from TeachingRecords (measured); Declarations
 *    contribute preferences (partner naming) — clause 2.2 as data flow
 *  - mutual named pairs first (4.1), stable matching for the rest (4.2)
 *  - private rooms (7.2) are excluded before the optimizer ever sees them
 *  - a run under an unratified charter is a SIMULATION (10.4)
 *  - shortfall is recorded with names, never absorbed (8.1)
 */

export async function executeSpaceRun(organizationId: string, semester: string) {
  const charter =
    (await prisma.spaceCharter.findUnique({ where: { organizationId } })) ??
    (await prisma.spaceCharter.create({ data: { organizationId } }));

  const records = await prisma.teachingRecord.findMany({
    where: { organizationId, semester },
  });
  const people: Person[] = records.map((r) => ({
    id: r.userId,
    days: r.days ? r.days.split(",") : [],
    nSections: r.nSections,
  }));

  const memberCount = await prisma.organizationMember.count({
    where: { organizationId, role: "USER" },
  });
  const notTeaching = Math.max(0, memberCount - people.length);

  const declarations = await prisma.declaration.findMany({
    where: { organizationId, semester, partnerPrefUserId: { not: null } },
  });
  const partnerPref = new Map(
    declarations.map((d) => [d.userId, d.partnerPrefUserId!]),
  );

  const privateSlugs = new Set(
    charter.privateRoomSlugs.split(",").map((s) => s.trim()).filter(Boolean),
  );
  const rooms = await prisma.room.findMany({
    where: { organizationId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const officeRooms = rooms.filter((r) => !privateSlugs.has(r.slug));

  const result = allocateWithPreferences(
    people,
    officeRooms.length,
    {
      thresholdDays: charter.thresholdDays,
      reservedOffices: charter.reservedOffices,
      slackFraction: charter.slackFraction,
      adjunctsInScope: charter.adjunctsInScope,
    },
    partnerPref,
  );

  // O001..O00N -> actual rooms in sort order; beyond stock stays a label
  const officeToRoom = new Map(
    officeRooms.map((r, i) => [`O${String(i + 1).padStart(3, "0")}`, r]),
  );

  const status = charter.ratifiedBy ? "OFFICIAL" : "SIMULATION";
  const run = await prisma.spaceRun.create({
    data: {
      organizationId,
      semester,
      status,
      needed: result.needed,
      usable: result.usable,
      stable: result.stable,
      notTeaching,
      dialsSnapshot: JSON.stringify({
        thresholdDays: charter.thresholdDays,
        reservedOffices: charter.reservedOffices,
        slackFraction: charter.slackFraction,
        adjunctsInScope: charter.adjunctsInScope,
        minSf: charter.minSf,
        privateRoomSlugs: charter.privateRoomSlugs,
      }),
      assignments: {
        create: [
          ...[...result.assign].map(([userId, a]) => ({
            userId,
            roomSlug: officeToRoom.get(a.office)?.slug ?? a.office,
            tier: a.tier,
            withUserIds: a.with.join(","),
            placed: a.placed,
          })),
          ...result.outOfScope.map((userId) => ({
            userId,
            roomSlug: "",
            tier: "bookable",
            withUserIds: "",
            placed: true, // guaranteed landing (5.1) — via private rooms
          })),
        ],
      },
    },
    include: { assignments: true },
  });

  // A new run supersedes the assignments pending swaps were proposed against.
  // Expire them: consenting over stale assignments would rewrite the calendar
  // from the superseded run (5.3 consent must bind to what currently is).
  await prisma.spaceSwap.updateMany({
    where: { organizationId, semester, status: "pending", runId: { not: run.id } },
    data: { status: "expired" },
  });

  await materializeHolds(organizationId, run.id, semester);
  return run;
}

/** Write placed assignments onto the calendar as 4 weeks of office holds. */
export async function materializeHolds(
  organizationId: string,
  runId: string,
  semester: string,
) {
  const run = await prisma.spaceRun.findUniqueOrThrow({
    where: { id: runId },
    include: { assignments: true },
  });
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  let holdType = await prisma.eventType.findFirst({
    where: { organizationId, name: "Office hold — semester" },
  });
  holdType ??= await prisma.eventType.create({
    data: { organizationId, name: "Office hold — semester", colorIndex: 0 },
  });

  const rooms = await prisma.room.findMany({ where: { organizationId } });
  const roomBySlug = new Map(rooms.map((r) => [r.slug, r]));
  const users = await prisma.user.findMany({
    where: { id: { in: run.assignments.map((a) => a.userId) } },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const recs = await prisma.teachingRecord.findMany({
    where: { organizationId, semester },
  });
  const daysByUser = new Map(recs.map((r) => [r.userId, r.days.split(",").filter(Boolean)]));

  const DAY: Record<string, number> = { M: 0, T: 1, W: 2, TH: 3, F: 4 };
  // "this week" is the org's week, not the server's (UTC evenings differ)
  const todayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: org.timezone || "America/New_York",
  });
  const monday = new Date(`${todayStr}T00:00:00Z`); // date-only arithmetic
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const TIER_LABEL: Record<string, string> = {
    ded: "dedicated office",
    pair: "shared office (pair)",
    pool: "pool seat",
  };

  // build the whole calendar first, then swap it in atomically: a crash can
  // never leave a half-written calendar, and of two concurrent rewrites the
  // later transaction wins wholly rather than interleaving.
  const events: NonNullable<
    Parameters<typeof prisma.event.createMany>[0]
  >["data"] & unknown[] = [];
  for (const a of run.assignments) {
    if (!a.placed || a.tier === "bookable") continue;
    const room = roomBySlug.get(a.roomSlug);
    const user = userById.get(a.userId);
    const days = daysByUser.get(a.userId) ?? [];
    if (!room || !user || days.length === 0) continue;
    for (let week = 0; week < 4; week++) {
      for (const d of days) {
        if (!(d in DAY)) continue;
        // Holds are 9:00-17:00 WALL TIME in the org's timezone, stored as
        // true instants like every other event.
        const day = new Date(monday);
        day.setUTCDate(day.getUTCDate() + week * 7 + DAY[d]);
        const y = day.getUTCFullYear();
        const m = String(day.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(day.getUTCDate()).padStart(2, "0");
        const start = wallTimeToUtc(`${y}-${m}-${dd}T09:00`, org.timezone);
        if (start < new Date()) continue;
        const end = wallTimeToUtc(`${y}-${m}-${dd}T17:00`, org.timezone);
        events.push({
          organizationId,
          roomId: room.id,
          eventTypeId: holdType.id,
          submitterId: a.userId,
          title: `${user.name} — ${TIER_LABEL[a.tier] ?? a.tier}`,
          contactName: user.name,
          contactEmail: user.email,
          startDateTime: start,
          endDateTime: end,
          status: "APPROVED",
          approved: true,
        });
      }
    }
  }
  await prisma.$transaction([
    prisma.event.deleteMany({
      where: {
        organizationId,
        eventTypeId: holdType.id,
        startDateTime: { gte: new Date() },
      },
    }),
    prisma.event.createMany({ data: events }),
  ]);
}
