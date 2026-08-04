"use server";

import { requireOrgRole } from "@/lib/session";
import { updateCharter, ratifyCharter, type CharterPatch } from "@/lib/charter-service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateSchema = z.object({
  organizationId: z.string().min(1),
  thresholdDays: z.coerce.number().int().min(1).max(5),
  reservedOffices: z.coerce.number().int().min(0),
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

  const patch: CharterPatch = {
    thresholdDays: d.thresholdDays,
    reservedOffices: d.reservedOffices,
    slackFraction:
      d.slackFraction === undefined || d.slackFraction.trim() === ""
        ? null
        : Number(d.slackFraction),
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
