import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "search_available_rooms",
    description: "Search for available rooms during a specific time period. Returns rooms that have no conflicting events.",
    input_schema: {
      type: "object" as const,
      properties: {
        organization_id: { type: "string", description: "The organization ID" },
        start_datetime: { type: "string", description: "Start datetime in ISO format (e.g., 2026-03-25T14:00:00)" },
        end_datetime: { type: "string", description: "End datetime in ISO format (e.g., 2026-03-25T16:00:00)" },
        min_capacity: { type: "number", description: "Minimum concurrent event capacity (optional)" },
      },
      required: ["organization_id", "start_datetime", "end_datetime"],
    },
  },
  {
    name: "list_rooms",
    description: "List all active rooms in the organization with their details.",
    input_schema: {
      type: "object" as const,
      properties: {
        organization_id: { type: "string", description: "The organization ID" },
      },
      required: ["organization_id"],
    },
  },
  {
    name: "create_booking",
    description: "Create a new event booking. Only call this when the user has confirmed they want to book.",
    input_schema: {
      type: "object" as const,
      properties: {
        organization_id: { type: "string", description: "The organization ID" },
        title: { type: "string", description: "Event title" },
        room_id: { type: "string", description: "Room ID to book" },
        start_datetime: { type: "string", description: "Start datetime in ISO format" },
        end_datetime: { type: "string", description: "End datetime in ISO format" },
        contact_name: { type: "string", description: "Contact person name" },
        contact_email: { type: "string", description: "Contact email" },
        expected_attendees: { type: "number", description: "Expected number of attendees (optional)" },
        notes: { type: "string", description: "Additional notes (optional)" },
      },
      required: ["organization_id", "title", "room_id", "start_datetime", "end_datetime", "contact_name", "contact_email"],
    },
  },
  {
    name: "list_my_events",
    description: "List upcoming events for the current user.",
    input_schema: {
      type: "object" as const,
      properties: {
        organization_id: { type: "string", description: "The organization ID" },
        user_email: { type: "string", description: "The user's email" },
      },
      required: ["organization_id", "user_email"],
    },
  },
  {
    name: "cancel_event",
    description: "Cancel an existing event. Only call when user explicitly confirms cancellation.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "The event ID to cancel" },
      },
      required: ["event_id"],
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "search_available_rooms": {
      const orgId = input.organization_id as string;
      const startDt = new Date(input.start_datetime as string);
      const endDt = new Date(input.end_datetime as string);

      const allRooms = await prisma.room.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { sortOrder: "asc" },
      });

      const available = [];
      for (const room of allRooms) {
        const conflicts = await prisma.event.count({
          where: {
            roomId: room.id,
            deleted: false,
            status: { in: ["APPROVED", "PENDING"] },
            startDateTime: { lt: endDt },
            endDateTime: { gt: startDt },
          },
        });
        if (conflicts < room.concurrentEventLimit) {
          available.push({
            id: room.id,
            name: room.name,
            managersOnly: room.managersOnly,
            concurrentLimit: room.concurrentEventLimit,
            currentBookings: conflicts,
            notes: room.notes,
          });
        }
      }

      if (available.length === 0) {
        return JSON.stringify({ available: [], message: "No rooms available for this time slot." });
      }
      return JSON.stringify({ available, totalRooms: allRooms.length });
    }

    case "list_rooms": {
      const rooms = await prisma.room.findMany({
        where: { organizationId: input.organization_id as string, active: true },
        orderBy: { sortOrder: "asc" },
      });
      return JSON.stringify(rooms.map((r) => ({
        id: r.id,
        name: r.name,
        managersOnly: r.managersOnly,
        concurrentLimit: r.concurrentEventLimit,
        notes: r.notes,
      })));
    }

    case "create_booking": {
      const orgId = input.organization_id as string;
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) return JSON.stringify({ error: "Organization not found" });

      const startDt = new Date(input.start_datetime as string);
      const endDt = new Date(input.end_datetime as string);
      const roomId = input.room_id as string;

      // Check conflicts
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return JSON.stringify({ error: "Room not found" });

      const conflicts = await prisma.event.count({
        where: {
          roomId,
          deleted: false,
          status: { in: ["APPROVED", "PENDING"] },
          startDateTime: { lt: endDt },
          endDateTime: { gt: startDt },
        },
      });

      if (conflicts >= room.concurrentEventLimit) {
        return JSON.stringify({ error: `${room.name} is not available during this time.` });
      }

      const event = await prisma.event.create({
        data: {
          organizationId: orgId,
          title: input.title as string,
          roomId,
          startDateTime: startDt,
          endDateTime: endDt,
          contactName: input.contact_name as string,
          contactEmail: input.contact_email as string,
          expectedAttendeeCount: (input.expected_attendees as number) || null,
          notes: (input.notes as string) || "",
          status: org.requiresApproval ? "PENDING" : "APPROVED",
          approved: !org.requiresApproval,
        },
      });

      await prisma.eventActivity.create({
        data: {
          eventId: event.id,
          action: "EVENT_SUBMITTED_VIA_AI",
          actorEmail: input.contact_email as string,
          details: { title: input.title as string, room: room.name },
        },
      });

      return JSON.stringify({
        success: true,
        eventId: event.id,
        status: event.status,
        room: room.name,
        message: org.requiresApproval
          ? "Booking submitted for approval."
          : "Booking confirmed!",
      });
    }

    case "list_my_events": {
      const events = await prisma.event.findMany({
        where: {
          organizationId: input.organization_id as string,
          deleted: false,
          OR: [
            { contactEmail: input.user_email as string },
          ],
          startDateTime: { gte: new Date() },
        },
        include: { room: true },
        orderBy: { startDateTime: "asc" },
        take: 10,
      });

      return JSON.stringify(events.map((e) => ({
        id: e.id,
        title: e.title,
        room: e.room?.name || "No room",
        start: e.startDateTime?.toISOString(),
        end: e.endDateTime?.toISOString(),
        status: e.status,
      })));
    }

    case "cancel_event": {
      const event = await prisma.event.findUnique({
        where: { id: input.event_id as string },
      });
      if (!event) return JSON.stringify({ error: "Event not found" });

      await prisma.event.update({
        where: { id: input.event_id as string },
        data: { deleted: true, status: "CANCELLED" },
      });

      return JSON.stringify({ success: true, message: "Event cancelled." });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI features are not configured. Set ANTHROPIC_API_KEY in your environment." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { messages, organizationId, orgSlug } = body;

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const systemPrompt = `You are a helpful scheduling assistant for "${org.appDisplayName || org.name}". You help users book rooms, check availability, view their events, and manage their schedule.

Key context:
- Organization ID: ${org.id}
- User name: ${token.name || "User"}
- User email: ${token.email}
- Current date/time: ${new Date().toISOString()}
- Timezone: ${org.timezone}
- Rooms are called "${org.roomTerm}s"
- Events are called "${org.eventPluralTerm}"
${org.requiresApproval ? "- This organization requires approval for bookings" : "- Bookings are automatically approved"}
- Room hours: ${org.roomOpeningTime} to ${org.roomClosingTime}

Guidelines:
- Be concise and helpful
- When the user wants to book, search for available rooms first, present options, and confirm before creating
- Always use the user's name and email as contact info unless they specify otherwise
- Format dates and times in a human-friendly way
- If no rooms are available, suggest alternative times`;

  // Run the agentic tool-use loop
  let currentMessages = [...messages];
  let response: Anthropic.Message;

  // Allow up to 5 tool-use rounds
  for (let i = 0; i < 5; i++) {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    // If no tool use, we're done
    if (response.stop_reason !== "tool_use") {
      const textContent = response.content.find((c) => c.type === "text");
      return Response.json({
        role: "assistant",
        content: textContent?.text || "",
      });
    }

    // Process tool calls
    const toolBlocks = response.content.filter((c) => c.type === "tool_use");
    const toolResults: Anthropic.MessageParam[] = [];

    // Add the assistant's response (with tool_use blocks) to messages
    currentMessages.push({ role: "assistant", content: response.content });

    // Execute each tool and add results
    const toolResultContents: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolBlocks) {
      if (block.type === "tool_use") {
        const result = await executeTool(block.name, block.input as Record<string, unknown>);
        toolResultContents.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    currentMessages.push({ role: "user", content: toolResultContents });
  }

  // If we exhausted rounds, return whatever text we have
  return Response.json({
    role: "assistant",
    content: "I'm still working on your request. Could you try again?",
  });
}
