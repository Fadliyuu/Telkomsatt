import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  ActionCodeSettings,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./config";
import { COLLECTIONS } from "./collections";
import { User } from "@/types";

function mapAuthError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: string }).code)
      : undefined;
  if (code?.startsWith("auth/")) {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email atau password salah. Periksa kembali atau gunakan fitur lupa password.";
      case "auth/invalid-email":
        return "Format email tidak valid.";
      case "auth/missing-email":
        return "Email wajib diisi.";
      case "auth/user-disabled":
        return "Akun ini dinonaktifkan.";
      case "auth/too-many-requests":
        return "Terlalu banyak percobaan. Coba lagi nanti.";
      case "auth/unauthorized-continue-uri":
      case "auth/unauthorized-domain":
        return "Domain aplikasi belum diizinkan di Firebase Authentication.";
      case "auth/network-request-failed":
        return "Koneksi bermasalah. Periksa internet Anda.";
      default:
        break;
    }
  }
  if (error instanceof Error) return error.message;
  return "Login gagal";
}

function getPasswordResetActionSettings(): ActionCodeSettings | undefined {
  if (typeof window === "undefined") return undefined;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() || window.location.origin;

  return {
    url: `${baseUrl.replace(/\/$/, "")}/login?resetPassword=success`,
    handleCodeInApp: false,
  };
}

export const login = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
    if (!userDoc.exists()) {
      throw new Error("User data not found");
    }

    const userData = userDoc.data() as User;
    if (userData.status === "nonaktif") {
      throw new Error("Account is inactive");
    }

    const idToken = await firebaseUser.getIdToken();
    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!sessionResponse.ok) {
      throw new Error("Gagal membuat sesi login");
    }

    return {
      ...userData,
      id: firebaseUser.uid,
    };
  } catch (error: unknown) {
    throw new Error(mapAuthError(error));
  }
};

export const logout = async (): Promise<void> => {
  try {
    const { disablePush } = await import("./push");
    await disablePush();
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    await signOut(auth);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Logout failed";
    throw new Error(message);
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email, getPasswordResetActionSettings());
  } catch (error: unknown) {
    throw new Error(mapAuthError(error));
  }
};

export const getCurrentUser = (): Promise<FirebaseUser | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

export const getCurrentUserData = async (customUser?: FirebaseUser | null): Promise<User | null> => {
  try {
    const firebaseUser = customUser || auth.currentUser || await getCurrentUser();
    if (!firebaseUser) return null;

    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
    if (!userDoc.exists()) return null;

    return {
      ...(userDoc.data() as User),
      id: firebaseUser.uid,
    };
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
};

/**
 * Creates an admin-level user directly in Firebase Auth + Firestore.
 * Only used by seed scripts — production user creation goes through /api/admin/users.
 */
export const createAdminUser = async (
  email: string,
  password: string,
  nama: string
): Promise<void> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userData: Omit<User, "id"> = {
      nama,
      email,
      role: "admin",
      status: "aktif",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create admin user";
    throw new Error(message);
  }
};
