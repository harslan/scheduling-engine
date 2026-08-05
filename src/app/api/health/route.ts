import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Liveness + DB reachability for uptime monitors. Public by design (also
 *  allowlisted in the pilot lockdown) — returns no data beyond status. */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", latencyMs: Date.now() - startedAt },
      { status: 503 },
    );
  }
}
