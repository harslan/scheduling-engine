"use server";

import { requireOrgRole } from "@/lib/session";
import { executeSpaceRun } from "@/lib/space-run";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RunSchema = z.object({
  organizationId: z.string().min(1),
  semester: z.string().min(1),
});

export async function runSpaceAllocation(formData: FormData) {
  const parsed = RunSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { organizationId, semester } = parsed.data;
  await requireOrgRole(organizationId, ["ADMIN", "MANAGER"]);

  const run = await executeSpaceRun(organizationId, semester);
  revalidatePath("/[orgSlug]/admin/space", "page");
  revalidatePath("/[orgSlug]/my-space", "page");
  return {
    success: true,
    status: run.status,
    needed: run.needed,
    usable: run.usable,
  };
}
