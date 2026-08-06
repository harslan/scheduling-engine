"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { updateCharter, ratifyCharter, type CharterPatch } from "@/lib/charter-service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateSchema = z.object({
  organizationId: z.string().min(1),
  thresholdDays: z.coerce.number().int().min(1).max(5),
  reservedOffices: z.coerce.number().int().min(0),
  reservedRoomSlugs: z.string().optional(),
  slackFraction: z.string().optional(), // "" = UNDECIDED
  adjunctsInScope: z.enum(["undecided", "true", "false"]),
  minSf: z.coerce.number().int().min(0),
  privateRoomSlugs: z.string().optional(),
  reason: z.string().optional(),
});

export async function updateCharterAction(formData: FormData) {
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success)
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const { user } = await requireOrgRole(d.organizationId, ["ADMIN"]);

  // Dials that break the math get refused, not logged: a slack outside [0,1]
  // or NaN makes usable negative/NaN and unplaces everyone silently.
  let slackFraction: number | null = null;
  if (d.slackFraction !== undefined && d.slackFraction.trim() !== "") {
    const n = Number(d.slackFraction);
    if (!Number.isFinite(n) || n < 0 || n > 1)
      return { error: "Slack reserve must be a number between 0 and 1, or blank for UNDECIDED." };
    slackFraction = n;
  }
  const activeRooms = await prisma.room.findMany({
    where: { organizationId: d.organizationId, active: true },
    select: { slug: true },
  });
  if (d.reservedOffices > activeRooms.length)
    return { error: `Reserved offices (${d.reservedOffices}) cannot exceed the ${activeRooms.length} rooms on record.` };

  // Named reserved rooms (6.2) must be real rooms and not private rooms (7.2)
  const reservedRoomSlugs = (d.reservedRoomSlugs ?? "")
    .split(",").map((x) => x.trim()).filter(Boolean);
  const known = new Set(activeRooms.map((r) => r.slug));
  const privates = new Set((d.privateRoomSlugs ?? "").split(",").map((x) => x.trim()));
  for (const slug of reservedRoomSlugs) {
    if (!known.has(slug))
      return { error: `Reserved room "${slug}" is not an active room on record.` };
    if (privates.has(slug))
      return { error: `Room "${slug}" is a private room (7.2) — it cannot also be reserved (6.2).` };
  }
  if (reservedRoomSlugs.length > d.reservedOffices)
    return { error: `${reservedRoomSlugs.length} rooms are named but the reserved count is ${d.reservedOffices} — raise the count or name fewer rooms.` };

  const patch: CharterPatch = {
    thresholdDays: d.thresholdDays,
    reservedOffices: d.reservedOffices,
    reservedRoomSlugs: reservedRoomSlugs.join(","),
    slackFraction,
    adjunctsInScope:
      d.adjunctsInScope === "undecided" ? null : d.adjunctsInScope === "true",
    minSf: d.minSf,
    privateRoomSlugs: d.privateRoomSlugs ?? "",
  };
  const result = await updateCharter(d.organizationId, user.id, patch, d.reason ?? "");
  revalidatePath("/[orgSlug]/admin/space/charter", "page");
  revalidatePath("/[orgSlug]/admin/space", "page");
  return result;
}

const RatifySchema = z.object({
  organizationId: z.string().min(1),
  ratifiedBy: z.string(),
  ratificationRecord: z.string(),
});

export async function ratifyCharterAction(formData: FormData) {
  const parsed = RatifySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success)
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const { user } = await requireOrgRole(d.organizationId, ["ADMIN"]);

  // The pilot ratifies nothing: ratification belongs to the real faculty
  // vote (10.4), and OFFICIAL runs additionally require connected release
  // records (2.3). Refusing here keeps the login page's promise true —
  // every run in this deployment is a simulation — no matter who clicks.
  if (process.env.PILOT_LOCKDOWN === "1" || process.env.NEXT_PUBLIC_PILOT === "1") {
    return {
      error:
        "This pilot cannot ratify: ratification belongs to the real faculty vote (charter 10.4), and official runs also require the School's release records to be connected (2.3). Every run here remains a simulation — that promise is enforced, not assumed.",
    };
  }
  const result = await ratifyCharter(
    d.organizationId,
    user.id,
    d.ratifiedBy,
    d.ratificationRecord,
  );
  revalidatePath("/[orgSlug]/admin/space/charter", "page");
  revalidatePath("/[orgSlug]/admin/space", "page");
  return result;
}
