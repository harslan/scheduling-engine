import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { mergeTemplate, type EventMergeData } from "@/lib/email-merge";
export { buildEventMergeData } from "@/lib/email-merge";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams) {
  if (!resend) {
    console.log(`[Email skipped - no RESEND_API_KEY] To: ${to}, Subject: ${subject}`);
    return { success: true, skipped: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Scheduling Engine <notifications@resend.dev>",
      to,
      subject,
      html,
      replyTo,
    });

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email error:", err);
    return { success: false, error: "Failed to send email" };
  }
}

// ============================================================
// TEMPLATE SYSTEM
// ============================================================

/** Default templates used when no org override exists */
const DEFAULT_TEMPLATES: Record<string, { subject: string; bodyHtml: string }> = {
  "event-submitted": {
    subject: "[{{organizationName}}] Event submitted: {{eventTitle}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Submitted</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Your event has been submitted and is awaiting review.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{eventTitle}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "event-approved": {
    subject: "[{{organizationName}}] Your event has been approved: {{eventTitle}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Approved</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Great news! Your event has been approved and is now on the calendar.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{eventTitle}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "event-denied": {
    subject: "[{{organizationName}}] Your event was not approved: {{eventTitle}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Not Approved</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Unfortunately, your event <strong>{{eventTitle}}</strong> was not approved.</p>
          <div style="background: #f8fafc; border-left: 3px solid #94a3b8; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Comment:</strong> {{denialComment}}</p>
          </div>
          <p style="color: #64748b; font-size: 14px;">You can submit a new request with different details if needed.</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "approval-required": {
    subject: "[{{organizationName}}] New event needs approval: {{eventTitle}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d97706; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Approval Required</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">A new event needs your approval.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{eventTitle}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Submitted by</td><td style="padding: 8px 0; color: #1e293b;">{{contactName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
          <div style="margin-top: 20px;">
            <a href="{{approvalLink}}" style="background: #0B7DE6; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Review Event</a>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "event-reminder": {
    subject: "[{{organizationName}}] Reminder: {{eventTitle}} — {{startDate}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Reminder</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">This is a reminder about your upcoming event.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{eventTitle}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "event-reminder-digest": {
    subject: "[{{organizationName}}] Upcoming events reminder",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Upcoming Events</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">You have {{eventCount}} upcoming events:</p>
          {{eventList}}
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "event-updated": {
    subject: "[{{organizationName}}] Your event has been updated: {{eventTitle}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Updated</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Your event has been updated. Please review the latest details below.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{eventTitle}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "space-request-submitted": {
    subject: "[{{organizationName}}] Space request received",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Space Request Submitted</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Your space request has been submitted and is being reviewed.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Contact</td><td style="padding: 8px 0; color: #1e293b;">{{contactName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "space-request-approved": {
    subject: "[{{organizationName}}] Your space request has been approved",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Space Request Approved</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Your space request has been approved. A room has been assigned: <strong>{{roomName}}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "event-deleted": {
    subject: "[{{organizationName}}] Event cancelled: {{eventTitle}}",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Cancelled</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">The following event has been cancelled.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{{eventTitle}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td><td style="padding: 8px 0; color: #1e293b;">{{roomName}}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b;">{{startDate}} at {{startTime}}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
  "space-request-denied": {
    subject: "[{{organizationName}}] Your space request was not approved",
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Space Request Not Approved</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">Unfortunately, your space request was not approved.</p>
          <div style="background: #f8fafc; border-left: 3px solid #94a3b8; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Reason:</strong> {{denialComment}}</p>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">{{organizationName}} — Powered by Scheduling Engine</p>
      </div>`,
  },
};

/**
 * Get email template: loads org override or falls back to default.
 */
export async function getEmailTemplate(
  orgId: string,
  slug: string
): Promise<{ subject: string; bodyHtml: string; active: boolean } | null> {
  // Try org-specific override
  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
    include: {
      organizations: {
        where: { organizationId: orgId },
      },
    },
  });

  if (template?.organizations?.[0]) {
    const orgTemplate = template.organizations[0];
    return {
      subject: orgTemplate.subject || DEFAULT_TEMPLATES[slug]?.subject || "",
      bodyHtml: orgTemplate.bodyHtml || DEFAULT_TEMPLATES[slug]?.bodyHtml || "",
      active: orgTemplate.active,
    };
  }

  // Fall back to default
  const defaultTemplate = DEFAULT_TEMPLATES[slug];
  if (!defaultTemplate) return null;

  return { ...defaultTemplate, active: true };
}

/**
 * Send a templated email: load template -> merge -> send.
 */
export async function sendTemplatedEmail(params: {
  to: string;
  orgId: string;
  templateSlug: string;
  mergeData: EventMergeData;
  replyTo?: string;
}) {
  const template = await getEmailTemplate(params.orgId, params.templateSlug);
  if (!template || !template.active) {
    console.log(`[Email skipped] Template "${params.templateSlug}" not active or not found for org ${params.orgId}`);
    return { success: true, skipped: true };
  }

  const subject = mergeTemplate(template.subject, params.mergeData, { escapeHtml: false });
  const html = mergeTemplate(template.bodyHtml, params.mergeData);

  return sendEmail({
    to: params.to,
    subject,
    html,
    replyTo: params.replyTo,
  });
}

export function passwordResetEmail({ resetUrl }: { resetUrl: string }) {
  return {
    subject: "Reset your password \u2014 Scheduling Engine",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Password Reset</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">
            We received a request to reset your password. Click the button below to choose a new password.
          </p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #0B7DE6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 8px;">
            This link expires in 1 hour.
          </p>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
          Scheduling Engine
        </p>
      </div>
    `,
  };
}
