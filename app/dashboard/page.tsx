"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AdminGudangDashboardView from "@/components/dashboard/AdminGudangDashboardView";
import SupervisorDashboardView from "@/components/dashboard/SupervisorDashboardView";
import TeknisiDashboardView from "@/components/dashboard/TeknisiDashboardView";
import ErrorState from "@/components/ErrorState";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  collection,
  query,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { getSparepartItemsCount, getItemsPerluVerifikasiCount } from "@/lib/firebase/sparepartItems";
import { Package, TrendingUp, AlertCircle, ArrowRight, Activity, CheckCircle2 } from "lucide-react";
import { Transaksi, getJenisTransaksiLabel } from "@/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalSpareparts: 0,
    lowStock: 0,
    totalTransactions: 0,
    recentTransactions: [] as Transaksi[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || ["admin_gudang", "supervisor", "direktur", "manager", "teknisi"].includes(user.role)) return;
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setError("");
      // Get total sparepart items count & verification count
      const [totalItems, pendingVerificationCount] = await Promise.all([
        getSparepartItemsCount(),
        getItemsPerluVerifikasiCount()
      ]);

      // Get recent transactions (last 7 days)
      const transactionsSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TRANSAKSI),
          where("createdAt", ">", Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        )
      );
      const transactions = transactionsSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as Transaksi;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setStats({
        totalSpareparts: totalItems,
        lowStock: pendingVerificationCount,
        totalTransactions: transactions.length,
        recentTransactions: transactions.slice(0, 10),
      });
    } catch (err: unknown) {
      console.error("Error loading dashboard data:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // Render role-specific dashboard views
  if (user.role === "admin_gudang") {
    return (
      <AdminLayout>
        <AdminGudangDashboardView />
      </AdminLayout>
    );
  }

  if (user.role === "supervisor" || user.role === "direktur" || user.role === "manager") {
    return (
      <AdminLayout>
        <SupervisorDashboardView />
      </AdminLayout>
    );
  }

  if (user.role === "teknisi") {
    return (
      <AdminLayout>
        <TeknisiDashboardView />
      </AdminLayout>
    );
  }

  // Admin Sistem / Default Dashboard View (Dark Mode Theme)
  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in text-white">
        {/* Dashboard Header */}
        <div className="flex flex-col gap-2 border-b border-white/10 pb-5">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Dashboard Sistem
          </h1>
          <p className="text-sm text-gray-400">
            Ringkasan sistem inventaris sparepart Telkomsat Regional 6.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <div className="w-8 h-8 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-400 font-medium">Memuat data dashboard...</span>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadDashboardData} />
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-b from-blue-600/20 to-blue-900/30 rounded-2xl p-6 border border-blue-500/30 backdrop-blur-xl shadow-xl hover:scale-[1.02] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-1">Total Unit Physical</p>
                    <p className="text-4xl font-extrabold text-white mt-1">
                      {stats.totalSpareparts}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Item fisik terdaftar</p>
                  </div>
                  <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-500/30 text-blue-400">
                    <Package className="w-8 h-8" />
                  </div>
                </div>
              </div>

              <Link href="/spareparts/verifikasi" className="block">
                <div className="bg-gradient-to-b from-amber-600/20 to-orange-900/30 rounded-2xl p-6 border border-amber-500/30 backdrop-blur-xl shadow-xl hover:scale-[1.02] transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Perlu Verifikasi</p>
                      <p className="text-4xl font-extrabold text-amber-400 mt-1">
                        {stats.lowStock}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Pengajuan pending</p>
                    </div>
                    <div className="p-4 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-400">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                  </div>
                </div>
              </Link>

              <div className="bg-gradient-to-b from-emerald-600/20 to-teal-900/30 rounded-2xl p-6 border border-emerald-500/30 backdrop-blur-xl shadow-xl hover:scale-[1.02] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">Transaksi (7 Hari)</p>
                    <p className="text-4xl font-extrabold text-white mt-1">
                      {stats.totalTransactions}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Aktivitas pergerakan</p>
                  </div>
                  <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-400">
                    <TrendingUp className="w-8 h-8" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Transaksi & Update Terbaru</h2>
                <Link
                  href="/transaksi"
                  className="flex items-center space-x-1.5 text-xs text-telkomsat-red hover:underline font-bold"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="p-6">
                {stats.recentTransactions.length === 0 ? (
                  <p className="text-gray-400 text-center py-10 text-sm">
                    Belum ada transaksi 7 hari terakhir.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs font-bold text-gray-400 uppercase">
                          <th className="pb-3 px-2">Tanggal</th>
                          <th className="pb-3 px-2">Pengaju</th>
                          <th className="pb-3 px-2">Jenis Transaksi</th>
                          <th className="pb-3 px-2">Lokasi</th>
                          <th className="pb-3 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {stats.recentTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-2 text-xs text-gray-300">
                              {formatDate(tx.createdAt)}
                            </td>
                            <td className="py-3.5 px-2 font-semibold text-white">
                              {tx.requestedByName || tx.namaTeknisi || "—"}
                            </td>
                            <td className="py-3.5 px-2">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                {getJenisTransaksiLabel(tx.jenisTransaksi)}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-xs text-gray-300">
                              {tx.lokasiTujuan || tx.lokasiAsal || "Gudang"}
                            </td>
                            <td className="py-3.5 px-2 text-xs">
                              <span className="px-2.5 py-1 rounded-lg font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {tx.statusTransaksi || "Normal"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
