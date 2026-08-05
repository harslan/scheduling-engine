import { describe, it, expect } from "vitest";
import { mergeTemplate, buildEventMergeData } from "@/lib/email-merge";

/**
 * Tests for the template-based email system.
 * Template loading (getEmailTemplate) and sending (sendTemplatedEmail) require
 * database access and are covered by integration tests. These unit tests verify
 * the merge logic and data building that power the templates.
 */

describe("mergeTemplate with email HTML", () => {
  const sampleTemplate = `
    <div>
      <h1>{{organizationName}}</h1>
      <p>Event: {{eventTitle}}</p>
      <p>Room: {{roomName}}</p>
      <p>Date: {{startDate}} at {{startTime}}</p>
      <p>Contact: {{contactName}} ({{contactEmail}})</p>
    </div>`;

  it("produces valid merged HTML", () => {
    const data = buildEventMergeData(
      {
        id: "evt-1",
        title: "Board Meeting",
        contactName: "Jane",
        contactEmail: "jane@example.com",
        startDateTime: new Date("2026-06-01T10:00:00"),
        endDateTime: new Date("2026-06-01T12:00:00"),
      },
      { name: "Demo Org", slug: "demo" },
      "Conference Room"
    );

    const result = mergeTemplate(sampleTemplate, data);
    expect(result).toContain("<h1>Demo Org</h1>");
    expect(result).toContain("Board Meeting");
    expect(result).toContain("Conference Room");
    expect(result).toContain("Jane");
    expect(result).toContain("jane@example.com");
    expect(result).toContain("10:00 AM");
  });

  it("handles denial template with comment", () => {
    const denialTemplate =
      "<p>{{eventTitle}} was denied.</p><p>Reason: {{denialComment}}</p>";
    const data = buildEventMergeData(
      {
        id: "evt-1",
        title: "Party",
        contactName: "Bob",
        contactEmail: "bob@example.com",
        startDateTime: new Date("2026-06-01T18:00:00"),
        endDateTime: new Date("2026-06-01T21:00:00"),
      },
      { name: "Org", slug: "org" },
      ""
    );
    data.denialComment = "Room reserved for maintenance";

    const result = mergeTemplate(denialTemplate, data);
    expect(result).toContain("Party was denied.");
    expect(result).toContain("Room reserved for maintenance");
  });
});

describe("passwordResetEmail", () => {
  // passwordResetEmail is a standalone function, not template-based
  it("is exported from email.ts", async () => {
    const { passwordResetEmail } = await import("@/lib/email");
    const result = passwordResetEmail({ resetUrl: "https://example.com/reset/abc123" });
    expect(result.subject).toContain("Reset your password");
    expect(result.html).toContain("https://example.com/reset/abc123");
    expect(result.html).toContain("Reset Password");
  });
});
