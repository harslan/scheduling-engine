import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

  // Check duration against org limits
  if (durationMinutes > org.maxEventLengthMinutes) {
    return NextResponse.json(
      { error: `Maximum booking length is ${org.maxEventLengthMinutes} minutes` },
      { status: 400 }
    );
  }

  const now = new Date();
  const startDateTime = new Date(now);
  // Round up to next 5-minute mark
  const mins = startDateTime.getMinutes();
  startDateTime.setMinutes(Math.ceil(mins / 5) * 5, 0, 0);

  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60_000);

  // Check room availability — no overlapping approved/pending events
  const conflict = await prisma.event.findFirst({
    where: {
      roomId: room.id,
      organizationId: org.id,
      deleted: false,
      status: { in: ["APPROVED", "PENDING"] },
      startDateTime: { lt: endDateTime },
      endDateTime: { gt: startDateTime },
    },
  });

  if (conflict) {
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
