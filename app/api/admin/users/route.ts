import { NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { ValidationError, canManageUsers, validateUserCreatePayload } from "@/lib/server/validators";
import {
  badRequestResponse,
  createdResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from "@/lib/server/apiResponse";
import { rateLimit, getClientIp } from "@/lib/server/rateLimiter";

/**
 * Verifies that the request is from a manager or admin with "aktif" status.
 * Returns the decoded token if authorized, null otherwise.
 */
async function requireUserManager(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    const userSnap = await adminDb().collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role as string | undefined;
    const status = userSnap.data()?.status as string | undefined;

    if (!canManageUsers(role as never) || status !== "aktif") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/** Password administration is intentionally restricted to Admin Sistem only. */
async function requireSystemAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    const userSnap = await adminDb().collection("users").doc(decoded.uid).get();
    const data = userSnap.data();
    if (data?.role !== "admin" || data?.status !== "aktif") return null;
    return decoded;
  } catch {
    return null;
  }
}

function toAdminTimestamp(value?: string) {
  return value ? Timestamp.fromDate(new Date(value)) : null;
}

export async function POST(request: NextRequest) {
  // Rate limit: 20 user creations per hour per IP
  const rl = rateLimit(getClientIp(request), { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const actor = await requireUserManager(request);
    if (!actor) {
      return forbiddenResponse();
    }

    let payload: ReturnType<typeof validateUserCreatePayload>;
    try {
      payload = validateUserCreatePayload(await request.json());
    } catch (e) {
      const msg = e instanceof ValidationError ? e.message : "Payload tidak valid";
      return badRequestResponse(msg);
    }

    const authUser = await adminAuth().createUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.nama,
      disabled: payload.status === "nonaktif",
    });

    try {
      await adminDb()
        .collection("users")
        .doc(authUser.uid)
        .set({
          nama: payload.nama,
          email: payload.email,
          role: payload.role,
          status: payload.status,
          jabatan: payload.jabatan || "",
          nomorHP: payload.nomorHP || "",
          alamat: payload.alamat || "",
          divisi: payload.divisi || "",
          fotoProfilUrl: payload.fotoProfilUrl || "",
          fotoProfilPublicId: payload.fotoProfilPublicId || "",
          tanggalMulai: toAdminTimestamp(payload.tanggalMulai),
          tanggalSelesai: toAdminTimestamp(payload.tanggalSelesai),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
      // Rollback Firebase Auth user if Firestore write fails
      await adminAuth().deleteUser(authUser.uid).catch(() => undefined);
      throw error;
    }

    return createdResponse(authUser.uid);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return badRequestResponse(error.message);
    }
    return serverErrorResponse(error, "Gagal membuat user");
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limit: 10 deletions per hour per IP
  const rl = rateLimit(getClientIp(request), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const actor = await requireUserManager(request);
    if (!actor) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) {
      return badRequestResponse("uid wajib diisi");
    }

    // Prevent self-deletion
    if (uid === actor.uid) {
      return badRequestResponse("Tidak dapat menghapus akun sendiri");
    }

    // Soft delete: disable in Firebase Auth + mark deletedAt in Firestore.
    // This preserves audit trail (transactions, reports) while preventing login.
    // If you need hard delete, do it from the server SDK directly — never expose to client.
    await adminAuth().updateUser(uid, { disabled: true });
    await adminDb()
      .collection("users")
      .doc(uid)
      .update({
        status: "nonaktif",
        deletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return successResponse();
  } catch (error: unknown) {
    return serverErrorResponse(error, "Gagal menonaktifkan user");
  }
}

/**
 * Restore a soft-deleted user (re-enable Firebase Auth + set status "aktif").
 */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireUserManager(request);
    if (!actor) {
      return forbiddenResponse();
    }

    const { uid } = (await request.json()) as { uid?: string };
    if (!uid) {
      return badRequestResponse("uid wajib diisi");
    }

    await adminAuth().updateUser(uid, { disabled: false });
    await adminDb()
      .collection("users")
      .doc(uid)
      .update({
        status: "aktif",
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return successResponse();
  } catch (error: unknown) {
    return serverErrorResponse(error, "Gagal memulihkan user");
  }
}

/** Set or reset a user's password. Admin Sistem only. */
export async function PUT(request: NextRequest) {
  const rl = rateLimit(`password:${getClientIp(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const actor = await requireSystemAdmin(request);
    if (!actor) return forbiddenResponse();

    const body = (await request.json()) as { uid?: unknown; password?: unknown };
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!uid) return badRequestResponse("uid wajib diisi");
    if (password.length < 6 || password.length > 128) {
      return badRequestResponse("Password harus terdiri dari 6–128 karakter");
    }

    await adminAuth().updateUser(uid, { password });
    await adminAuth().revokeRefreshTokens(uid);
    await adminDb().collection("users").doc(uid).update({
      passwordUpdatedAt: FieldValue.serverTimestamp(),
      passwordUpdatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse();
  } catch (error: unknown) {
    return serverErrorResponse(error, "Gagal mengganti password pengguna");
  }
}

/** HEAD — not authorised (prevents enumeration) */
export async function GET() {
  return unauthorizedResponse();
}
