import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "./firebaseAdmin";

export async function pushUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const decoded = await adminAuth().verifyIdToken(token, true);
  const profile = await adminDb().collection("users").doc(decoded.uid).get();
  if (profile.data()?.status !== "aktif") throw new Error("UNAUTHORIZED");
  return { uid: decoded.uid, ...profile.data() } as { uid: string; nama: string; role: string };
}
