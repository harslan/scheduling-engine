"use server";

import { prisma } from "@/lib/prisma";
import { wallTimeToUtc } from "@/lib/orgtime";
import { requireOrgRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendTemplatedEmail, buildEventMergeData } from "@/lib/email";
import { detectConflicts } from "@/lib/conflict-detection";

const SubmitRoomRequestSchema = z.object({
  organizationId: z.string(),
  description: z.string().min(1, "Description is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email("Valid email is required"),
  contactPhone: z.string().optional(),
  expectedAttendeeCount: z.coerce.number().int().positive().optional(),
  requestedStartDateTime: z.string().min(1, "Start date is required"),
  requestedEndDateTime: z.string().min(1, "End date is required"),
});

export async function submitRoomRequest(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = SubmitRoomRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) return { error: "Organization not found" };
  if (!org.allowsRoomRequests) return { error: "Room requests are not enabled" };

  // Form times are wall-clock in the org's timezone
  const startDt = wallTimeToUtc(data.requestedStartDateTime, org.timezone);
  const endDt = wallTimeToUtc(data.requestedEndDateTime, org.timezone);

  if (startDt >= endDt) {
    return { error: "End time must be after start time" };
  }

  if (startDt < new Date()) {
    return { error: "Cannot request space in the past." };
  }

  const request = await prisma.roomRequest.create({
    data: {
      organizationId: data.organizationId,
      description: data.description,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || "",
      expectedAttendeeCount: data.expectedAttendeeCount || null,
      requestedStartDateTime: startDt,
      requestedEndDateTime: endDt,
    },
  });

  // Send confirmation to requester
  const mergeData = buildEventMergeData(
    {
      id: request.id,
      title: data.description,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      startDateTime: startDt,
      endDateTime: endDt,
    },
    org,
    ""
  );

  await sendTemplatedEmail({
    to: data.contactEmail,
    orgId: org.id,
    templateSlug: "space-request-submitted",
    mergeData,
    replyTo: org.emailReplyToAddress || undefined,
  });

  // Notify room assignment approver(s)
  const approverIds: string[] = [];
  if (org.roomAssignmentApproverId) {
    approverIds.push(org.roomAssignmentApproverId);

    // Add backup approvers
    const backups = await prisma.backupApprover.findMany({
      where: {
        organizationId: org.id,
        approverId: org.roomAssignmentApproverId,
      },
      orderBy: { sortOrder: "asc" },
    });
    for (const b of backups) approverIds.push(b.backupUserId);
  }

  // Fallback to all ADMIN/MANAGER
  if (approverIds.length === 0) {
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: org.id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
    });
    approverIds.push(...members.map((m) => m.userId));
  }

  const approverUsers = await prisma.user.findMany({
    where: { id: { in: approverIds }, active: true },
  });

  for (const user of approverUsers) {
    if (!user.email) continue;
    await sendTemplatedEmail({
      to: user.email,
      orgId: org.id,
      templateSlug: "approval-required",
      mergeData: {
        ...mergeData,
        approvalLink: `${process.env.NEXTAUTH_URL || ""}/${org.slug}/admin/space-requests`,
      },
      replyTo: org.emailReplyToAddress || undefined,
    });
  }

  revalidatePath(`/${org.slug}/admin/space-requests`);

  return { success: true, requestId: request.id };
}

export async function approveRoomRequest(
  requestId: string,
  orgSlug: string,
  roomId?: string,
  comment?: string
) {
  const request = await prisma.roomRequest.findUnique({
    where: { id: requestId },
    include: { organization: true },
  });
  if (!request) return { error: "Request not found" };

  const { user } = await requireOrgRole(request.organizationId, ["ADMIN", "MANAGER"]);
  if (request.status === "APPROVED") return { success: true }; // idempotent

  // EWL: cannot approve already-denied requests
  if (request.status === "DENIED") {
    return { error: "This request has been denied. Please ask the requester to submit a new request." };
  }

  // Create an event from the request (atomically with status update)
  // Validate room belongs to this organization (prevent cross-org linkage)
  const room = roomId
    ? await prisma.room.findFirst({ where: { id: roomId, organizationId: request.organizationId } })
    : null;

  if (roomId && !room) return { error: "Room not found" };

  // EWL: room must be active
  if (room && !room.active) {
    return { error: `${room.name} is no longer available for booking.` };
  }

  // Conflict detection before creating event
  if (roomId && request.requestedStartDateTime && request.requestedEndDateTime) {
    const conflictResult = await detectConflicts({
      orgId: request.organizationId,
      roomId,
      startDateTime: request.requestedStartDateTime,
      endDateTime: request.requestedEndDateTime,
      timezone: request.organization.timezone,
    });
    if (conflictResult.hasConflict) {
      return {
        error: conflictResult.conflicts.map((c) => c.message).join("\n"),
        conflicts: conflictResult.conflicts,
        alternatives: conflictResult.alternatives,
      };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let createdEventId: string | undefined;

    if (roomId && room && request.requestedStartDateTime && request.requestedEndDateTime) {
      const event = await tx.event.create({
        data: {
          organizationId: request.organizationId,
          roomId,
          title: request.description,
          contactName: request.contactName,
          contactEmail: request.contactEmail,
          contactPhone: request.contactPhone,
          expectedAttendeeCount: request.expectedAttendeeCount,
          startDateTime: request.requestedStartDateTime,
          endDateTime: request.requestedEndDateTime,
          status: "APPROVED",
          approved: true,
        },
      });
      createdEventId = event.id;
    }

    await tx.roomRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        processedAt: new Date(),
        processedByUserId: user.id,
        ...(createdEventId ? { createdEventId } : {}),
      },
    });

    return { createdEventId };
  });

  const createdEventId = result.createdEventId;

  // Send approval email
  const mergeData = buildEventMergeData(
    {
      id: createdEventId || requestId,
      title: request.description,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
      startDateTime: request.requestedStartDateTime,
      endDateTime: request.requestedEndDateTime,
    },
    request.organization,
    room?.name || ""
  );

  await sendTemplatedEmail({
    to: request.contactEmail,
    orgId: request.organizationId,
    templateSlug: "space-request-approved",
    mergeData,
    replyTo: request.organization.emailReplyToAddress || undefined,
  });

  revalidatePath(`/${orgSlug}/admin/space-requests`);
  revalidatePath(`/${orgSlug}`);

  return { success: true };
}

export async function denyRoomRequest(
  requestId: string,
  orgSlug: string,
  reason?: string
) {
  const request = await prisma.roomRequest.findUnique({
    where: { id: requestId },
    include: { organization: true },
  });
  if (!request) return { error: "Request not found" };

  const { user } = await requireOrgRole(request.organizationId, ["ADMIN", "MANAGER"]);
  if (request.status === "DENIED") return { success: true }; // idempotent

  // EWL: cannot deny already-processed requests (DenySpaceRequest.cs line 17-18)
  if (request.status === "APPROVED") {
    return { error: "This request has already been approved and cannot be denied." };
  }

  await prisma.roomRequest.update({
    where: { id: requestId },
    data: {
      status: "DENIED",
      processedAt: new Date(),
      processedByUserId: user.id,
      denialReason: reason || "",
    },
  });

  // Send denial email
  const mergeData = buildEventMergeData(
    {
      id: requestId,
      title: request.description,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
      startDateTime: request.requestedStartDateTime,
      endDateTime: request.requestedEndDateTime,
    },
    request.organization,
    ""
  );
  mergeData.denialComment = reason || "";

  await sendTemplatedEmail({
    to: request.contactEmail,
    orgId: request.organizationId,
    templateSlug: "space-request-denied",
    mergeData,
    replyTo: request.organization.emailReplyToAddress || undefined,
  });

  revalidatePath(`/${orgSlug}/admin/space-requests`);

  return { success: true };
}
