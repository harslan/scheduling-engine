import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
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

  const where: Record<string, unknown> = {
    organizationId: org.id,
    deleted: false,
  };
  if (status) {
    where.status = status;
  }

  const events = await prisma.event.findMany({
    where,
    include: { room: true, eventType: true, submitter: { select: { name: true, email: true } } },
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

  const rows = events.map((e) => [
    e.id,
    csvEscape(e.title),
    csvEscape(e.eventType?.name || ""),
    csvEscape(e.room?.name || ""),
    e.startDateTime ? format(e.startDateTime, "yyyy-MM-dd") : "",
    e.startDateTime ? format(e.startDateTime, "HH:mm") : "",
    e.endDateTime ? format(e.endDateTime, "yyyy-MM-dd") : "",
    e.endDateTime ? format(e.endDateTime, "HH:mm") : "",
    csvEscape(e.contactName),
    csvEscape(e.contactEmail),
    csvEscape(e.contactPhone),
    csvEscape(e.eventOrganization),
    e.expectedAttendeeCount?.toString() || "",
    e.status,
    csvEscape(e.submitter?.name || e.submitter?.email || ""),
    csvEscape(e.notes),
    csvEscape(e.recurrenceRule || ""),
    format(e.createdAt, "yyyy-MM-dd HH:mm"),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${orgSlug}-events-${format(new Date(), "yyyy-MM-dd")}.csv"`,
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
