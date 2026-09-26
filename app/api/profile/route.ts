import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import {
  badRequestResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from "@/lib/server/apiResponse";
import { rateLimit, getClientIp } from "@/lib/server/rateLimiter";

const ALLOWED_PROFILE_SIZES = new Set(["sm", "md", "lg"]);
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

export async function PATCH(request: NextRequest) {
  // Rate limit: 20 profile updates per minute per IP
  const rl = rateLimit(`profile:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return unauthorizedResponse();

    const decoded = await adminAuth().verifyIdToken(token, true);
    const payload = await request.json();
    const updateData: Record<string, unknown> = {};

    const email = cleanString(payload.email)?.toLowerCase();
    if (email !== undefined) {
      if (!EMAIL_PATTERN.test(email)) {
        return badRequestResponse("Format email tidak valid");
      }
      const authTime = decoded.auth_time || 0;
      if (Date.now() / 1000 - authTime > RECENT_AUTH_MAX_AGE_SECONDS) {
        return badRequestResponse("Masukkan password saat ini sebelum mengganti email");
      }
      const existingEmail = await adminDb()
        .collection("users")
        .where("email", "==", email)
        .limit(2)
        .get();
      if (existingEmail.docs.some((profile) => profile.id !== decoded.uid)) {
        return badRequestResponse("Email sudah digunakan");
      }
      await adminAuth().updateUser(decoded.uid, { email });
      updateData.email = email;
    }

    const username = cleanString(payload.username)?.toLowerCase();
    if (username !== undefined) {
      if (!USERNAME_PATTERN.test(username)) {
        return badRequestResponse(
          "Username terdiri dari 2-32 huruf kecil, angka, titik, garis bawah, atau strip"
        );
      }
      const existingUser = await adminDb()
        .collection("users")
        .where("username", "==", username)
        .limit(2)
        .get();
      if (existingUser.docs.some((user) => user.id !== decoded.uid)) {
        return badRequestResponse("Username sudah digunakan");
      }
      updateData.username = username;
    }

    const nama = cleanString(payload.nama);
    if (nama !== undefined) {
      if (nama.length < 2) return badRequestResponse("Nama minimal 2 karakter");
      if (nama.length > 100) return badRequestResponse("Nama maksimal 100 karakter");
      updateData.nama = nama;
    }

    const nomorHP = cleanString(payload.nomorHP);
    if (nomorHP !== undefined) updateData.nomorHP = nomorHP;

    const alamat = cleanString(payload.alamat);
    if (alamat !== undefined) updateData.alamat = alamat;

    const fotoProfilUrl = cleanString(payload.fotoProfilUrl);
    if (fotoProfilUrl !== undefined) updateData.fotoProfilUrl = fotoProfilUrl;

    const fotoProfilPublicId = cleanString(payload.fotoProfilPublicId);
    if (fotoProfilPublicId !== undefined) updateData.fotoProfilPublicId = fotoProfilPublicId;

    const fotoProfilSize = cleanString(payload.fotoProfilSize);
    if (fotoProfilSize !== undefined) {
      if (!ALLOWED_PROFILE_SIZES.has(fotoProfilSize)) {
        return badRequestResponse("Ukuran foto profil tidak valid (gunakan: sm, md, lg)");
      }
      updateData.fotoProfilSize = fotoProfilSize;
    }

    if (Object.keys(updateData).length === 0) {
      return badRequestResponse("Tidak ada data profil yang diubah");
    }

    updateData.updatedAt = FieldValue.serverTimestamp();

    await adminDb().collection("users").doc(decoded.uid).update(updateData);

    return successResponse();
  } catch (error: unknown) {
    return serverErrorResponse(error, "Gagal memperbarui profil");
  }
}
