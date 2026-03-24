import { PrismaClient, OrgRole, EventStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@scheduling.dev" },
    update: {},
    create: {
      email: "admin@scheduling.dev",
      name: "System Admin",
      passwordHash: adminPassword,
      isSystemAdmin: true,
    },
  });

  // Create demo user
  const userPassword = await bcrypt.hash("demo123", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@incae.edu" },
    update: {},
    create: {
      email: "demo@incae.edu",
      name: "Maria Garcia",
      passwordHash: userPassword,
    },
  });

  const approver = await prisma.user.upsert({
    where: { email: "mauricio.quijano@backoffice.incae.edu" },
    update: {},
    create: {
      email: "mauricio.quijano@backoffice.incae.edu",
      name: "Mauricio Quijano",
      passwordHash: userPassword,
    },
  });

  // Create INCAE organization
  const incae = await prisma.organization.upsert({
    where: { slug: "incae" },
    update: {},
    create: {
      name: "INCAE Business School",
      shortName: "INCAE",
      slug: "incae",
      appDisplayName: "INCAE Classroom Booking",
      timezone: "America/Costa_Rica",
      primaryColor: "#0B7DE6",
      allowsRoomSelection: true,
      allowsMultiDayEvents: true,
      requiresApproval: true,
      collectsEventTitle: true,
      collectsAttendeeCount: true,
      collectsContactPhone: true,
      roomOpeningTime: "07:00",
      roomClosingTime: "22:00",
      maxEventLengthMinutes: 480,
      eventSingularTerm: "Event",
      eventPluralTerm: "Events",
      roomTerm: "Room",
      emailReplyToAddress: "scheduling@incae.edu",
    },
  });

  // Create a demo org too
  const demo = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Organization",
      shortName: "Demo",
      slug: "demo",
      appDisplayName: "Demo Scheduling",
      timezone: "America/New_York",
      requiresApproval: false,
    },
  });

  // Add members
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: incae.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      organizationId: incae.id,
      userId: admin.id,
      role: OrgRole.ADMIN,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: incae.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      organizationId: incae.id,
      userId: demoUser.id,
      role: OrgRole.USER,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: incae.id,
        userId: approver.id,
      },
    },
    update: {},
    create: {
      organizationId: incae.id,
      userId: approver.id,
      role: OrgRole.MANAGER,
    },
  });

  // Create event types
  const eventTypes = [
    { name: "Class", colorIndex: 0 },
    { name: "Meeting", colorIndex: 1 },
    { name: "Workshop", colorIndex: 2 },
    { name: "Conference", colorIndex: 3 },
    { name: "Exam", colorIndex: 4 },
    { name: "Social Event", colorIndex: 5 },
  ];

  const createdEventTypes = [];
  for (const et of eventTypes) {
    const created = await prisma.eventType.create({
      data: {
        organizationId: incae.id,
        name: et.name,
        colorIndex: et.colorIndex,
      },
    });
    createdEventTypes.push(created);
  }

  // Create rooms (matching INCAE's actual rooms)
  const rooms = [
    { name: "Aula Manuel Jiménez", slug: "aula-manuel-jimenez", iconText: "MJ" },
    { name: "Aula Lorenzo Giordano", slug: "aula-lorenzo-giordano", iconText: "LG" },
    { name: "Aula Juan Maegli", slug: "aula-juan-maegli", iconText: "JM" },
    { name: "Aula Huber Garnier", slug: "aula-huber-garnier", iconText: "HG" },
    { name: "Aula Ernesto Castegnaro", slug: "aula-ernesto-castegnaro", iconText: "EC" },
    { name: "Aula Jaime & Leana Montealegre", slug: "aula-montealegre", iconText: "ML" },
    { name: "Aula Automercado", slug: "aula-automercado", iconText: "AM" },
    { name: "Aula Virtual", slug: "aula-virtual", iconText: "AV" },
    { name: "Aula E", slug: "aula-e", iconText: "AE" },
    { name: "Sala Azul", slug: "sala-azul", iconText: "SA" },
    { name: "Sala CD", slug: "sala-cd", iconText: "CD" },
    { name: "Foro - Estrado", slug: "foro-estrado", iconText: "FE" },
    { name: "Foro - Adelante", slug: "foro-adelante", iconText: "FA" },
    { name: "Foro - Medio", slug: "foro-medio", iconText: "FM" },
    { name: "Foro - Atrás", slug: "foro-atras", iconText: "FT" },
  ];

  const createdRooms = [];
  for (let i = 0; i < rooms.length; i++) {
    const room = await prisma.room.upsert({
      where: {
        organizationId_slug: {
          organizationId: incae.id,
          slug: rooms[i].slug,
        },
      },
      update: {},
      create: {
        organizationId: incae.id,
        name: rooms[i].name,
        slug: rooms[i].slug,
        iconText: rooms[i].iconText,
        sortOrder: i,
        notes:
          i < 7
            ? `This room fits ${60 + Math.floor(Math.random() * 50)} people.`
            : "",
      },
    });
    createdRooms.push(room);
  }

  // Create sample events for the current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const sampleEvents = [
    {
      title: "MBA Core Strategy",
      roomIdx: 0,
      typeIdx: 0,
      day: 3,
      startHour: 8,
      endHour: 10,
    },
    {
      title: "Leadership Workshop",
      roomIdx: 1,
      typeIdx: 2,
      day: 3,
      startHour: 14,
      endHour: 17,
    },
    {
      title: "Faculty Senate Meeting",
      roomIdx: 5,
      typeIdx: 1,
      day: 5,
      startHour: 10,
      endHour: 12,
    },
    {
      title: "Entrepreneurship Seminar",
      roomIdx: 2,
      typeIdx: 3,
      day: 7,
      startHour: 9,
      endHour: 12,
    },
    {
      title: "Finance Exam",
      roomIdx: 3,
      typeIdx: 4,
      day: 10,
      startHour: 8,
      endHour: 11,
    },
    {
      title: "Alumni Networking",
      roomIdx: 7,
      typeIdx: 5,
      day: 12,
      startHour: 18,
      endHour: 21,
    },
    {
      title: "Operations Management",
      roomIdx: 0,
      typeIdx: 0,
      day: 14,
      startHour: 8,
      endHour: 10,
    },
    {
      title: "Board Meeting",
      roomIdx: 5,
      typeIdx: 1,
      day: 15,
      startHour: 9,
      endHour: 13,
    },
    {
      title: "Data Analytics Workshop",
      roomIdx: 4,
      typeIdx: 2,
      day: 17,
      startHour: 14,
      endHour: 17,
    },
    {
      title: "Marketing Strategy",
      roomIdx: 1,
      typeIdx: 0,
      day: 19,
      startHour: 10,
      endHour: 12,
    },
    {
      title: "Midterm Review",
      roomIdx: 2,
      typeIdx: 4,
      day: 21,
      startHour: 8,
      endHour: 12,
    },
    {
      title: "Innovation Lab",
      roomIdx: 6,
      typeIdx: 2,
      day: 22,
      startHour: 13,
      endHour: 16,
    },
    {
      title: "Guest Speaker: AI in Business",
      roomIdx: 0,
      typeIdx: 3,
      day: 24,
      startHour: 16,
      endHour: 18,
    },
    {
      title: "Team Project Presentations",
      roomIdx: 3,
      typeIdx: 0,
      day: 26,
      startHour: 9,
      endHour: 12,
    },
    {
      title: "End of Month Social",
      roomIdx: 11,
      typeIdx: 5,
      day: 28,
      startHour: 17,
      endHour: 20,
    },
  ];

  for (const evt of sampleEvents) {
    const startDate = new Date(year, month, evt.day, evt.startHour, 0, 0);
    const endDate = new Date(year, month, evt.day, evt.endHour, 0, 0);

    // Skip if the day doesn't exist in this month
    if (startDate.getMonth() !== month) continue;

    await prisma.event.create({
      data: {
        organizationId: incae.id,
        roomId: createdRooms[evt.roomIdx].id,
        eventTypeId: createdEventTypes[evt.typeIdx].id,
        submitterId: demoUser.id,
        title: evt.title,
        contactName: "Maria Garcia",
        contactEmail: "demo@incae.edu",
        startDateTime: startDate,
        endDateTime: endDate,
        status: EventStatus.APPROVED,
        approved: true,
        expectedAttendeeCount: 20 + Math.floor(Math.random() * 60),
      },
    });
  }

  // Calendar views
  const views = ["YEAR", "MONTH", "WEEK", "DAY"] as const;
  for (const view of views) {
    await prisma.organizationCalendarView.upsert({
      where: {
        organizationId_viewType: {
          organizationId: incae.id,
          viewType: view,
        },
      },
      update: {},
      create: {
        organizationId: incae.id,
        viewType: view,
        enabled: true,
      },
    });
  }

  console.log("Seed complete!");
  console.log(`  Admin: admin@scheduling.dev / admin123`);
  console.log(`  User:  demo@incae.edu / demo123`);
  console.log(`  Org:   /incae`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
