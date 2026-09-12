"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  QrCode,
  Package,
  ShoppingCart,
  History,
  ArrowRight,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import { getTransactions } from "@/lib/firebase/transactions";
import { Transaksi, getJenisTransaksiLabel } from "@/types";
import { formatDate } from "@/lib/utils";

export default function TeknisiDashboardView() {
  const { user } = useAuthStore();
  const { items: cartItems, namaTeknisi, initSession } = useCartStore();
  const [recentTx, setRecentTx] = useState<Transaksi[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.nama && !namaTeknisi) {
      initSession(user.nama, "karyawan");
    }
  }, [user, namaTeknisi, initSession]);

  const loadStats = useCallback(async () => {
    try {
      const start = new Date();
      start.setDate(start.getDate() - 30);

      const all = await getTransactions({
        startDate: start,
        endDate: new Date(),
        requestedByUid: user?.id,
      });

      const sorted = all.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      setTxCount(sorted.length);
      setRecentTx(sorted.slice(0, 8));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const quickLinks = [
    {
      href: "/scan",
      icon: QrCode,
      title: "Scan QR Barcode",
      desc: "Multi-scan & tambah ke keranjang",
      gradient: "from-telkomsat-red to-telkomsat-red-dark border-red-500/30",
    },
    {
      href: "/spareparts",
      icon: Package,
      title: "Data Sparepart",
      desc: "Cari & lihat inventaris unit",
      gradient: "from-blue-600/30 to-blue-900/40 border-blue-500/30",
    },
    {
      href: "/transaksi/keranjang",
      icon: ShoppingCart,
      title: "Keranjang Pengajuan",
      desc: `${cartItems.length} item siap submit`,
      gradient: "from-emerald-600/30 to-teal-900/40 border-emerald-500/30",
    },
    {
      href: "/teknisi/riwayat",
      icon: History,
      title: "Riwayat Transaksi",
      desc: "Aktivitas Anda 30 hari terakhir",
      gradient: "from-purple-600/30 to-indigo-900/40 border-purple-500/30",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Top Header */}
      <div className="border-b border-white/10 pb-5">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
          Halo, {user?.nama?.split(" ")[0] || "Teknisi"}
        </h1>
        <p className="text-sm text-gray-400">
          Dashboard teknisi — pemindaian QR code, kelola keranjang pengajuan, dan pantau riwayat pergerakan.
        </p>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-600/20 to-red-900/30 backdrop-blur-xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-red-300">Item di Keranjang</p>
          <p className="text-4xl font-extrabold text-white mt-1">
            {cartItems.length}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/30 backdrop-blur-xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-300">Transaksi Saya (30 hari)</p>
          <p className="text-4xl font-extrabold text-white mt-1">
            {loading ? "…" : txCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Sesi Teknisi Aktif</p>
          <p className="text-lg font-bold text-white mt-2 truncate">
            {namaTeknisi || user?.nama || "—"}
          </p>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`group block p-6 rounded-2xl bg-gradient-to-b ${link.gradient} border backdrop-blur-xl text-white shadow-xl transition-all duration-300 hover:scale-[1.03]`}
          >
            <link.icon className="w-8 h-8 mb-3 text-white" />
            <h3 className="font-bold text-lg">{link.title}</h3>
            <p className="text-xs text-gray-300 mt-1">{link.desc}</p>
            <div className="flex items-center gap-1 mt-4 text-xs font-bold text-telkomsat-red group-hover:translate-x-1 transition-transform">
              <span>Buka Menu</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-telkomsat-red/20 rounded-xl border border-telkomsat-red/30">
              <ClipboardList className="w-5 h-5 text-telkomsat-red" />
            </div>
            <h2 className="text-lg font-bold text-white">Aktivitas Transaksi Terakhir Saya</h2>
          </div>
          <Link
            href="/transaksi"
            className="flex items-center gap-1.5 text-xs font-bold text-telkomsat-red hover:underline"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-gray-400">Memuat transaksi...</p>
          ) : recentTx.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">
              Belum ada riwayat transaksi 30 hari terakhir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold text-gray-400 uppercase">
                    <th className="pb-3 px-2">Tanggal</th>
                    <th className="pb-3 px-2">Perangkat</th>
                    <th className="pb-3 px-2">Jenis Aksi</th>
                    <th className="pb-3 px-2">Lokasi Tujuan</th>
                    <th className="pb-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-2 text-xs text-gray-300">{formatDate(tx.createdAt)}</td>
                      <td className="py-3.5 px-2 font-semibold text-white">
                        {tx.namaItem || tx.idSparepart.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">
                          {getJenisTransaksiLabel(tx.jenisTransaksi)}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-xs text-gray-300">
                        {tx.lokasiTujuan || tx.lokasiAsal || "-"}
                      </td>
                      <td className="py-3.5 px-2 text-xs">
                        <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 font-bold text-emerald-400">
                          {tx.statusTransaksi || "completed"}
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
    </div>
  );
}
