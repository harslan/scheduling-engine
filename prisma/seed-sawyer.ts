/**
 * Sawyer Business School demo org — FICTITIOUS data only.
 *
 * Seeds a fresh demo database (never production) with an org shaped like the
 * SBS office-sharing pilot: Sargent-5-style offices, three bookable private
 * rooms, invented faculty, and semester "office hold" events showing the three
 * tiers (dedicated / MW-TTh pair / pool) on the calendar.
 *
 *   DATABASE_URL=postgresql://...sbs_demo... npx tsx prisma/seed-sawyer.ts
 *
 * All people are invented (names from the design prototype). Rooms use real
 * Sargent 5 numbering so the demo *feels* like the building, but assignments
 * are fiction — this is a product demo, not an allocation.
 */
import { PrismaClient, OrgRole, EventStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Sawyer demo org (fictitious data)...");
  const pw = await bcrypt.hash("sawyer2026", 10);
  const adminPw = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@scheduling.dev" },
    update: {},
    create: { email: "admin@scheduling.dev", name: "System Admin", passwordHash: adminPw, isSystemAdmin: true },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "sawyer" },
    update: {},
    create: {
      name: "Sawyer Business School",
      shortName: "SBS",
      slug: "sawyer",
      appDisplayName: "SBS Faculty Space",
      timezone: "America/New_York",
      primaryColor: "#0B2E5C",
      roomTerm: "Office",
      eventSingularTerm: "Booking",
      eventPluralTerm: "Bookings",
      requiresApproval: false,
      allowsRoomSelection: true,
      allowsRoomRequests: true,
      roomOpeningTime: "07:00",
      roomClosingTime: "22:00",
      maxEventLengthMinutes: 600,
      messageBoardHtml:
        "<p><strong>Demo.</strong> Everyone here is invented; office numbers are Sargent 5. " +
        "Fridays the floor is open — no holds are scheduled.</p>",
    },
  });

  // --- people (all fictitious — prototype names) ---------------------------
  const mk = async (email: string, name: string, role: OrgRole = OrgRole.USER) => {
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: pw },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: u.id } },
      update: {},
      create: { organizationId: org.id, userId: u.id, role },
    });
    return u;
  };

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    update: {},
    create: { organizationId: org.id, userId: admin.id, role: OrgRole.ADMIN },
  });

  const dean = await mk("dean@sawyer.demo", "Dean's Office", OrgRole.ADMIN);
  const osei = await mk("kosei@sawyer.demo", "K. Osei");          // dedicated (Mon–Thu)
  const vance = await mk("mverhoeven@sawyer.demo", "M. Verhoeven");        // pair, Mon/Wed
  const aldana = await mk("raldana@sawyer.demo", "R. Aldana");     // pair, Tue/Thu
  const novak = await mk("qnovak@sawyer.demo", "Q. Novak");        // pool
  const ilori = await mk("tilori@sawyer.demo", "T. Ilori");        // pool

  // --- offices + private rooms --------------------------------------------
  const officeNums = [5201, 5202, 5203, 5204, 5205, 5206, 5207, 5208, 5209, 5210];
  const rooms: Record<number, { id: string }> = {};
  for (let i = 0; i < officeNums.length; i++) {
    const n = officeNums[i];
    rooms[n] = await prisma.room.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: String(n) } },
      update: {},
      create: {
        organizationId: org.id,
        name: `Office ${n}`,
        slug: String(n),
        iconText: String(n).slice(-2),
        sortOrder: i,
        capacity: 2,
        notes: "Enclosed, lockable. Standard office under charter 6.1.",
      },
    });
  }
  const privNums = [5211, 5212, 5213];
  for (let i = 0; i < privNums.length; i++) {
    const n = privNums[i];
    rooms[n] = await prisma.room.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: String(n) } },
      update: {},
      create: {
        organizationId: org.id,
        name: `Private Room ${["A", "B", "C"][i]} (${n})`,
        slug: String(n),
        iconText: "P" + ["A", "B", "C"][i],
        sortOrder: 20 + i,
        capacity: 3,
        notes: "Protected bookable private room — grades, ADA/504, confidential conversations. Never convertible to an office.",
      },
    });
  }

  // --- event types ---------------------------------------------------------
  const types: Record<string, { id: string }> = {};
  for (const [i, name] of ["Office hold — semester", "Private room booking", "Meeting"].entries()) {
    types[name] = await prisma.eventType.create({
      data: { organizationId: org.id, name, colorIndex: i },
    });
  }

  // --- semester holds: materialize 4 weeks around today --------------------
  await prisma.event.deleteMany({ where: { organizationId: org.id } });
  const DAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4 } as const;
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // this week's Monday
  monday.setHours(0, 0, 0, 0);

  type Hold = { user: { id: string; name: string; email: string }; room: number;
                days: (keyof typeof DAY)[]; start: number; end: number; title: string };
  const holds: Hold[] = [
    { user: osei, room: 5201, days: ["Mon", "Tue", "Wed", "Thu"], start: 9, end: 17,
      title: "K. Osei — dedicated office (4-day schedule)" },
    { user: vance, room: 5205, days: ["Mon", "Wed"], start: 8, end: 15,
      title: "M. Verhoeven — Mon/Wed (paired with R. Aldana)" },
    { user: aldana, room: 5205, days: ["Tue", "Thu"], start: 8, end: 15,
      title: "R. Aldana — Tue/Thu (paired with M. Verhoeven)" },
    { user: novak, room: 5208, days: ["Mon", "Wed"], start: 9, end: 14,
      title: "Q. Novak — pool seat, Mon/Wed" },
    { user: ilori, room: 5208, days: ["Tue"], start: 10, end: 16,
      title: "T. Ilori — pool seat, Tue" },
  ];

  let count = 0;
  for (let week = 0; week < 4; week++) {
    for (const h of holds) {
      for (const d of h.days) {
        const start = new Date(monday);
        start.setDate(start.getDate() + week * 7 + (DAY[d] - 1));
        start.setHours(h.start, 0, 0, 0);
        const end = new Date(start);
        end.setHours(h.end, 0, 0, 0);
        await prisma.event.create({
          data: {
            organizationId: org.id,
            roomId: rooms[h.room].id,
            eventTypeId: types["Office hold — semester"].id,
            submitterId: h.user.id,
            title: h.title,
            contactName: h.user.name,
            contactEmail: h.user.email,
            startDateTime: start,
            endDateTime: end,
            status: EventStatus.APPROVED,
            approved: true,
          },
        });
        count++;
      }
    }
  }

  // one private-room booking, to show the confidential-space flow
  const thu = new Date(monday);
  thu.setDate(thu.getDate() + (DAY.Thu - 1));
  thu.setHours(14, 0, 0, 0);
  const thuEnd = new Date(thu);
  thuEnd.setHours(15, 0, 0, 0);
  await prisma.event.create({
    data: {
      organizationId: org.id,
      roomId: rooms[5211].id,
      eventTypeId: types["Private room booking"].id,
      submitterId: vance.id,
      title: "Advising (private)",
      contactName: "M. Verhoeven",
      contactEmail: "mverhoeven@sawyer.demo",
      startDateTime: thu,
      endDateTime: thuEnd,
      status: EventStatus.APPROVED,
      approved: true,
    },
  });
  count++;

  // calendar views + email templates
  for (const view of ["YEAR", "MONTH", "WEEK", "DAY"] as const) {
    await prisma.organizationCalendarView.upsert({
      where: { organizationId_viewType: { organizationId: org.id, viewType: view } },
      update: {},
      create: { organizationId: org.id, viewType: view, enabled: true },
    });
  }
  for (const t of [
    { slug: "event-submitted", name: "Event Submitted" },
    { slug: "event-approved", name: "Event Approved" },
    { slug: "event-denied", name: "Event Denied" },
    { slug: "approval-required", name: "Approval Required" },
    { slug: "event-reminder", name: "Event Reminder" },
    { slug: "space-request-submitted", name: "Space Request Submitted" },
    { slug: "space-request-approved", name: "Space Request Approved" },
    { slug: "space-request-denied", name: "Space Request Denied" },
  ]) {
    await prisma.emailTemplate.upsert({ where: { slug: t.slug }, update: {}, create: t });
  }

  console.log(`Sawyer demo seeded: 13 rooms, 7 users, ${count} events.`);
  console.log("  Org:     /sawyer");
  console.log("  Dean:    dean@sawyer.demo / sawyer2026   (admin view)");
  console.log("  Faculty: mverhoeven@sawyer.demo / sawyer2026 (the Mon/Wed half of a pair)");
  console.log("  Admin:   admin@scheduling.dev / admin123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
