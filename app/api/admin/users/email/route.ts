import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { canManageUsers } from "@/lib/server/validators";
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/apiResponse";

export async function PATCH(request: NextRequest) {
  try {
    const header = request.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return forbiddenResponse();
    const actor = await adminAuth().verifyIdToken(token, true);
    const actorData = (await adminDb().collection("users").doc(actor.uid).get()).data();
    if (!canManageUsers(actorData?.role as never) || actorData?.status !== "aktif") {
      return forbiddenResponse();
    }

    const body = await request.json();
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!uid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequestResponse("UID atau alamat email tidak valid");
    }

    const target = await adminAuth().getUser(uid);
    const previousEmail = target.email;
    if (previousEmail?.toLowerCase() === email) return successResponse();

    await adminAuth().updateUser(uid, { email });
    try {
      await adminDb().collection("users").doc(uid).update({
        email,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if (previousEmail) await adminAuth().updateUser(uid, { email: previousEmail });
      throw error;
    }
    return successResponse();
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "auth/email-already-exists") {
      return badRequestResponse("Email sudah digunakan oleh akun lain");
    }
    return serverErrorResponse(error, "Gagal mengganti email pengguna");
  }
}
