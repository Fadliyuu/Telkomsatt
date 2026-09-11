import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/constants/storageKeys";
import { adminAuth } from "@/lib/server/firebaseAdmin";
import { rateLimit, getClientIp } from "@/lib/server/rateLimiter";

/** 5-day session (seconds) */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

function cookieOptions() {
  return {
    httpOnly: true,
    // Use strict in production; lax in development (cross-origin dev servers)
    sameSite: (process.env.NODE_ENV === "production" ? "strict" : "lax") as "strict" | "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * GET /api/auth/session
 * Verifies the current session cookie cryptographically.
 */
export async function GET(request: NextRequest) {
  const session = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!session) {
    return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
  }

  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    return NextResponse.json({ success: true, authenticated: true, uid: decoded.uid });
  } catch {
    // Cookie is invalid or expired — clear it
    const response = NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    response.cookies.set(AUTH_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  }
}

/**
 * POST /api/auth/session
 * Exchanges a Firebase ID token for a server-side session cookie.
 *
 * Rate limited: 10 requests per minute per IP to prevent brute-force.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per minute per IP
  const rl = rateLimit(`session:${getClientIp(request)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Terlalu banyak percobaan login. Coba lagi nanti." },
      { status: 429 }
    );
  }

  let idToken: string | undefined;
  try {
    const body = (await request.json()) as { idToken?: string };
    idToken = body?.idToken;
  } catch {
    return NextResponse.json({ success: false, error: "Body JSON tidak valid" }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ success: false, error: "idToken wajib diisi" }, { status: 400 });
  }

  try {
    const expiresIn = SESSION_MAX_AGE_SECONDS * 1000;
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_SESSION_COOKIE, sessionCookie, {
      ...cookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    // Do not leak Firebase error details to the client
    return NextResponse.json({ success: false, error: "Token tidak valid atau sudah kedaluwarsa" }, { status: 401 });
  }
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie (logout).
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
