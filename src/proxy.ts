import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths that require authentication (relative to /{orgSlug}/)
const PROTECTED_PATHS = ["/admin", "/my-events", "/chat"];

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Always allow these routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/calendar") ||
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/events/export") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Check if this is a protected org path
  // Org paths look like /{orgSlug}/admin/*, /{orgSlug}/my-events, etc.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const orgSubPath = "/" + segments.slice(1).join("/");
    const isProtected = PROTECTED_PATHS.some(
      (p) => orgSubPath === p || orgSubPath.startsWith(p + "/")
    );

    if (isProtected && !token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Pass current pathname to server components via header
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
