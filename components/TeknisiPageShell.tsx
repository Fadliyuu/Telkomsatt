"use client";

import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAuthLoading } from "@/components/AuthProvider";
import AdminLayout from "@/components/AdminLayout";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TeknisiPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuthStore();
  const authLoading = useAuthLoading();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (user.role === "teknisi") {
    return <AdminLayout>{children}</AdminLayout>;
  }

  return <>{children}</>;
}
