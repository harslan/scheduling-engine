import { describe, it, expect } from "vitest";
import { mergeTemplate, buildEventMergeData } from "@/lib/email-merge";

describe("mergeTemplate", () => {
  it("replaces single field", () => {
    const result = mergeTemplate("Hello {{name}}!", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("replaces multiple fields", () => {
    const result = mergeTemplate(
      "{{eventTitle}} at {{roomName}} on {{startDate}}",
      {
        eventTitle: "MBA Class",
        roomName: "Aula A",
        startDate: "Monday, March 2, 2026",
      }
    );
    expect(result).toBe("MBA Class at Aula A on Monday, March 2, 2026");
  });

  it("replaces same field multiple times", () => {
    const result = mergeTemplate(
      "{{name}} says hello. {{name}} is here.",
      { name: "Alice" }
    );
    expect(result).toBe("Alice says hello. Alice is here.");
  });

  it("leaves unmatched fields as-is", () => {
    const result = mergeTemplate("Hello {{name}}, your {{unknownField}}!", {
      name: "Bob",
    });
    expect(result).toBe("Hello Bob, your {{unknownField}}!");
  });

  it("handles empty data object", () => {
    const result = mergeTemplate("No fields {{here}}", {});
    expect(result).toBe("No fields {{here}}");
  });

  it("handles empty template", () => {
    const result = mergeTemplate("", { name: "test" });
    expect(result).toBe("");
  });

  it("handles empty field values", () => {
    const result = mergeTemplate("Room: {{roomName}}", { roomName: "" });
    expect(result).toBe("Room: ");
  });

  it("handles HTML content correctly", () => {
    const result = mergeTemplate(
      '<td>{{eventTitle}}</td><td>{{roomName}}</td>',
      { eventTitle: "Test Event", roomName: "Room 1" }
    );
    expect(result).toBe("<td>Test Event</td><td>Room 1</td>");
  });

  it("does not replace non-word-character patterns", () => {
    const result = mergeTemplate("{{with-dashes}} {{with spaces}}", {
      "with-dashes": "nope",
      "with spaces": "nope",
    });
    // These should NOT be replaced because \w doesn't match - or spaces
    expect(result).toBe("{{with-dashes}} {{with spaces}}");
  });

  it("HTML-escapes user-controlled values to prevent injection", () => {
    const result = mergeTemplate("<td>{{eventTitle}}</td>", {
      eventTitle: '<script>alert("xss")</script>',
    });
    expect(result).toBe(
      "<td>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</td>"
    );
    expect(result).not.toContain("<script>");
  });

  it("HTML-escapes ampersands and quotes", () => {
    const result = mergeTemplate("{{name}}", {
      name: "O'Malley & Sons \"LLC\"",
    });
    expect(result).toBe("O&#39;Malley &amp; Sons &quot;LLC&quot;");
  });

  it("skips HTML escaping when escapeHtml is false (for plain-text subjects)", () => {
    const result = mergeTemplate(
      "[{{organizationName}}] Event: {{eventTitle}}",
      { organizationName: "INCAE", eventTitle: "O'Malley & Sons" },
      { escapeHtml: false }
    );
    expect(result).toBe("[INCAE] Event: O'Malley & Sons");
  });
});

describe("buildEventMergeData", () => {
  const event = {
    id: "evt-123",
    title: "Faculty Meeting",
    contactName: "Maria Garcia",
    contactEmail: "maria@example.com",
    description: "Monthly faculty meeting",
    expectedAttendeeCount: 50,
    startDateTime: new Date("2026-03-15T14:00:00"),
    endDateTime: new Date("2026-03-15T16:00:00"),
    status: "APPROVED",
  };

  const org = { name: "INCAE", slug: "incae" };

  it("populates all standard fields", () => {
    const data = buildEventMergeData(event, org, "Sala Azul");
    expect(data.eventTitle).toBe("Faculty Meeting");
    expect(data.roomName).toBe("Sala Azul");
    expect(data.contactName).toBe("Maria Garcia");
    expect(data.contactEmail).toBe("maria@example.com");
    expect(data.attendeeCount).toBe("50");
    expect(data.organizationName).toBe("INCAE");
    expect(data.description).toBe("Monthly faculty meeting");
    expect(data.status).toBe("APPROVED");
  });

  it("formats dates correctly", () => {
    const data = buildEventMergeData(event, org, "");
    expect(data.startDate).toContain("March");
    expect(data.startDate).toContain("15");
    expect(data.startDate).toContain("2026");
    expect(data.startTime).toMatch(/2:00 PM/);
    expect(data.endTime).toMatch(/4:00 PM/);
  });

  it("handles null dates as TBD", () => {
    const data = buildEventMergeData(
      { ...event, startDateTime: null, endDateTime: null },
      org,
      ""
    );
    expect(data.startDate).toBe("TBD");
    expect(data.startTime).toBe("TBD");
    expect(data.endDate).toBe("TBD");
    expect(data.endTime).toBe("TBD");
  });

  it("builds event and approval links with org slug", () => {
    const data = buildEventMergeData(event, org, "");
    expect(data.eventLink).toContain("/incae/events/evt-123");
    expect(data.approvalLink).toContain("/incae/admin/approvals");
  });

  it("handles null attendee count", () => {
    const data = buildEventMergeData(
      { ...event, expectedAttendeeCount: null },
      org,
      ""
    );
    expect(data.attendeeCount).toBe("");
  });

  it("handles empty room name", () => {
    const data = buildEventMergeData(event, org, "");
    expect(data.roomName).toBe("");
  });

  it("initializes denialComment as empty", () => {
    const data = buildEventMergeData(event, org, "");
    expect(data.denialComment).toBe("");
  });

  it("includes event type when provided", () => {
    const data = buildEventMergeData(event, org, "", "Workshop");
    expect(data.eventType).toBe("Workshop");
  });
});

describe("template + merge integration", () => {
  it("merges a complete email template", () => {
    const template =
      "[{{organizationName}}] {{eventTitle}} on {{startDate}} at {{startTime}} in {{roomName}}";
    const data = buildEventMergeData(
      {
        id: "1",
        title: "Board Meeting",
        contactName: "Jane",
        contactEmail: "jane@ex.com",
        startDateTime: new Date("2026-06-01T10:00:00"),
        endDateTime: new Date("2026-06-01T12:00:00"),
      },
      { name: "Demo Org", slug: "demo" },
      "Conference Room"
    );

    const result = mergeTemplate(template, data);
    expect(result).toContain("[Demo Org]");
    expect(result).toContain("Board Meeting");
    expect(result).toContain("Conference Room");
    expect(result).toContain("10:00 AM");
  });
});
