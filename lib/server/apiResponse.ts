/**
 * Standardised API response helpers.
 *
 * All API routes should use these helpers so the response envelope is
 * consistent across the entire application.
 *
 * Success shape  : { success: true, data?: T }
 * Created shape  : { success: true, id: string }
 * Error shape    : { success: false, error: string }
 */

import { NextResponse } from "next/server";

/** 200 OK with optional data payload. */
export function successResponse<T>(data?: T, status = 200) {
  return NextResponse.json({ success: true, ...(data !== undefined ? { data } : {}) }, { status });
}

/** 201 Created with the new resource's ID. */
export function createdResponse(id: string) {
  return NextResponse.json({ success: true, id }, { status: 201 });
}

/**
 * Error response.
 *
 * IMPORTANT: Never pass raw Firebase / internal error messages as `message`
 * when the status is 5xx. Use a generic fallback instead to avoid leaking
 * implementation details to the client.
 */
export function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** 401 Unauthorized */
export const unauthorizedResponse = () => errorResponse("Login diperlukan", 401);

/** 403 Forbidden */
export const forbiddenResponse = () => errorResponse("Akses ditolak", 403);

/** 400 Bad Request */
export const badRequestResponse = (message: string) => errorResponse(message, 400);

/** 429 Too Many Requests */
export const tooManyRequestsResponse = () =>
  errorResponse("Terlalu banyak permintaan. Coba lagi nanti.", 429);

/** 500 Internal Server Error — always uses a safe generic message in production. */
export function serverErrorResponse(error: unknown, devMessage?: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const message =
    isDev && devMessage
      ? devMessage
      : isDev && error instanceof Error
      ? error.message
      : "Terjadi kesalahan server. Silakan coba lagi.";
  return errorResponse(message, 500);
}
