import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, sendTemplatedEmail, buildEventMergeData } from "@/lib/email";
import { format } from "date-fns";

interface ReminderItem {
  eventId: string;
  instanceId?: string;
  title: string;
  roomName: string;
  contactEmail: string;
  startDateTime: Date;
  endDateTime: Date;
  orgId: string;
  orgName: string;
  orgTimezone: string | null;
  replyTo?: string;
  // Full event for merge data
  event: Parameters<typeof buildEventMergeData>[0];
  org: Parameters<typeof buildEventMergeData>[1];
}

/**
 * Vercel Cron endpoint for sending event reminder emails.
 * Groups multiple reminders for the same contact into a single digest email.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cronKey = "reminder-last-check";

  // Get last check timestamp
  const cronState = await prisma.cronState.findUnique({
    where: { key: cronKey },
  });
  const lastCheck = cronState?.value || new Date(now.getTime() - 15 * 60 * 1000);

  // Get all orgs with reminders enabled
  const orgs = await prisma.organization.findMany({
    where: { reminderEmailHours: { not: null } },
  });

  let totalSent = 0;

  for (const org of orgs) {
    if (!org.reminderEmailHours) continue;

    try {
      const hoursMs = org.reminderEmailHours * 60 * 60 * 1000;
      const windowStart = new Date(lastCheck.getTime() + hoursMs);
      const windowEnd = new Date(now.getTime() + hoursMs);
      const effectiveWindowStart = windowStart > now ? windowStart : now;

      const pendingReminders: ReminderItem[] = [];

      // ── Non-recurring events ──
      const events = await prisma.event.findMany({
        where: {
          organizationId: org.id,
          deleted: false,
          status: "APPROVED",
          recurrenceRule: null,
          startDateTime: { gte: effectiveWindowStart, lt: windowEnd },
        },
        include: { room: true },
      });

      for (const event of events) {
        if (!event.contactEmail || !event.emailUpdates) continue;

        const alreadySent = await prisma.eventActivity.findFirst({
          where: { eventId: event.id, action: "REMINDER_SENT" },
        });
        if (alreadySent) continue;

        pendingReminders.push({
          eventId: event.id,
          title: event.title,
          roomName: event.room?.name || "",
          contactEmail: event.contactEmail,
          startDateTime: event.startDateTime!,
          endDateTime: event.endDateTime!,
          orgId: org.id,
          orgName: org.appDisplayName || org.name,
          orgTimezone: org.timezone,
          replyTo: org.emailReplyToAddress || undefined,
          event,
          org,
        });
      }

      // ── Recurring instances ──
      const instances = await prisma.eventInstance.findMany({
        where: {
          deleted: false,
          startDateTime: { gte: effectiveWindowStart, lt: windowEnd },
          event: {
            organizationId: org.id,
            deleted: false,
            status: "APPROVED",
            recurrenceRule: { not: null },
          },
        },
        include: { event: { include: { room: true } } },
      });

      for (const instance of instances) {
        const event = instance.event;
        if (!event.contactEmail || !event.emailUpdates) continue;

        const alreadySent = await prisma.eventActivity.findFirst({
          where: {
            eventId: event.id,
            action: "REMINDER_SENT",
            details: { path: ["instanceId"], equals: instance.id },
          },
        });
        if (alreadySent) continue;

        pendingReminders.push({
          eventId: event.id,
          instanceId: instance.id,
          title: event.title,
          roomName: event.room?.name || "",
          contactEmail: event.contactEmail,
          startDateTime: instance.startDateTime,
          endDateTime: instance.endDateTime,
          orgId: org.id,
          orgName: org.appDisplayName || org.name,
          orgTimezone: org.timezone,
          replyTo: org.emailReplyToAddress || undefined,
          event: { ...event, startDateTime: instance.startDateTime, endDateTime: instance.endDateTime },
          org,
        });
      }

      // ── Group by contactEmail and send ──
      const grouped = new Map<string, ReminderItem[]>();
      for (const item of pendingReminders) {
        const existing = grouped.get(item.contactEmail) || [];
        existing.push(item);
        grouped.set(item.contactEmail, existing);
      }

      for (const [contactEmail, items] of grouped) {
        if (items.length === 1) {
          // Single event — use the standard template
          const item = items[0];
          const mergeData = buildEventMergeData(item.event, item.org, item.roomName);

          await sendTemplatedEmail({
            to: contactEmail,
            orgId: org.id,
            templateSlug: "event-reminder",
            mergeData,
            replyTo: item.replyTo,
          });
        } else {
          // Multiple events — send a grouped digest
          const sorted = items.sort(
            (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
          );

          const eventRows = sorted
            .map((item) => {
              const dateStr = format(item.startDateTime, "EEE, MMM d");
              const timeStr = `${format(item.startDateTime, "h:mm a")} — ${format(item.endDateTime, "h:mm a")}`;
              return `<tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; font-size: 14px;">${escapeHtml(item.title)}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${escapeHtml(item.roomName || "—")}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${escapeHtml(dateStr)}<br/><span style="font-size: 12px; color: #94a3b8;">${escapeHtml(timeStr)}</span></td>
              </tr>`;
            })
            .join("");

          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Upcoming Events</h1>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
                <p style="color: #334155; margin: 0 0 16px;">You have ${items.length} upcoming events:</p>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background: #f8fafc;">
                      <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase;">Event</th>
                      <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase;">Room</th>
                      <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase;">When</th>
                    </tr>
                  </thead>
                  <tbody>${eventRows}</tbody>
                </table>
              </div>
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">${escapeHtml(items[0].orgName)} — Powered by Scheduling Engine</p>
            </div>`;

          await sendEmail({
            to: contactEmail,
            subject: `[${items[0].orgName}] Reminder: ${items.length} upcoming events`,
            html,
            replyTo: items[0].replyTo,
          });
        }

        // Log REMINDER_SENT for each item in the group
        for (const item of items) {
          await prisma.eventActivity.create({
            data: {
              eventId: item.eventId,
              action: "REMINDER_SENT",
              details: {
                reminderHours: org.reminderEmailHours,
                ...(item.instanceId ? { instanceId: item.instanceId } : {}),
                grouped: items.length > 1,
              },
            },
          });
        }

        totalSent++;
      }
    } catch (err) {
      console.error(`[Cron] Failed to process reminders for org ${org.id}:`, err);
    }
  }

  // Update last check timestamp
  await prisma.cronState.upsert({
    where: { key: cronKey },
    update: { value: now },
    create: { key: cronKey, value: now },
  });

  return NextResponse.json({ success: true, sent: totalSent });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
