import { Resend } from "resend";

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
// EMAIL TEMPLATES
// ============================================================

export function eventSubmittedEmail({
  orgName,
  eventTitle,
  roomName,
  startDate,
  status,
}: {
  orgName: string;
  eventTitle: string;
  roomName: string;
  startDate: string;
  status: string;
}) {
  const isPending = status === "PENDING";
  return {
    subject: isPending
      ? `[${orgName}] Event submitted for approval: ${eventTitle}`
      : `[${orgName}] Event confirmed: ${eventTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B7DE6; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">
            ${isPending ? "Event Submitted" : "Event Confirmed"}
          </h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">
            ${isPending
              ? "Your event has been submitted and is awaiting approval."
              : "Your event has been approved and added to the calendar."}
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td>
              <td style="padding: 8px 0; color: #1e293b;">${roomName || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #1e293b;">${startDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Status</td>
              <td style="padding: 8px 0;">
                <span style="background: ${isPending ? "#fef3c7" : "#d1fae5"}; color: ${isPending ? "#92400e" : "#065f46"}; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: 500;">
                  ${isPending ? "Pending Approval" : "Approved"}
                </span>
              </td>
            </tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
          ${orgName} — Powered by Scheduling Engine
        </p>
      </div>
    `,
  };
}

export function eventApprovedEmail({
  orgName,
  eventTitle,
  roomName,
  startDate,
}: {
  orgName: string;
  eventTitle: string;
  roomName: string;
  startDate: string;
}) {
  return {
    subject: `[${orgName}] Your event has been approved: ${eventTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Approved</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">
            Great news! Your event has been approved and is now on the calendar.
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td>
              <td style="padding: 8px 0; color: #1e293b;">${roomName || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #1e293b;">${startDate}</td>
            </tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
          ${orgName} — Powered by Scheduling Engine
        </p>
      </div>
    `,
  };
}

export function eventDeniedEmail({
  orgName,
  eventTitle,
  comment,
}: {
  orgName: string;
  eventTitle: string;
  comment?: string;
}) {
  return {
    subject: `[${orgName}] Your event was not approved: ${eventTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Event Not Approved</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">
            Unfortunately, your event <strong>${eventTitle}</strong> was not approved.
          </p>
          ${comment ? `
            <div style="background: #f8fafc; border-left: 3px solid #94a3b8; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                <strong>Comment:</strong> ${comment}
              </p>
            </div>
          ` : ""}
          <p style="color: #64748b; font-size: 14px;">
            You can submit a new request with different details if needed.
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
          ${orgName} — Powered by Scheduling Engine
        </p>
      </div>
    `,
  };
}

export function approvalRequestEmail({
  orgName,
  eventTitle,
  submitterName,
  roomName,
  startDate,
  approvalUrl,
}: {
  orgName: string;
  eventTitle: string;
  submitterName: string;
  roomName: string;
  startDate: string;
  approvalUrl: string;
}) {
  return {
    subject: `[${orgName}] New event needs approval: ${eventTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d97706; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Approval Required</h1>
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 16px;">
            A new event needs your approval.
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Submitted by</td>
              <td style="padding: 8px 0; color: #1e293b;">${submitterName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Room</td>
              <td style="padding: 8px 0; color: #1e293b;">${roomName || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #1e293b;">${startDate}</td>
            </tr>
          </table>
          <div style="margin-top: 20px;">
            <a href="${approvalUrl}" style="background: #0B7DE6; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Review Event
            </a>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
          ${orgName} — Powered by Scheduling Engine
        </p>
      </div>
    `,
  };
}
