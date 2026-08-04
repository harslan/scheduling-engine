"use server";

import { prisma } from "@/lib/prisma";
import { getOrgMembership } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * The semester declaration (charter 2.2): shapes scheduling, pairing, and
 * adjacency — NEVER entitlement. Entitlement comes from measured presence
 * (the registrar), which is deliberately not writable here. That is why this
 * action stores preferences and expected days, and nothing it stores can win
 * or lose anyone an office.
 */

const DAY_TOKENS = ["M", "T", "W", "TH", "F"] as const;

const SaveDeclarationSchema = z.object({
  organizationId: z.string().min(1),
  semester: z.string().min(1),
  days: z.string(), // comma-joined subset of DAY_TOKENS ("" allowed)
  partnerPrefUserId: z.string().optional(),
  wantsDedicated: z.string().optional(), // checkbox: "on" | undefined
  notes: z.string().max(500).optional(),
});

export async function saveDeclaration(formData: FormData) {
  const parsed = SaveDeclarationSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;

  const dayList = data.days
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const d of dayList) {
    if (!DAY_TOKENS.includes(d as (typeof DAY_TOKENS)[number])) {
      return { error: `Unknown day token: ${d}` }; // fail loudly, never drop
    }
  }

  const { user, membership } = await getOrgMembership(data.organizationId);
  if (!membership) {
    return { error: "You are not a member of this organization." };
  }

  if (data.partnerPrefUserId) {
    const partner = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: data.partnerPrefUserId,
        },
      },
    });
    if (!partner || data.partnerPrefUserId === user.id) {
      return { error: "Partner preference must be another member." };
    }
  }

  await prisma.declaration.upsert({
    where: {
      organizationId_userId_semester: {
        organizationId: data.organizationId,
        userId: user.id,
        semester: data.semester,
      },
    },
    update: {
      days: dayList.join(","),
      partnerPrefUserId: data.partnerPrefUserId || null,
      wantsDedicated: data.wantsDedicated === "on",
      notes: data.notes || "",
    },
    create: {
      organizationId: data.organizationId,
      userId: user.id,
      semester: data.semester,
      days: dayList.join(","),
      partnerPrefUserId: data.partnerPrefUserId || null,
      wantsDedicated: data.wantsDedicated === "on",
      notes: data.notes || "",
    },
  });

  revalidatePath("/[orgSlug]/declare", "page");
  return { success: true };
}
