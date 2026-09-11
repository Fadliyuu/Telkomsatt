import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/types";
import { AUTH_STORAGE_KEY } from "@/lib/constants/storageKeys";

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: AUTH_STORAGE_KEY,
    }
  )
);

