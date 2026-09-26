import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS } from "./collections";
import { User, UserRole, UserStatus } from "@/types";
import { createSystemNotification } from "./notifications";
import { auth } from "./config";

const USER_MANAGEMENT_NOTIFICATION_ROLES: UserRole[] = ["manager"];

// Get all users
export async function getUsers(): Promise<User[]> {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const q = query(usersRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      tanggalMulai: data.tanggalMulai?.toDate(),
      tanggalSelesai: data.tanggalSelesai?.toDate(),
    } as User;
  });
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  const docRef = doc(db, COLLECTIONS.USERS, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    tanggalMulai: data.tanggalMulai?.toDate(),
    tanggalSelesai: data.tanggalSelesai?.toDate(),
  } as User;
}

// Get users by role
export async function getUsersByRole(role: UserRole): Promise<User[]> {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const q = query(usersRef, where("role", "==", role), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      tanggalMulai: data.tanggalMulai?.toDate(),
      tanggalSelesai: data.tanggalSelesai?.toDate(),
    } as User;
  });
}

// Create new user
export async function createUser(userData: {
  nama: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
  jabatan?: string;
  nomorHP?: string;
  alamat?: string;
  divisi?: string;
  tanggalMulai?: Date;
  tanggalSelesai?: Date;
}): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Login diperlukan");

  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...userData,
      tanggalMulai: userData.tanggalMulai?.toISOString(),
      tanggalSelesai: userData.tanggalSelesai?.toISOString(),
    }),
  });

  const data = (await response.json()) as { id?: string; error?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.error || "Gagal menambah pengguna");
  }

  return data.id;
}

export type UpdateUserPayload = Partial<{
  nama: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  jabatan: string;
  nomorHP: string;
  alamat: string;
  divisi: string;
  fotoProfilUrl: string;
  fotoProfilPublicId: string;
  tanggalMulai: Date;
  tanggalSelesai: Date;
}>;

// Update user
export async function updateUser(
  id: string,
  userData: UpdateUserPayload
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, id);

  const updateData: Partial<Record<keyof UpdateUserPayload | "updatedAt", unknown>> = {
    ...userData,
    updatedAt: Timestamp.now(),
  };

  // Convert dates to Timestamps
  if (userData.tanggalMulai) {
    updateData.tanggalMulai = Timestamp.fromDate(userData.tanggalMulai);
  }
  if (userData.tanggalSelesai) {
    updateData.tanggalSelesai = Timestamp.fromDate(userData.tanggalSelesai);
  }

  await updateDoc(docRef, updateData);
  await createSystemNotification({
    title: "Data pengguna diperbarui",
    message: `${userData.nama || userData.email || "Data pengguna"} telah diperbarui.`,
    link: "/users",
    targetRoles: USER_MANAGEMENT_NOTIFICATION_ROLES,
  });
}

// Delete user
export async function deleteUser(id: string): Promise<void> {
  const user = await getUserById(id).catch(() => null);
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Login diperlukan");

  const response = await fetch(`/api/admin/users?uid=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || "Gagal menghapus pengguna");
  }
  await createSystemNotification({
    title: "Pengguna dihapus",
    message: `${user?.nama || "Pengguna"} telah dihapus dari sistem.`,
    link: "/users",
    targetRoles: USER_MANAGEMENT_NOTIFICATION_ROLES,
  });
}

// Toggle user status
export async function toggleUserStatus(id: string): Promise<void> {
  const user = await getUserById(id);
  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  const newStatus: UserStatus = user.status === "aktif" ? "nonaktif" : "aktif";
  await updateUser(id, { status: newStatus });
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Login diperlukan");

  const response = await fetch("/api/admin/users", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid: id, password }),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Gagal mengganti password pengguna");
  }
}


