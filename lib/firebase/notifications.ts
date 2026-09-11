import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "./config";
import { COLLECTIONS } from "./collections";
import { AppNotification, User, UserRole } from "@/types";
import { USER_ROLE_LABELS } from "@/types";
import { getAccessiblePath } from "@/lib/rbac";

export const SYSTEM_NOTIFICATION_ROLES: UserRole[] = [
  "direktur",
  "manager",
  "supervisor",
  "admin_gudang",
  "admin_keuangan",
];

export type NotificationActor = {
  name?: string;
  role?: UserRole;
};

export function formatNotificationActor(actor?: NotificationActor) {
  if (!actor?.name) return "User";
  return `${actor.name}${actor.role ? ` (${USER_ROLE_LABELS[actor.role]})` : ""}`;
}

export async function createNotification(data: Omit<AppNotification, "id" | "createdAt">) {
  const user = auth.currentUser;
  if (!user) throw new Error("Silakan login kembali");
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Gagal mengirim notifikasi");
}

export async function createSystemNotification(
  data: Omit<AppNotification, "id" | "createdAt" | "targetRoles" | "type"> & {
    targetRoles?: UserRole[];
    type?: AppNotification["type"];
  }
) {
  try {
    await createNotification({
      ...data,
      targetRoles: data.targetRoles || SYSTEM_NOTIFICATION_ROLES,
      type: data.type || "system",
    });
  } catch (error) {
    console.warn("Could not create system notification:", error);
  }
}

export async function getNotificationsForUser(user: User): Promise<AppNotification[]> {
  return getActivitiesForUser(user, 20);
}

export async function getActivitiesForUser(
  user: User,
  maxRows = 100
): Promise<AppNotification[]> {
  const byRoleQuery = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where("targetRoles", "array-contains", user.role)
  );
  const byUidQuery = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where("targetUids", "array-contains", user.id)
  );
  const [roleResult, uidResult] = await Promise.all([
    getDocs(byRoleQuery),
    getDocs(byUidQuery),
  ]);

  const roleDocs = roleResult.docs;
  const uidDocs = uidResult.docs;

  const docs = new Map(
    [...roleDocs, ...uidDocs].map((docSnap) => [
      docSnap.id,
      docSnap,
    ])
  );

  return [...docs.values()]
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        link: getAccessiblePath(user.role, data.link),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as AppNotification;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, maxRows);
}

function mapNotificationDoc(
  docSnap: QueryDocumentSnapshot<DocumentData>
): AppNotification {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || new Date(),
  } as AppNotification;
}

export function subscribeNotificationsForUser(
  user: User,
  onChange: (rows: AppNotification[]) => void,
  onError?: (error: unknown) => void
) {
  const rows = new Map<string, AppNotification>();
  const emit = () => {
    onChange(
      [...rows.values()]
        .map((row) => ({ ...row, link: getAccessiblePath(user.role, row.link) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20)
    );
  };

  const roleQuery = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where("targetRoles", "array-contains", user.role)
  );
  const uidQuery = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where("targetUids", "array-contains", user.id)
  );

  const unsubscribeRole = onSnapshot(
    roleQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") rows.delete(change.doc.id);
        else rows.set(change.doc.id, mapNotificationDoc(change.doc));
      });
      emit();
    },
    onError
  );

  const unsubscribeUid = onSnapshot(
    uidQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") rows.delete(change.doc.id);
        else rows.set(change.doc.id, mapNotificationDoc(change.doc));
      });
      emit();
    },
    onError
  );

  return () => {
    unsubscribeRole();
    unsubscribeUid();
  };
}

export async function markNotificationRead(notification: AppNotification, userId: string) {
  await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notification.id), {
    readBy: arrayUnion(userId),
  });
}

export const APPROVER_ROLES: UserRole[] = [
  "admin_gudang",
  "supervisor",
  "manager",
];
