import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ImportReviewClient } from "./import-review-client";

export const revalidate = 0;

export default async function ReserveImportPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      reserveEnabled: true,
      reserveImportMode: true,
    },
  });
  if (!org || !org.reserveEnabled) notFound();

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Reserve Import Review
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Preview and apply event imports from Reserve Interactive
        </p>
      </div>

      <ImportReviewClient orgId={org.id} orgSlug={orgSlug} />
    </div>
  );
}
