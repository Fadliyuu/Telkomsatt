"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/config";
import { getCurrentUserData } from "@/lib/firebase/auth";
import { useAuthStore } from "@/lib/store/useAuthStore";

interface AuthContextValue {
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ authLoading: true });

export function useAuthLoading() {
  return useContext(AuthContext).authLoading;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, clearUser } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          const sessionResponse = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          if (!sessionResponse.ok) {
            throw new Error("Session tidak valid");
          }
          const userData = await getCurrentUserData(firebaseUser);
          if (userData) {
            setUser(userData);
          } else {
            clearUser();
          }
        } else {
          await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
          clearUser();
        }
      } catch {
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
        await signOut(auth).catch(() => undefined);
        clearUser();
        const currentPath = window.location.pathname;
        const isPublicPage = currentPath === "/" || currentPath.startsWith("/login");
        if (!isPublicPage) {
          router.replace(`/login?next=${encodeURIComponent(currentPath || "/dashboard")}`);
        }
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, clearUser, router]);

  return (
    <AuthContext.Provider value={{ authLoading }}>{children}</AuthContext.Provider>
  );
}
