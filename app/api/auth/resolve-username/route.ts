import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import {
  badRequestResponse,
  serverErrorResponse,
  unauthorizedResponse,
  successResponse,
  tooManyRequestsResponse,
} from "@/lib/server/apiResponse";
import { getClientIp, rateLimit } from "@/lib/server/rateLimiter";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/;

/**
 * Converts the username used on the login screen to the email Firebase Auth
 * requires. Password verification still occurs exclusively in Firebase Auth.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`username-login:${getClientIp(request)}`, {
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequestsResponse();

  try {
    const body = (await request.json()) as { username?: unknown };
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";

    if (!USERNAME_PATTERN.test(username)) {
      return badRequestResponse("Username atau password salah.");
    }

    const users = await adminDb()
      .collection("users")
      .where("username", "==", username)
      .where("status", "==", "aktif")
      .limit(2)
      .get();

    if (users.size !== 1) return unauthorizedResponse();

    const email = users.docs[0].data().email;
    if (typeof email !== "string" || !email) return unauthorizedResponse();

    return successResponse({ email });
  } catch (error) {
    return serverErrorResponse(error, "Gagal memproses username");
  }
}
