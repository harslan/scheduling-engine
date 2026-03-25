import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

const VALID_ACTIONS = ["EVENT_CREATED", "EVENT_UPDATED", "EVENT_CANCELLED"];

/**
 * Reserve Interactive webhook receiver.
 * Reserve sends GET requests with query parameters for event notifications.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const url = new URL(request.url);
  const timestamp = url.searchParams.get("timestamp") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const signature = url.searchParams.get("signature") ?? "";
  const action = url.searchParams.get("action") ?? "";
  const uniqueId = url.searchParams.get("uniqueId") ?? "";
  const testMode = url.searchParams.get("testMode") === "true";

  // Validate org exists and has Reserve enabled
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, reserveEnabled: true, reserveWebhookSecret: true },
  });

  if (!org || !org.reserveEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Validate HMAC-SHA256 signature: HMAC(webhookSecret, timestamp + token)
  if (!org.reserveWebhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const expectedSignature = createHmac("sha256", org.reserveWebhookSecret)
    .update(timestamp + token)
    .digest("hex")
    .toLowerCase();

  if (signature.toLowerCase() !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // Test mode - just acknowledge
  if (testMode) {
    return NextResponse.json({ success: true, test: true, timestamp });
  }

  // Queue valid webhook events for processing
  if (VALID_ACTIONS.includes(action) && uniqueId) {
    await prisma.reserveWebhookEvent.create({
      data: {
        organizationId: orgId,
        reserveUniqueId: uniqueId,
        action,
      },
    });
  }

  // Reserve expects the timestamp echoed back
  return NextResponse.json({ timestamp });
}
