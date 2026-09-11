"use client";

import AdminLayout from "@/components/AdminLayout";
import LaporanGudangView from "@/components/laporan/LaporanGudangView";
import LaporanKeuanganView from "@/components/laporan/LaporanKeuanganView";
import LaporanUmumView from "@/components/laporan/LaporanUmumView";
import { useAuthStore } from "@/lib/store/useAuthStore";

export default function LaporanPage() {
  const { user } = useAuthStore();
  const isAdminGudang = user?.role === "admin_gudang";
  const isAdminKeuangan = user?.role === "admin_keuangan";

  return (
    <AdminLayout>
      {isAdminGudang ? (
        <LaporanGudangView />
      ) : isAdminKeuangan ? (
        <LaporanKeuanganView />
      ) : (
        <LaporanUmumView />
      )}
    </AdminLayout>
  );
}
