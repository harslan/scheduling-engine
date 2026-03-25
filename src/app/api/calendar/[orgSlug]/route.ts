import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    return new Response("Organization not found", { status: 404 });
  }

  // If calendar is private, require a valid secret
  if (org.calendarIsPrivate && secret) {
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: org.id,
        calendarSecret: secret,
      },
    });
    if (!member) {
      return new Response("Invalid calendar secret", { status: 403 });
    }
  } else if (org.calendarIsPrivate && !secret) {
    return new Response("Calendar secret required", { status: 403 });
  }

  // Fetch approved events (last 6 months + next 12 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const twelveMonthsAhead = new Date();
  twelveMonthsAhead.setMonth(twelveMonthsAhead.getMonth() + 12);

  const events = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      startDateTime: { gte: sixMonthsAgo },
      endDateTime: { lte: twelveMonthsAhead },
    },
    include: {
      room: true,
      eventType: true,
    },
    orderBy: { startDateTime: "asc" },
  });

  // Generate iCal
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Scheduling Engine//${org.name}//EN`,
    `X-WR-CALNAME:${escapeICalText(org.appDisplayName || org.name)}`,
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
      "Content-Disposition": `attachment; filename="${orgSlug}-calendar.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
