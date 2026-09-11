import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "./config";
import { COLLECTIONS } from "./collections";
import { UserRole } from "@/types";

export type AuditActionType =
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "SPAREPART_ADD"
  | "SPAREPART_UPDATE"
  | "TRANSACTION_REQUEST"
  | "TRANSACTION_APPROVE"
  | "TRANSACTION_REJECT"
  | "LOCATION_CHANGE"
  | "USER_UPDATE";

export interface AuditLogItem {
  id?: string;
  action: AuditActionType;
  actorUid?: string;
  actorName: string;
  actorRole: UserRole;
  description: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const logActivity = async (
  item: Omit<AuditLogItem, "id" | "createdAt" | "actorUid"> & { actorUid?: string }
): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    // Prefer authenticated Firebase UID over client parameter to prevent spoofing
    const actorUid = currentUser?.uid || item.actorUid || "system";
    await addDoc(collection(db, COLLECTIONS.AKTIVITAS), {
      ...item,
      actorUid,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.warn("[logActivity] Gagal mencatat audit activity:", error);
  }
};

export const getActivities = async (maxLimit = 100): Promise<AuditLogItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.AKTIVITAS),
      orderBy("createdAt", "desc"),
      limit(maxLimit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        action: data.action,
        actorUid: data.actorUid,
        actorName: data.actorName || "Sistem",
        actorRole: data.actorRole || "admin",
        description: data.description || "",
        targetId: data.targetId,
        metadata: data.metadata,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });
  } catch (error) {
    console.error("[getActivities] Error fetching activities:", error);
    return [];
  }
};
