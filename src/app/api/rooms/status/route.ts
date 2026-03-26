import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get("org");
  const roomSlug = request.nextUrl.searchParams.get("room");

  if (!orgSlug) {
    return NextResponse.json({ error: "org parameter required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, appDisplayName: true, roomTerm: true, eventSingularTerm: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const roomWhere: Record<string, unknown> = {
    organizationId: org.id,
    active: true,
  };
  if (roomSlug) {
    roomWhere.slug = roomSlug;
  }

  const rooms = await prisma.room.findMany({
    where: roomWhere,
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      iconText: true,
      capacity: true,
    },
  });

  // Get today's approved events for these rooms
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const events = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      deleted: false,
      status: "APPROVED",
      roomId: { in: rooms.map((r) => r.id) },
      startDateTime: { lte: endOfDay },
      endDateTime: { gte: startOfDay },
    },
    select: {
      id: true,
      title: true,
      roomId: true,
      startDateTime: true,
      endDateTime: true,
      contactName: true,
      eventOrganization: true,
    },
    orderBy: { startDateTime: "asc" },
  });

  // Group events by room
  const eventsByRoom = new Map<string, typeof events>();
  for (const event of events) {
    if (!event.roomId) continue;
    const existing = eventsByRoom.get(event.roomId) ?? [];
    existing.push(event);
    eventsByRoom.set(event.roomId, existing);
  }

  const roomStatuses = rooms.map((room) => {
    const roomEvents = eventsByRoom.get(room.id) ?? [];

    // Find current event (happening right now)
    const currentEvent = roomEvents.find(
      (e) => e.startDateTime && e.endDateTime && e.startDateTime <= now && e.endDateTime > now
    );

    // Find next event (starts after now)
    const nextEvent = roomEvents.find((e) => e.startDateTime && e.startDateTime > now);

    // Calculate availability
    let status: "available" | "occupied" | "available_soon";
    let availableUntil: Date | null = null;
    let availableIn: number | null = null;

    if (currentEvent) {
      const minsLeft = Math.ceil(
        (currentEvent.endDateTime!.getTime() - now.getTime()) / 60000
      );
      if (minsLeft <= 15) {
        status = "available_soon";
        availableIn = minsLeft;
      } else {
        status = "occupied";
        availableIn = minsLeft;
      }
    } else {
      status = "available";
      if (nextEvent) {
        availableUntil = nextEvent.startDateTime;
      }
    }

    return {
      id: room.id,
      name: room.name,
      slug: room.slug,
      iconText: room.iconText,
      capacity: room.capacity,
      status,
      availableUntil: availableUntil?.toISOString() ?? null,
      availableIn,
      currentEvent: currentEvent
        ? {
            title: currentEvent.title,
            endsAt: currentEvent.endDateTime!.toISOString(),
            organizer: currentEvent.contactName || currentEvent.eventOrganization || null,
          }
        : null,
      nextEvent: nextEvent
        ? {
            title: nextEvent.title,
            startsAt: nextEvent.startDateTime!.toISOString(),
            endsAt: nextEvent.endDateTime!.toISOString(),
            organizer: nextEvent.contactName || nextEvent.eventOrganization || null,
          }
        : null,
      todayEventCount: roomEvents.length,
      todayEvents: roomEvents.map((e) => ({
        title: e.title,
        startsAt: e.startDateTime!.toISOString(),
        endsAt: e.endDateTime!.toISOString(),
      })),
    };
  });

  return NextResponse.json({
    org: {
      name: org.appDisplayName || org.name,
      roomTerm: org.roomTerm,
      eventSingularTerm: org.eventSingularTerm,
    },
    serverTime: now.toISOString(),
    rooms: roomStatuses,
  });
}
