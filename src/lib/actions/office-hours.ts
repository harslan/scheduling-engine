"use server";

import { prisma } from "@/lib/prisma";
import { getOrgMembership } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Office hours (charter 2.2, the SERVICE facet): the one input the registrar
 * feed can never see — occupancy lists it first under NOT MODELED. Like a
 * Declaration this stores preference/service and can NEVER win or lose anyone an
 * office; unlike a Declaration it is student-facing, so two consent dials stay
 * with the faculty member: `publish` (appear on the student map at all) and
 * `live` (broadcast "in right now" with the room). A blank row means nothing,
 * not "unknown": empty rows never reach the store, and a malformed one fails
 * LOUD rather than being silently dropped.
 */

const DAY_TOKENS = ["M", "T", "W", "TH", "F"] as const;
const MODES = ["in-person", "virtual"] as const;

const BlockSchema = z.object({
  day: z.enum(DAY_TOKENS),
  start: z.string().regex(/^\d{1,2}:\d{2}$/, "time must be HH:MM"),
  end: z.string().regex(/^\d{1,2}:\d{2}$/, "time must be HH:MM"),
  roomSlug: z.string().max(120).optional().default(""),
  mode: z.enum(MODES).optional().default("in-person"),
});

const SaveSchema = z.object({
  organizationId: z.string().min(1),
  semester: z.string().min(1),
  publish: z.string().optional(), // checkbox: "on" | undefined
  live: z.string().optional(),
  note: z.string().max(300).optional(),
  blocksJson: z.string(),
});

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function saveOfficeHours(formData: FormData) {
  const parsed = SaveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;

  let raw: unknown;
  try {
    raw = JSON.parse(data.blocksJson);
  } catch {
    return { error: "Could not read the office-hours blocks." };
  }
  if (!Array.isArray(raw)) return { error: "Office-hours blocks must be a list." };

  const blocks: {
    day: string;
    startMin: number;
    endMin: number;
    roomSlug: string;
    mode: string;
  }[] = [];
  for (const b of raw) {
    const pb = BlockSchema.safeParse(b);
    if (!pb.success) {
      // fail loud — a garbled block is a bug to surface, not a row to drop
      return { error: `A block is invalid: ${pb.error.issues.map((i) => i.message).join(", ")}` };
    }
    const startMin = toMin(pb.data.start);
    const endMin = toMin(pb.data.end);
    if (endMin <= startMin) {
      return { error: `${pb.data.day} ${pb.data.start}–${pb.data.end}: end must be after start.` };
    }
    blocks.push({
      day: pb.data.day,
      startMin,
      endMin,
      roomSlug: pb.data.roomSlug.trim(),
      mode: pb.data.mode,
    });
  }

  const { user, membership } = await getOrgMembership(data.organizationId);
  if (!membership) {
    return { error: "You are not a member of this organization." };
  }

  await prisma.$transaction(async (tx) => {
    const oh = await tx.officeHours.upsert({
      where: {
        organizationId_userId_semester: {
          organizationId: data.organizationId,
          userId: user.id,
          semester: data.semester,
        },
      },
      update: {
        publish: data.publish === "on",
        live: data.live === "on",
        note: data.note || "",
      },
      create: {
        organizationId: data.organizationId,
        userId: user.id,
        semester: data.semester,
        publish: data.publish === "on",
        live: data.live === "on",
        note: data.note || "",
      },
    });
    // Blocks are declared as a whole each save — replace, never merge, so a
    // removed row actually disappears.
    await tx.officeHourBlock.deleteMany({ where: { officeHoursId: oh.id } });
    if (blocks.length) {
      await tx.officeHourBlock.createMany({
        data: blocks.map((b) => ({ ...b, officeHoursId: oh.id })),
      });
    }
  });

  revalidatePath("/[orgSlug]/office-hours", "page");
  return { success: true };
}
