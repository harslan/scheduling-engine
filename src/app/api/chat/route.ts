import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { wallTimeToUtc, utcToWallTime } from "@/lib/orgtime";
import { detectConflicts } from "@/lib/conflict-detection";

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

async function executeTool(name: string, input: Record<string, unknown>, context: { userEmail: string; organizationId: string }): Promise<string> {
  switch (name) {
    case "search_available_rooms": {
      const orgId = input.organization_id as string;
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) return JSON.stringify({ error: "Organization not found" });

      // Model-supplied times are wall-clock in the org's timezone
      const startDt = wallTimeToUtc(input.start_datetime as string, org.timezone);
      const endDt = wallTimeToUtc(input.end_datetime as string, org.timezone);

      const allRooms = await prisma.room.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { sortOrder: "asc" },
      });

      const available = [];
      for (const room of allRooms) {
        const result = await detectConflicts({
          orgId,
          roomId: room.id,
          startDateTime: startDt,
          endDateTime: endDt,
          timezone: org.timezone,
        });
        if (!result.hasConflict) {
          available.push({
            id: room.id,
            name: room.name,
            managersOnly: room.managersOnly,
            concurrentLimit: room.concurrentEventLimit,
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

      // Model-supplied times are wall-clock in the org's timezone
      const startDt = wallTimeToUtc(input.start_datetime as string, org.timezone);
      const endDt = wallTimeToUtc(input.end_datetime as string, org.timezone);
      const roomId = input.room_id as string;

      // Basic time validation
      if (startDt >= endDt) {
        return JSON.stringify({ error: "End time must be after start time." });
      }

      // Determine if user is admin/manager (reused for constraint checks below)
      const chatUser = await prisma.user.findUnique({ where: { email: context.userEmail } });
      const chatIsAdmin = chatUser
        ? await prisma.organizationMember.findFirst({
            where: { organizationId: orgId, userId: chatUser.id, role: { in: ["ADMIN", "MANAGER"] } },
          })
        : null;

      // EWL: enforce scheduling constraints for non-admin users
      if (!chatIsAdmin) {
        // Max event length
        const durationMinutes = (endDt.getTime() - startDt.getTime()) / (1000 * 60);
        if (org.maxEventLengthMinutes && durationMinutes > org.maxEventLengthMinutes) {
          const hours = Math.floor(org.maxEventLengthMinutes / 60);
          const mins = org.maxEventLengthMinutes % 60;
          return JSON.stringify({
            error: `Event duration exceeds the maximum of ${hours > 0 ? `${hours}h` : ""}${mins > 0 ? ` ${mins}m` : ""}. Please shorten your event.`,
          });
        }

        // Room opening/closing times
        if (org.roomOpeningTime && org.roomClosingTime) {
          const tz = org.timezone || undefined;
          const startH = parseInt(startDt.toLocaleString("en-US", { hour: "numeric", hour12: false, ...(tz ? { timeZone: tz } : {}) }));
          const startM = parseInt(startDt.toLocaleString("en-US", { minute: "numeric", ...(tz ? { timeZone: tz } : {}) }));
          const endH = parseInt(endDt.toLocaleString("en-US", { hour: "numeric", hour12: false, ...(tz ? { timeZone: tz } : {}) }));
          const endM = parseInt(endDt.toLocaleString("en-US", { minute: "numeric", ...(tz ? { timeZone: tz } : {}) }));
          const [openH, openM] = org.roomOpeningTime.split(":").map(Number);
          const [closeH, closeM] = org.roomClosingTime.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const openMinutes = openH * 60 + openM;
          const closeMinutes = closeH * 60 + closeM;

          if (startMinutes < openMinutes || endMinutes > closeMinutes) {
            return JSON.stringify({
              error: `Events must be scheduled between ${org.roomOpeningTime} and ${org.roomClosingTime}.`,
            });
          }
        }

        // Past event check
        if (startDt < new Date()) {
          return JSON.stringify({ error: "Cannot schedule events in the past." });
        }

        // Scheduling cutoff (rolling days)
        if (org.schedulingCutoffDays) {
          const tz = org.timezone || undefined;
          const nowStr = new Date().toLocaleDateString("en-CA", tz ? { timeZone: tz } : {});
          const startStr = startDt.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {});
          const nowDate = new Date(nowStr + "T00:00:00Z");
          const startDate = new Date(startStr + "T00:00:00Z");
          const diffDays = Math.floor((startDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < org.schedulingCutoffDays) {
            return JSON.stringify({
              error: `Events must be scheduled at least ${org.schedulingCutoffDays} day(s) in advance.`,
            });
          }
        }

        // Scheduling cutoff (fixed date)
        if (org.schedulingCutoffFixedDate && startDt > org.schedulingCutoffFixedDate) {
          const cutoffStr = org.schedulingCutoffFixedDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            ...(org.timezone ? { timeZone: org.timezone } : {}),
          });
          return JSON.stringify({
            error: `Events cannot be scheduled after ${cutoffStr}.`,
          });
        }
      }

      // Multi-day event check
      if (!org.allowsMultiDayEvents) {
        const tz = org.timezone || undefined;
        const startDateStr = startDt.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {});
        const endDateStr = endDt.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {});
        if (startDateStr !== endDateStr) {
          return JSON.stringify({ error: "Multi-day events are not allowed for this organization." });
        }
      }

      // Check conflicts using full detection engine
      // (includes parent/child rooms, recurring instances, and buffer time)
      const conflictResult = await detectConflicts({
        orgId,
        roomId,
        startDateTime: startDt,
        endDateTime: endDt,
        timezone: org.timezone,
      });

      if (conflictResult.hasConflict) {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        return JSON.stringify({ error: `${room?.name || "Room"} is not available during this time.` });
      }

      // Validate room belongs to this organization (prevent cross-org linkage)
      const room = await prisma.room.findFirst({ where: { id: roomId, organizationId: orgId } });
      if (!room) return JSON.stringify({ error: "Room not found" });

      // Room must be active
      if (!room.active) {
        return JSON.stringify({ error: `${room.name} is no longer available for booking.` });
      }

      // EWL: managersOnly rooms blocked for non-admin users
      if (room.managersOnly && !chatIsAdmin) {
        return JSON.stringify({ error: `${room.name} is only available to managers. Please select a different room.` });
      }

      // Determine auto-approval (EWL: admins + designated approvers get auto-approval)
      let autoApproved = !org.requiresApproval;
      if (!autoApproved) {
        if (chatIsAdmin) {
          autoApproved = true;
        } else if (chatUser) {
          const isApprover = org.approverId === chatUser.id || room.approverId === chatUser.id;
          if (isApprover) autoApproved = true;
        }
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
          status: autoApproved ? "APPROVED" : "PENDING",
          approved: autoApproved,
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
        message: event.status === "APPROVED"
          ? "Booking confirmed!"
          : "Booking submitted for approval.",
      });
    }

    case "list_my_events": {
      const org = await prisma.organization.findUnique({
        where: { id: input.organization_id as string },
        select: { timezone: true },
      });
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

      // Times are presented to the model as org-local wall-clock, matching
      // the convention stated in the system prompt.
      return JSON.stringify(events.map((e) => ({
        id: e.id,
        title: e.title,
        room: e.room?.name || "No room",
        start: e.startDateTime ? utcToWallTime(e.startDateTime, org?.timezone) : undefined,
        end: e.endDateTime ? utcToWallTime(e.endDateTime, org?.timezone) : undefined,
        status: e.status,
      })));
    }

    case "cancel_event": {
      const event = await prisma.event.findUnique({
        where: { id: input.event_id as string },
      });
      if (!event) return JSON.stringify({ error: "Event not found" });

      // Verify event belongs to this organization
      if (event.organizationId !== context.organizationId) {
        return JSON.stringify({ error: "Event not found" });
      }

      // Cannot cancel already-deleted/cancelled events
      if (event.deleted || event.status === "CANCELLED") {
        return JSON.stringify({ error: "This event has already been cancelled." });
      }

      // Verify user is the event contact or submitter
      if (event.contactEmail !== context.userEmail) {
        // Check if user is an admin/manager
        const member = await prisma.organizationMember.findFirst({
          where: {
            organizationId: context.organizationId,
            user: { email: context.userEmail },
            role: { in: ["ADMIN", "MANAGER"] },
          },
        });
        if (!member) {
          return JSON.stringify({ error: "You can only cancel your own events." });
        }
      }

      await prisma.$transaction([
        prisma.event.update({
          where: { id: input.event_id as string },
          data: { deleted: true, status: "CANCELLED" },
        }),
        // Soft-delete recurring instances so they don't block conflict detection
        prisma.eventInstance.updateMany({
          where: { eventId: event.id },
          data: { deleted: true },
        }),
        prisma.eventActivity.create({
          data: {
            eventId: event.id,
            action: "EVENT_CANCELLED",
            actorEmail: context.userEmail,
          },
        }),
      ]);

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
- Current date/time (org-local): ${utcToWallTime(new Date(), org.timezone)}
- Timezone: ${org.timezone}
- All times are wall-clock in the organization's timezone (${org.timezone}): times users mention, times you show them, and times you pass to or receive from tools. Pass tool datetimes as local wall-clock without any timezone suffix (e.g., 2026-03-25T14:00:00).
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
      model: "claude-opus-4-8",
      max_tokens: 2048,
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
        const result = await executeTool(block.name, block.input as Record<string, unknown>, { userEmail: token.email as string, organizationId });
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
