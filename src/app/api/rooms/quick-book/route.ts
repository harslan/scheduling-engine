import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectConflicts } from "@/lib/conflict-detection";

export const dynamic = "force-dynamic";

const QuickBookSchema = z.object({
  orgSlug: z.string(),
  roomSlug: z.string(),
  title: z.string().min(1, "Title is required"),
  contactName: z.string().min(1, "Name is required"),
  contactEmail: z.string().email("Valid email is required"),
  durationMinutes: z.number().int().min(15).max(480),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = QuickBookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { orgSlug, roomSlug, title, contactName, contactEmail, durationMinutes } =
    parsed.data;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const room = await prisma.room.findFirst({
    where: { slug: roomSlug, organizationId: org.id, active: true },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // EWL: managersOnly rooms cannot be booked by non-admin users (kiosk is unauthenticated)
  if (room.managersOnly) {
    return NextResponse.json(
      { error: `${room.name} is only available to managers.` },
      { status: 403 }
    );
  }

  // Check duration against org limits (skip if no limit configured)
  if (org.maxEventLengthMinutes && durationMinutes > org.maxEventLengthMinutes) {
    return NextResponse.json(
      { error: `Maximum booking length is ${org.maxEventLengthMinutes} minutes` },
      { status: 400 }
    );
  }

  // Scheduling cutoff (fixed date) — quick-book starts now, so check end time
  if (org.schedulingCutoffFixedDate) {
    const now = new Date();
    const endCheck = new Date(now.getTime() + durationMinutes * 60_000);
    if (endCheck > org.schedulingCutoffFixedDate) {
      const cutoffStr = org.schedulingCutoffFixedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      return NextResponse.json(
        { error: `Events cannot be scheduled after ${cutoffStr}.` },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  const startDateTime = new Date(now);
  // Round up to next 5-minute mark
  const mins = startDateTime.getMinutes();
  startDateTime.setMinutes(Math.ceil(mins / 5) * 5, 0, 0);

  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60_000);

  // EWL: enforce room opening/closing times (kiosk users are non-admin)
  if (org.roomOpeningTime && org.roomClosingTime) {
    const tz = org.timezone || undefined;
    const startH = parseInt(startDateTime.toLocaleString("en-US", { hour: "numeric", hour12: false, ...(tz ? { timeZone: tz } : {}) }));
    const startM = parseInt(startDateTime.toLocaleString("en-US", { minute: "numeric", ...(tz ? { timeZone: tz } : {}) }));
    const endH = parseInt(endDateTime.toLocaleString("en-US", { hour: "numeric", hour12: false, ...(tz ? { timeZone: tz } : {}) }));
    const endM = parseInt(endDateTime.toLocaleString("en-US", { minute: "numeric", ...(tz ? { timeZone: tz } : {}) }));
    const [openH, openM] = org.roomOpeningTime.split(":").map(Number);
    const [closeH, closeM] = org.roomClosingTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      return NextResponse.json(
        { error: `Bookings must be between ${org.roomOpeningTime} and ${org.roomClosingTime}.` },
        { status: 400 }
      );
    }
  }

  // Check room availability using the full conflict detection engine
  // (includes parent/child rooms, recurring instances, and buffer time)
  const conflictResult = await detectConflicts({
    orgId: org.id,
    roomId: room.id,
    startDateTime,
    endDateTime,
    timezone: org.timezone,
  });

  if (conflictResult.hasConflict) {
    return NextResponse.json(
      { error: "This room is no longer available for that time slot" },
      { status: 409 }
    );
  }

  // Create the event
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      roomId: room.id,
      title,
      contactName,
      contactEmail,
      startDateTime,
      endDateTime,
      status: org.requiresApproval ? "PENDING" : "APPROVED",
      approved: !org.requiresApproval,
    },
  });

  // Log activity
  await prisma.eventActivity.create({
    data: {
      eventId: event.id,
      action: "EVENT_SUBMITTED",
      actorEmail: contactEmail,
      details: { source: "quick-book", title },
    },
  });

  return NextResponse.json({
    success: true,
    event: {
      id: event.id,
      title: event.title,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      status: event.status,
      requiresApproval: org.requiresApproval,
    },
  });
}
