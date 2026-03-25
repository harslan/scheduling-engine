"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface ImportRow {
  title: string;
  type?: string;
  room?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  notes?: string;
  expectedAttendees?: string;
}

export async function importEvents(orgSlug: string, csvText: string) {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      rooms: { where: { active: true } },
      eventTypes: true,
    },
  });

  if (!org) return { error: "Organization not found" };

  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { error: "CSV must have a header row and at least one data row" };

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Map header positions
  const colMap = {
    title: findCol(headers, ["title", "event", "eventname", "event_name"]),
    type: findCol(headers, ["type", "eventtype", "event_type"]),
    room: findCol(headers, ["room", "location", "space"]),
    startDate: findCol(headers, ["startdate", "start_date", "begindate", "begin_date", "date"]),
    startTime: findCol(headers, ["starttime", "start_time", "begintime", "begin_time", "time"]),
    endDate: findCol(headers, ["enddate", "end_date"]),
    endTime: findCol(headers, ["endtime", "end_time"]),
    contactName: findCol(headers, ["contactname", "contact_name", "contact", "hostname", "host_name", "host"]),
    contactEmail: findCol(headers, ["contactemail", "contact_email", "email"]),
    contactPhone: findCol(headers, ["contactphone", "contact_phone", "phone"]),
    notes: findCol(headers, ["notes", "description", "comments"]),
    expectedAttendees: findCol(headers, ["expectedattendees", "expected_attendees", "attendees", "attendeecount"]),
  };

  if (colMap.title === -1) return { error: "CSV must have a 'Title' column" };
  if (colMap.startDate === -1) return { error: "CSV must have a 'StartDate' column" };
  if (colMap.startTime === -1) return { error: "CSV must have a 'StartTime' column" };

  // Build room and type lookup maps
  const roomMap = new Map<string, string>();
  for (const room of org.rooms) {
    roomMap.set(room.name.toLowerCase(), room.id);
  }
  const typeMap = new Map<string, string>();
  for (const type of org.eventTypes) {
    typeMap.set(type.name.toLowerCase(), type.id);
  }

  const errors: string[] = [];
  let imported = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => c.trim() === "")) continue;

    const row: ImportRow = {
      title: getCol(cols, colMap.title),
      type: getCol(cols, colMap.type),
      room: getCol(cols, colMap.room),
      startDate: getCol(cols, colMap.startDate),
      startTime: getCol(cols, colMap.startTime),
      endDate: getCol(cols, colMap.endDate) || getCol(cols, colMap.startDate),
      endTime: getCol(cols, colMap.endTime) || "",
      contactName: getCol(cols, colMap.contactName),
      contactEmail: getCol(cols, colMap.contactEmail),
      contactPhone: getCol(cols, colMap.contactPhone),
      notes: getCol(cols, colMap.notes),
      expectedAttendees: getCol(cols, colMap.expectedAttendees),
    };

    if (!row.title) {
      errors.push(`Row ${i + 1}: Missing title`);
      continue;
    }

    // Parse dates
    const startDt = parseDateTime(row.startDate, row.startTime);
    if (!startDt) {
      errors.push(`Row ${i + 1}: Invalid start date/time "${row.startDate} ${row.startTime}"`);
      continue;
    }

    let endDt = row.endTime ? parseDateTime(row.endDate, row.endTime) : null;
    if (!endDt) {
      // Default to 1 hour after start
      endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    }

    // Look up room
    let roomId: string | null = null;
    if (row.room) {
      roomId = roomMap.get(row.room.toLowerCase()) || null;
      if (!roomId) {
        errors.push(`Row ${i + 1}: Room "${row.room}" not found (skipped room assignment)`);
      }
    }

    // Look up event type
    let eventTypeId: string | null = null;
    if (row.type) {
      eventTypeId = typeMap.get(row.type.toLowerCase()) || null;
    }

    try {
      await prisma.event.create({
        data: {
          organizationId: org.id,
          title: row.title,
          roomId,
          eventTypeId,
          startDateTime: startDt,
          endDateTime: endDt,
          contactName: row.contactName || "",
          contactEmail: row.contactEmail || "",
          contactPhone: row.contactPhone || "",
          notes: row.notes || "",
          expectedAttendeeCount: row.expectedAttendees ? parseInt(row.expectedAttendees) || null : null,
          status: org.requiresApproval ? "PENDING" : "APPROVED",
          approved: !org.requiresApproval,
        },
      });
      imported++;
    } catch (err) {
      errors.push(`Row ${i + 1}: Database error — ${(err as Error).message}`);
    }
  }

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/admin/approvals`);

  return {
    success: true,
    imported,
    total: lines.length - 1,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const idx = headers.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getCol(cols: string[], idx: number): string {
  if (idx === -1 || idx >= cols.length) return "";
  return cols[idx].trim();
}

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  try {
    // Try ISO format first
    const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
    const dt = new Date(combined);
    if (!isNaN(dt.getTime())) return dt;

    // Try M/D/YYYY format
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [m, d, y] = parts.map(Number);
      const timeParts = timeStr.split(":");
      const hours = timeParts.length >= 1 ? parseInt(timeParts[0]) : 0;
      const minutes = timeParts.length >= 2 ? parseInt(timeParts[1]) : 0;
      return new Date(y, m - 1, d, hours, minutes);
    }

    return null;
  } catch {
    return null;
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
