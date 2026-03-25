import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, passwordResetEmail } from "@/lib/email";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !user.active || !user.passwordHash) {
    // Don't reveal whether the email exists
    return NextResponse.json({ success: true });
  }

  // Generate secure random token
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expires,
    },
  });

  // Build reset URL
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const { subject, html } = passwordResetEmail({ resetUrl });
  await sendEmail({ to: user.email, subject, html });

  return NextResponse.json({ success: true });
}
