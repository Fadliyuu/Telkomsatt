import { adminAuth } from "@/lib/server/firebaseAdmin";

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

export async function verifyFirebaseIdToken(
  idToken: string
): Promise<VerifiedFirebaseUser | null> {
  if (!idToken) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/** Folder upload yang diizinkan tanpa login (teknisi tamu). */
export const GUEST_UPLOAD_FOLDER_PREFIXES = [
  "guest",
  "transaksi-guest",
  "inventaris-sparepart/guest",
] as const;

export function isGuestUploadFolder(folder: string): boolean {
  const normalized = folder.replace(/^\/+/, "");
  return GUEST_UPLOAD_FOLDER_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}
