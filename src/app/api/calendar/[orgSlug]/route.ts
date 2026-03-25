import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const secret = request.nextUrl.searchParams.get("secret");
  const roomSlug = request.nextUrl.searchParams.get("room");
  const scope = request.nextUrl.searchParams.get("scope");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    return new Response("Organization not found", { status: 404 });
  }

  // Resolve member from secret (used for auth and per-user feeds)
  let member: { userId: string } | null = null;
  if (secret) {
    member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: org.id,
        calendarSecret: secret,
      },
    });
  }

  // If calendar is private, require a valid secret
  if (org.calendarIsPrivate) {
    if (!secret || !member) {
      return new Response("Valid calendar secret required", { status: 403 });
    }
  }

  // Resolve room filter
  let roomId: string | undefined;
  if (roomSlug) {
    const room = await prisma.room.findFirst({
      where: { organizationId: org.id, slug: roomSlug, active: true },
      select: { id: true, name: true },
    });
    if (!room) {
      return new Response("Room not found", { status: 404 });
    }
    roomId = room.id;
  }

  // Resolve user filter (scope=my requires a valid secret)
  let userId: string | undefined;
  if (scope === "my") {
    if (!member) {
      return new Response("Secret required for personal calendar feed", { status: 403 });
    }
    userId = member.userId;
  }

  // Time window: last 6 months + next 12 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const twelveMonthsAhead = new Date();
  twelveMonthsAhead.setMonth(twelveMonthsAhead.getMonth() + 12);

  // Build query
  const where: Record<string, unknown> = {
    organizationId: org.id,
    deleted: false,
    status: "APPROVED",
    startDateTime: { gte: sixMonthsAgo },
    endDateTime: { lte: twelveMonthsAhead },
  };

  if (roomId) {
    where.roomId = roomId;
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    where.OR = [
      { submitterId: userId },
      ...(user?.email ? [{ contactEmail: user.email }] : []),
    ];
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      room: true,
      eventType: true,
    },
    orderBy: { startDateTime: "asc" },
  });

  // Build calendar name based on filters
  const orgName = org.appDisplayName || org.name;
  let calendarName = orgName;
  let filename = `${orgSlug}-calendar`;

  if (roomSlug) {
    const roomName = events[0]?.room?.name || roomSlug;
    calendarName = `${orgName} — ${roomName}`;
    filename = `${orgSlug}-${roomSlug}`;
  }

  if (userId) {
    calendarName = `${orgName} — My ${org.eventPluralTerm}`;
    filename = `${orgSlug}-my-events`;
  }

  // Generate iCal
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Scheduling Engine//${org.name}//EN`,
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    `X-WR-TIMEZONE:${org.timezone}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    if (!event.startDateTime || !event.endDateTime) continue;

    const uid = `${event.id}@scheduling-engine`;
    const location = event.room?.name || "";
    const description = [
      event.eventType?.name ? `Type: ${event.eventType.name}` : "",
      event.contactName ? `Contact: ${event.contactName}` : "",
      event.contactEmail ? `Email: ${event.contactEmail}` : "",
      event.notes || "",
    ]
      .filter(Boolean)
      .join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART:${formatICalDate(event.startDateTime)}`,
      `DTEND:${formatICalDate(event.endDateTime)}`,
      `DTSTAMP:${formatICalDate(event.updatedAt)}`,
      `CREATED:${formatICalDate(event.createdAt)}`,
      `LAST-MODIFIED:${formatICalDate(event.updatedAt)}`,
      `SUMMARY:${escapeICalText(event.title || "Untitled Event")}`,
    );

    if (location) lines.push(`LOCATION:${escapeICalText(location)}`);
    if (description) lines.push(`DESCRIPTION:${description}`);

    lines.push(
      `STATUS:CONFIRMED`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const icalContent = lines.join("\r\n");

  return new Response(icalContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
