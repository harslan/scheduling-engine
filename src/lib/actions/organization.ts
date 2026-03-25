"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const OrgSettingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  shortName: z.string().min(1, "Short name is required"),
  appDisplayName: z.string().optional(),
  timezone: z.string().optional(),
  primaryColor: z.string().optional(),
  messageBoardHtml: z.string().optional(),

  // Feature flags
  allowsRoomSelection: z.coerce.boolean().optional(),
  allowsMultiDayEvents: z.coerce.boolean().optional(),
  allowsRoomlessEvents: z.coerce.boolean().optional(),
  allowsUnregisteredUsers: z.coerce.boolean().optional(),
  calendarIsPrivate: z.coerce.boolean().optional(),
  requiresApproval: z.coerce.boolean().optional(),
  allowsEventChanges: z.coerce.boolean().optional(),
  allowsRoomRequests: z.coerce.boolean().optional(),
  collectsAttendeeCount: z.coerce.boolean().optional(),
  collectsContactPhone: z.coerce.boolean().optional(),

  // Scheduling constraints
  roomOpeningTime: z.string().optional(),
  roomClosingTime: z.string().optional(),
  maxEventLengthMinutes: z.coerce.number().int().positive().optional(),
  schedulingCutoffDays: z.coerce.number().int().positive().optional().nullable(),

  // Custom labels
  eventSingularTerm: z.string().optional(),
  eventPluralTerm: z.string().optional(),
  roomTerm: z.string().optional(),

  // Email
  emailReplyToAddress: z.string().optional(),
});

export async function updateOrganization(orgId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  // Checkboxes that are unchecked don't appear in FormData
  const booleanFields = [
    "allowsRoomSelection", "allowsMultiDayEvents", "allowsRoomlessEvents",
    "allowsUnregisteredUsers", "calendarIsPrivate", "requiresApproval",
    "allowsEventChanges", "allowsRoomRequests", "collectsAttendeeCount",
    "collectsContactPhone",
  ];
  for (const field of booleanFields) {
    if (!(field in raw)) raw[field] = "false";
  }

  const parsed = OrgSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Organization not found" };

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      name: data.name,
      shortName: data.shortName,
      appDisplayName: data.appDisplayName ?? org.appDisplayName,
      timezone: data.timezone ?? org.timezone,
      primaryColor: data.primaryColor ?? org.primaryColor,
      messageBoardHtml: data.messageBoardHtml ?? org.messageBoardHtml,
      allowsRoomSelection: data.allowsRoomSelection ?? org.allowsRoomSelection,
      allowsMultiDayEvents: data.allowsMultiDayEvents ?? org.allowsMultiDayEvents,
      allowsRoomlessEvents: data.allowsRoomlessEvents ?? org.allowsRoomlessEvents,
      allowsUnregisteredUsers: data.allowsUnregisteredUsers ?? org.allowsUnregisteredUsers,
      calendarIsPrivate: data.calendarIsPrivate ?? org.calendarIsPrivate,
      requiresApproval: data.requiresApproval ?? org.requiresApproval,
      allowsEventChanges: data.allowsEventChanges ?? org.allowsEventChanges,
      allowsRoomRequests: data.allowsRoomRequests ?? org.allowsRoomRequests,
      collectsAttendeeCount: data.collectsAttendeeCount ?? org.collectsAttendeeCount,
      collectsContactPhone: data.collectsContactPhone ?? org.collectsContactPhone,
      roomOpeningTime: data.roomOpeningTime ?? org.roomOpeningTime,
      roomClosingTime: data.roomClosingTime ?? org.roomClosingTime,
      maxEventLengthMinutes: data.maxEventLengthMinutes ?? org.maxEventLengthMinutes,
      schedulingCutoffDays: data.schedulingCutoffDays === undefined ? org.schedulingCutoffDays : data.schedulingCutoffDays,
      eventSingularTerm: data.eventSingularTerm ?? org.eventSingularTerm,
      eventPluralTerm: data.eventPluralTerm ?? org.eventPluralTerm,
      roomTerm: data.roomTerm ?? org.roomTerm,
      emailReplyToAddress: data.emailReplyToAddress ?? org.emailReplyToAddress,
    },
  });

  revalidatePath(`/${org.slug}`);
  revalidatePath(`/${org.slug}/admin/organization`);

  return { success: true };
}
