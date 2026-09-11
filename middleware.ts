import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/constants/storageKeys";

/**
 * Next.js Middleware — UX Redirect Gate
 *
 * ⚠️  IMPORTANT: This middleware is a UX convenience layer only.
 *     It redirects unauthenticated users away from protected pages so they
 *     don't see a blank / error screen.
 *
 *     It is NOT a security boundary because:
 *     1. Next.js Edge Runtime cannot run Firebase Admin SDK for real crypto
 *        verification of session cookies.
 *     2. Cookies can be tampered with client-side.
 *
 *     Real security is enforced by:
 *     ✅  Firebase Admin SDK in every API route (verifyIdToken / verifySessionCookie)
 *     ✅  Firestore Security Rules at the database level
 *
 *     Never skip the API-level token verification assuming middleware covers it.
 */

/** Paths that are always publicly accessible (no login required). */
const PUBLIC_PREFIXES = ["/login", "/api/auth/session"];
const PUBLIC_PATHS = ["/", "/firebase-messaging-sw.js", "/manifest.webmanifest"];

/** Protect against open-redirect attacks on the `next` parameter. */
function sanitizeRedirectPath(next: string | null): string {
  if (!next) return "/";
  try {
    // Only allow relative paths — reject anything with a protocol or host
    const decoded = decodeURIComponent(next);
    if (decoded.startsWith("//") || decoded.includes(":")) return "/";
    return decoded.startsWith("/") ? decoded : "/";
  } catch {
    return "/";
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Allow static assets ──────────────────────────────────────────────────
  // Files with an extension handled by /_next/static are excluded via `matcher`
  // below, but some top-level assets (logos, icons) need an explicit pass-through.
  if (pathname.startsWith("/logo") || pathname.startsWith("/icons")) {
    return NextResponse.next();
  }

  // ── Public routes ────────────────────────────────────────────────────────
  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // ── Check session cookie presence ────────────────────────────────────────
  // We only check that the cookie exists and has a plausible JWT shape.
  // Cryptographic verification happens inside each API route handler.
  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? "";
  const hasPotentialSessionCookie =
    sessionCookie.length > 50 && sessionCookie.split(".").length === 3;

  // ── API routes ───────────────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    if (!hasPotentialSessionCookie) {
      // Check Bearer token as fallback for non-browser clients
      const authHeader = request.headers.get("authorization") ?? "";
      const hasBearer = authHeader.startsWith("Bearer ") && authHeader.length > 20;
      if (!hasBearer) {
        return NextResponse.json(
          { success: false, error: "Otorisasi diperlukan" },
          { status: 401 }
        );
      }
    }
    return NextResponse.next();
  }

  // ── Page routes ──────────────────────────────────────────────────────────
  if (!hasPotentialSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    // Sanitize `next` to prevent open-redirect
    loginUrl.searchParams.set(
      "next",
      sanitizeRedirectPath(pathname + request.nextUrl.search)
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
