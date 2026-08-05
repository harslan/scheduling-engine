/**
 * Simple mail-merge engine: replaces {{fieldName}} with values.
 * Mirrors EWL's GlobalStatics mail merge.
 * All values are HTML-escaped to prevent injection.
 */
export function mergeTemplate(
  template: string,
  data: Record<string, string>,
  options?: { escapeHtml?: boolean }
): string {
  const shouldEscape = options?.escapeHtml !== false;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in data)) return match;
    return shouldEscape ? escapeHtml(data[key]) : data[key];
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EventMergeData {
  eventTitle: string;
  roomName: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  contactName: string;
  contactEmail: string;
  attendeeCount: string;
  eventType: string;
  organizationName: string;
  eventLink: string;
  approvalLink: string;
  description: string;
  denialComment: string;
  status: string;
  [key: string]: string;
}

/**
 * Build merge data from DB records.
 */
export function buildEventMergeData(
  event: {
    id: string;
    title: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    description?: string;
    expectedAttendeeCount?: number | null;
    startDateTime?: Date | null;
    endDateTime?: Date | null;
    status?: string;
  },
  org: {
    name: string;
    slug: string;
    timezone?: string | null;
  },
  roomName: string,
  eventTypeName?: string
): EventMergeData {
  const baseUrl = process.env.NEXTAUTH_URL || "";
  const tz = org.timezone || undefined;

  return {
    eventTitle: event.title || "",
    roomName: roomName || "",
    startDate: event.startDateTime
      ? fmtDate(event.startDateTime, tz)
      : "TBD",
    startTime: event.startDateTime
      ? fmtTime(event.startDateTime, tz)
      : "TBD",
    endDate: event.endDateTime
      ? fmtDate(event.endDateTime, tz)
      : "TBD",
    endTime: event.endDateTime
      ? fmtTime(event.endDateTime, tz)
      : "TBD",
    contactName: event.contactName || "",
    contactEmail: event.contactEmail || "",
    attendeeCount: event.expectedAttendeeCount?.toString() || "",
    eventType: eventTypeName || "",
    organizationName: org.name,
    eventLink: `${baseUrl}/${org.slug}/events/${event.id}`,
    approvalLink: `${baseUrl}/${org.slug}/admin/approvals`,
    description: event.description || "",
    denialComment: "",
    status: event.status || "",
  };
}

function fmtDate(date: Date, timezone?: string): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function fmtTime(date: Date, timezone?: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(timezone ? { timeZone: timezone } : {}),
  });
}
