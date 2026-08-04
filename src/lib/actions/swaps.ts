"use server";

import { getOrgMembership } from "@/lib/session";
import { proposeSwap, actOnSwap } from "@/lib/swap-service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProposeSchema = z.object({
  organizationId: z.string().min(1),
  semester: z.string().min(1),
  targetUserId: z.string().min(1),
});

export async function proposeSwapAction(formData: FormData) {
  const parsed = ProposeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success)
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  const { organizationId, semester, targetUserId } = parsed.data;
  const { user, membership } = await getOrgMembership(organizationId);
  if (!membership) return { error: "Not a member of this organization." };
  const result = await proposeSwap(organizationId, semester, user.id, targetUserId);
  revalidatePath("/[orgSlug]/my-space", "page");
  return result;
}

const ActSchema = z.object({
  organizationId: z.string().min(1),
  swapId: z.string().min(1),
  decision: z.enum(["consent", "decline"]),
});

export async function actOnSwapAction(formData: FormData) {
  const parsed = ActSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success)
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  const { organizationId, swapId, decision } = parsed.data;
  const { user, membership } = await getOrgMembership(organizationId);
  if (!membership) return { error: "Not a member of this organization." };
  const result = await actOnSwap(swapId, user.id, decision);
  revalidatePath("/[orgSlug]/my-space", "page");
  return result;
}
