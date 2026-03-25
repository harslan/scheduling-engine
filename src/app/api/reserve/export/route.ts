import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportEventsToReserve } from "@/lib/reserve/export";

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all orgs with Reserve export enabled
  const orgs = await prisma.organization.findMany({
    where: {
      reserveEnabled: true,
      reserveExportEnabled: true,
    },
    select: { id: true, slug: true },
  });

  const results = [];
  for (const org of orgs) {
    const result = await exportEventsToReserve(org.id);
    results.push({ orgSlug: org.slug, ...result });
  }

  return NextResponse.json({ results });
}
