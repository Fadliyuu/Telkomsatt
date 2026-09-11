"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, TrendingUp, ArrowRight, Eye } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import ErrorState from "@/components/ErrorState";
import { collection, getCountFromServer, query, Timestamp, where } from "firebase/firestore";

export default function SupervisorDashboardView() {
  const [stats, setStats] = useState({
    pendingVerification: 0,
    weeklyTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const [pendingVerification, weeklySnapshot] = await Promise.all([
        getCountFromServer(
          query(
            collection(db, COLLECTIONS.TRANSAKSI),
            where("statusTransaksi", "==", "pending")
          )
        ),
        getCountFromServer(
          query(
            collection(db, COLLECTIONS.TRANSAKSI),
            where("createdAt", ">=", Timestamp.fromDate(weekStart))
          )
        ),
      ]);

      setStats({
        pendingVerification: pendingVerification.data().count,
        weeklyTransactions: weeklySnapshot.data().count,
      });
    } catch (error) {
      console.error("Gagal memuat dashboard supervisor:", error);
      setError("Gagal memuat statistik. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white/5 rounded-2xl border border-white/10">
        <div className="w-10 h-10 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-gray-400 font-medium text-sm">Memuat dashboard supervisor...</span>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={loadStats} />;

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="border-b border-white/10 pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-3">
          <Eye className="w-3.5 h-3.5" />
          <span>Mode Monitoring & Pengawasan</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
          Dashboard Supervisor
        </h1>
        <p className="text-sm text-gray-400">
          Monitoring validasi pekerjaan, pemantauan pengajuan, dan statistik transaksi regional.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/transaksi?status=pending"
          className="bg-gradient-to-b from-amber-600/20 to-orange-900/30 rounded-2xl p-6 border border-amber-500/30 backdrop-blur-xl shadow-xl hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                Pengajuan Perlu Verifikasi
              </p>
              <p className="text-4xl font-extrabold text-amber-400 mt-1">
                {stats.pendingVerification}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Transaksi menunggu keputusan Admin Gudang
              </p>
            </div>
            <div className="p-4 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-400 group-hover:scale-110 transition-transform">
              <ClipboardCheck className="w-8 h-8" />
            </div>
          </div>
        </Link>

        <div className="bg-gradient-to-b from-emerald-600/20 to-teal-900/30 rounded-2xl p-6 border border-emerald-500/30 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">
                Transaksi 7 Hari Terakhir
              </p>
              <p className="text-4xl font-extrabold text-white mt-1">
                {stats.weeklyTransactions}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Aktivitas pergerakan dalam 7 hari terakhir
              </p>
            </div>
            <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Link */}
      <div className="pt-2">
        <Link
          href="/transaksi?status=pending"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark font-bold text-sm text-white shadow-lg shadow-red-600/30 hover:scale-105 transition-all"
        >
          <span>Pantau Antrean Verifikasi</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
