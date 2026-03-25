import { describe, it, expect } from "vitest";
import {
  eventSubmittedEmail,
  eventApprovedEmail,
  eventDeniedEmail,
  approvalRequestEmail,
} from "@/lib/email";

describe("eventSubmittedEmail", () => {
  it("generates pending email when status is PENDING", () => {
    const result = eventSubmittedEmail({
      orgName: "INCAE",
      eventTitle: "MBA Class",
      roomName: "Aula 1",
      startDate: "Monday, March 2, 2026 at 9:00 AM",
      status: "PENDING",
    });

    expect(result.subject).toContain("submitted for approval");
    expect(result.subject).toContain("INCAE");
    expect(result.subject).toContain("MBA Class");
    expect(result.html).toContain("Event Submitted");
    expect(result.html).toContain("awaiting approval");
    expect(result.html).toContain("MBA Class");
    expect(result.html).toContain("Aula 1");
    expect(result.html).toContain("Pending Approval");
  });

  it("generates confirmed email when status is APPROVED", () => {
    const result = eventSubmittedEmail({
      orgName: "INCAE",
      eventTitle: "Workshop",
      roomName: "Sala Azul",
      startDate: "Friday, March 6, 2026 at 2:00 PM",
      status: "APPROVED",
    });

    expect(result.subject).toContain("Event confirmed");
    expect(result.html).toContain("Event Confirmed");
    expect(result.html).toContain("approved and added to the calendar");
    expect(result.html).toContain("Approved");
  });

  it("shows dash when no room provided", () => {
    const result = eventSubmittedEmail({
      orgName: "Test",
      eventTitle: "Test Event",
      roomName: "",
      startDate: "Monday, March 2, 2026 at 9:00 AM",
      status: "PENDING",
    });

    expect(result.html).toContain("—");
  });
});

describe("eventApprovedEmail", () => {
  it("generates approval notification", () => {
    const result = eventApprovedEmail({
      orgName: "INCAE",
      eventTitle: "Faculty Meeting",
      roomName: "Sala CD",
      startDate: "Wednesday, March 4, 2026 at 10:00 AM",
    });

    expect(result.subject).toContain("approved");
    expect(result.subject).toContain("INCAE");
    expect(result.subject).toContain("Faculty Meeting");
    expect(result.html).toContain("Event Approved");
    expect(result.html).toContain("Great news");
    expect(result.html).toContain("Sala CD");
  });
});

describe("eventDeniedEmail", () => {
  it("generates denial notification with comment", () => {
    const result = eventDeniedEmail({
      orgName: "INCAE",
      eventTitle: "Party",
      comment: "Room is reserved for maintenance",
    });

    expect(result.subject).toContain("not approved");
    expect(result.subject).toContain("Party");
    expect(result.html).toContain("Event Not Approved");
    expect(result.html).toContain("Room is reserved for maintenance");
  });

  it("generates denial notification without comment", () => {
    const result = eventDeniedEmail({
      orgName: "INCAE",
      eventTitle: "Party",
    });

    expect(result.subject).toContain("not approved");
    expect(result.html).not.toContain("Comment:");
  });
});

describe("approvalRequestEmail", () => {
  it("generates approval request for managers", () => {
    const result = approvalRequestEmail({
      orgName: "INCAE",
      eventTitle: "Guest Speaker",
      submitterName: "Maria Garcia",
      roomName: "Aula Manuel Jiménez",
      startDate: "Thursday, March 5, 2026 at 4:00 PM",
      approvalUrl: "https://example.com/incae/admin/approvals",
    });

    expect(result.subject).toContain("needs approval");
    expect(result.subject).toContain("Guest Speaker");
    expect(result.html).toContain("Approval Required");
    expect(result.html).toContain("Maria Garcia");
    expect(result.html).toContain("Aula Manuel Jiménez");
    expect(result.html).toContain("Review Event");
    expect(result.html).toContain("https://example.com/incae/admin/approvals");
  });
});
