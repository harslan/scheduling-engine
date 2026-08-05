import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const orgSlug = searchParams.get("org");
  const status = searchParams.get("status"); // optional filter

  if (!orgSlug) {
    return NextResponse.json({ error: "org parameter required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify user is an admin/manager of this org
  if (!token.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: org.id,
      user: { email: token.email },
      role: { in: ["ADMIN", "MANAGER"] },
    },
  });
  if (!member) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // CSV dates/times are rendered in the org's timezone
  const inTz = (d: Date) => new TZDate(d, org.timezone);

  const where: Record<string, unknown> = {
    organizationId: org.id,
    deleted: false,
  };
  if (status) {
    where.status = status;
  }

  // Non-recurring events
  const nonRecurringEvents = await prisma.event.findMany({
    where: { ...where, recurrenceRule: null },
    include: { room: true, eventType: true, submitter: { select: { name: true, email: true } } },
    orderBy: { startDateTime: "asc" },
  });

  // Recurring events with their instances
  const recurringEvents = await prisma.event.findMany({
    where: { ...where, recurrenceRule: { not: null } },
    include: {
      room: true,
      eventType: true,
      submitter: { select: { name: true, email: true } },
      instances: {
        where: { deleted: false },
        orderBy: { startDateTime: "asc" },
      },
    },
    orderBy: { startDateTime: "asc" },
  });

  // Build CSV
  const headers = [
    "EventId",
    "Title",
    "Type",
    "Room",
    "StartDate",
    "StartTime",
    "EndDate",
    "EndTime",
    "ContactName",
    "ContactEmail",
    "ContactPhone",
    "Organization",
    "ExpectedAttendees",
    "Status",
    "SubmittedBy",
    "Notes",
    "Recurrence",
    "Created",
  ];

  // Non-recurring events: one row each
  const rows = nonRecurringEvents.map((e) => [
    e.id,
    csvEscape(e.title),
    csvEscape(e.eventType?.name || ""),
    csvEscape(e.room?.name || ""),
    e.startDateTime ? format(inTz(e.startDateTime), "yyyy-MM-dd") : "",
    e.startDateTime ? format(inTz(e.startDateTime), "HH:mm") : "",
    e.endDateTime ? format(inTz(e.endDateTime), "yyyy-MM-dd") : "",
    e.endDateTime ? format(inTz(e.endDateTime), "HH:mm") : "",
    csvEscape(e.contactName),
    csvEscape(e.contactEmail),
    csvEscape(e.contactPhone),
    csvEscape(e.eventOrganization),
    e.expectedAttendeeCount?.toString() || "",
    e.status,
    csvEscape(e.submitter?.name || e.submitter?.email || ""),
    csvEscape(e.notes),
    "",
    format(inTz(e.createdAt), "yyyy-MM-dd HH:mm"),
  ]);

  // Recurring events: one row per instance (with parent metadata)
  for (const e of recurringEvents) {
    if (e.instances.length === 0) {
      // No instances yet — export the parent row
      rows.push([
        e.id,
        csvEscape(e.title),
        csvEscape(e.eventType?.name || ""),
        csvEscape(e.room?.name || ""),
        e.startDateTime ? format(inTz(e.startDateTime), "yyyy-MM-dd") : "",
        e.startDateTime ? format(inTz(e.startDateTime), "HH:mm") : "",
        e.endDateTime ? format(inTz(e.endDateTime), "yyyy-MM-dd") : "",
        e.endDateTime ? format(inTz(e.endDateTime), "HH:mm") : "",
        csvEscape(e.contactName),
        csvEscape(e.contactEmail),
        csvEscape(e.contactPhone),
        csvEscape(e.eventOrganization),
        e.expectedAttendeeCount?.toString() || "",
        e.status,
        csvEscape(e.submitter?.name || e.submitter?.email || ""),
        csvEscape(e.notes),
        csvEscape(e.recurrenceRule || ""),
        format(inTz(e.createdAt), "yyyy-MM-dd HH:mm"),
      ]);
    } else {
      for (const inst of e.instances) {
        rows.push([
          e.id,
          csvEscape(e.title),
          csvEscape(e.eventType?.name || ""),
          csvEscape(e.room?.name || ""),
          format(inTz(inst.startDateTime), "yyyy-MM-dd"),
          format(inTz(inst.startDateTime), "HH:mm"),
          format(inTz(inst.endDateTime), "yyyy-MM-dd"),
          format(inTz(inst.endDateTime), "HH:mm"),
          csvEscape(e.contactName),
          csvEscape(e.contactEmail),
          csvEscape(e.contactPhone),
          csvEscape(e.eventOrganization),
          e.expectedAttendeeCount?.toString() || "",
          e.status,
          csvEscape(e.submitter?.name || e.submitter?.email || ""),
          csvEscape(e.notes),
          csvEscape(e.recurrenceRule || ""),
          format(inTz(e.createdAt), "yyyy-MM-dd HH:mm"),
        ]);
      }
    }
  }

  // Sort all rows by start date
  rows.sort((a, b) => String(a[4]).localeCompare(String(b[4])) || String(a[5]).localeCompare(String(b[5])));

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${orgSlug}-events-${format(inTz(new Date()), "yyyy-MM-dd")}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
