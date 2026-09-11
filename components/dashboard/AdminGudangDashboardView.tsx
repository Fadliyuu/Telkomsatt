"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  MapPin,
  Package,
  QrCode,
  RotateCcw,
  Truck,
  Wrench,
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { getTransactions } from "@/lib/firebase/transactions";
import {
  getItemsPerluVerifikasiCount,
  getSparepartItems,
  getSparepartItemsCount,
} from "@/lib/firebase/sparepartItems";
import { SparepartItem, Transaksi } from "@/types";
import { formatDate } from "@/lib/utils";

const JENIS_LABEL: Record<string, string> = {
  MOVE: "Pindah Lokasi",
  OUT: "Barang Keluar",
  DAMAGE: "Barang Rusak",
  FOUND: "Ditemukan",
  DISMANTLE: "Dismantle",
  RETURN: "Pengembalian",
};

const STATUS_STYLES: Record<string, string> = {
  Tersedia: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Digunakan: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Rusak: "bg-red-500/20 text-red-400 border-red-500/30",
  Maintenance: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Perlu Pengecekan": "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export default function AdminGudangDashboardView() {
  const [items, setItems] = useState<SparepartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pendingVerification, setPendingVerification] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const start = new Date();
      start.setDate(start.getDate() - 30);

      const [allItems, itemCount, verificationCount, tx] = await Promise.all([
        getSparepartItems(),
        getSparepartItemsCount(),
        getItemsPerluVerifikasiCount(),
        getTransactions({ startDate: start, endDate: new Date() }),
      ]);

      setItems(allItems);
      setTotalItems(itemCount);
      setPendingVerification(verificationCount);
      setTransactions(tx.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error("Error loading warehouse dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const tersedia = items.filter((item) => item.status === "Tersedia").length;
    const digunakan = items.filter((item) => item.status === "Digunakan").length;
    const bermasalah = items.filter((item) =>
      ["Rusak", "Hilang", "Maintenance", "Perlu Pengecekan"].includes(item.status || "")
    ).length;
    const barangKeluar = transactions.filter((tx) => tx.jenisTransaksi === "MOVE" || tx.jenisTransaksi === "OUT").length;
    const barangMasuk = transactions.filter((tx) =>
      ["FOUND", "RETURN", "DISMANTLE"].includes(tx.jenisTransaksi)
    ).length;

    return {
      tersedia,
      digunakan,
      bermasalah,
      barangKeluar,
      barangMasuk,
      transaksi: transactions.length,
    };
  }, [items, transactions]);

  const recentTransactions = transactions.slice(0, 8);
  const attentionItems = items
    .filter((item) => item.perluVerifikasi || ["Rusak", "Maintenance", "Perlu Pengecekan"].includes(item.status || ""))
    .slice(0, 6);

  const cards = [
    {
      label: "Total Unit Physical",
      value: totalItems,
      desc: "Unit fisik terdaftar",
      icon: Package,
      gradient: "from-blue-600/30 to-blue-900/40 border-blue-500/30 text-blue-400",
      iconBg: "bg-blue-500/20 text-blue-400",
    },
    {
      label: "Menunggu Verifikasi",
      value: pendingVerification,
      desc: "Pengajuan butuh persetujuan",
      icon: ClipboardCheck,
      gradient: "from-amber-600/30 to-orange-900/40 border-amber-500/30 text-amber-400",
      iconBg: "bg-amber-500/20 text-amber-400",
      href: "/spareparts/verifikasi",
    },
    {
      label: "Barang Keluar",
      value: stats.barangKeluar,
      desc: "Transaksi 30 hari",
      icon: Truck,
      gradient: "from-purple-600/30 to-indigo-900/40 border-purple-500/30 text-purple-400",
      iconBg: "bg-purple-500/20 text-purple-400",
    },
    {
      label: "Barang Masuk",
      value: stats.barangMasuk,
      desc: "Return / Masuk Gudang",
      icon: RotateCcw,
      gradient: "from-emerald-600/30 to-teal-900/40 border-emerald-500/30 text-emerald-400",
      iconBg: "bg-emerald-500/20 text-emerald-400",
    },
  ];

  const quickLinks = [
    { href: "/scan/gudang", icon: QrCode, label: "Scan Gudang QR", desc: "Multi-scan status & lokasi" },
    { href: "/spareparts", icon: Package, label: "Data Sparepart", desc: "Kelola unit, SN, tagging, status" },
    { href: "/lokasi", icon: MapPin, label: "Master Lokasi", desc: "Gudang, site, customer, workshop" },
    { href: "/laporan", icon: FileText, label: "Laporan Gudang", desc: "Rekap transaksi masuk & keluar" },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Top Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Dashboard Admin Gudang
          </h1>
          <p className="text-sm text-gray-400">
            Monitoring stok unit fisik, pengajuan verifikasi, dan transaksi gudang.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/scan/gudang"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-2.5 font-bold text-sm text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105"
          >
            <QrCode className="h-4 w-4" />
            <span>Scan Gudang</span>
          </Link>
          <Link
            href="/spareparts/tambah"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-md px-5 py-2.5 font-semibold text-sm text-white transition-all hover:bg-white/10 hover:border-white/30"
          >
            <Package className="h-4 w-4 text-telkomsat-red" />
            <span>Tambah Item</span>
          </Link>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <div className={`rounded-2xl border bg-gradient-to-b ${card.gradient} backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:scale-[1.02]`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-300">{card.label}</p>
                  <p className="mt-2 text-4xl font-extrabold text-white">
                    {loading ? "..." : card.value}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{card.desc}</p>
                </div>
                <div className={`rounded-2xl p-3.5 ${card.iconBg} border border-white/10 shadow-lg`}>
                  <card.icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );

          return card.href ? (
            <Link key={card.label} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>

      {/* Sub Status Metric Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-xl p-5 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Unit Tersedia</p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-300">
                {loading ? "..." : stats.tersedia}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-60" />
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 backdrop-blur-xl p-5 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Sedang Digunakan</p>
              <p className="mt-1 text-3xl font-extrabold text-blue-300">
                {loading ? "..." : stats.digunakan}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-400 opacity-60" />
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 backdrop-blur-xl p-5 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-400">Perlu Perhatian / Rusak</p>
              <p className="mt-1 text-3xl font-extrabold text-red-300">
                {loading ? "..." : stats.bermasalah}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* Main Data Split: Recent Movements & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Transactions Table Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 p-6 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-telkomsat-red/20 rounded-xl border border-telkomsat-red/30">
                <Truck className="h-5 w-5 text-telkomsat-red" />
              </div>
              <h2 className="text-lg font-bold text-white">Pergerakan Barang Terbaru</h2>
            </div>
            <Link
              href="/transaksi"
              className="flex items-center gap-1.5 text-xs font-bold text-telkomsat-red hover:underline"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-6">
            {loading ? (
              <p className="py-12 text-center text-gray-400">Memuat transaksi...</p>
            ) : recentTransactions.length === 0 ? (
              <p className="py-12 text-center text-gray-400">
                Belum ada transaksi 30 hari terakhir.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-bold text-gray-400 uppercase">
                      <th className="pb-3 px-2">Tanggal</th>
                      <th className="pb-3 px-2">Perangkat</th>
                      <th className="pb-3 px-2">Jenis</th>
                      <th className="pb-3 px-2">Lokasi</th>
                      <th className="pb-3 px-2">Penerima</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-2 text-xs text-gray-300">{formatDate(tx.createdAt)}</td>
                        <td className="py-3.5 px-2 font-semibold text-white">
                          {tx.namaItem || tx.idSparepart.slice(0, 8)}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">
                            {JENIS_LABEL[tx.jenisTransaksi] || tx.jenisTransaksi}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-xs text-gray-300">
                          {tx.lokasiTujuan || tx.lokasiAsal || "-"}
                        </td>
                        <td className="py-3.5 px-2 text-xs text-gray-300">
                          {tx.carriedByName || tx.namaPenerima || tx.namaTeknisi || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Widgets: Quick Actions & Attention Items */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Wrench className="h-5 w-5 text-telkomsat-red" />
              <h2 className="text-lg font-bold text-white">Akses Cepat Gudang</h2>
            </div>
            <div className="space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:bg-white/10 hover:border-telkomsat-red/30 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-telkomsat-red/10 rounded-lg group-hover:bg-telkomsat-red/20 transition-colors">
                      <link.icon className="h-5 w-5 text-telkomsat-red" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white group-hover:text-telkomsat-red transition-colors">
                        {link.label}
                      </p>
                      <p className="text-xs text-gray-400">{link.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-telkomsat-red group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </div>

          {/* Attention Items Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Item Perlu Perhatian</h2>
            </div>
            {loading ? (
              <p className="py-6 text-center text-xs text-gray-400">Memuat item...</p>
            ) : attentionItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">
                Tidak ada item bermasalah.
              </p>
            ) : (
              <div className="space-y-2.5">
                {attentionItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/item/${item.id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10 hover:border-white/20"
                  >
                    <p className="truncate text-sm font-bold text-white">
                      {item.namaPerangkat}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                          STATUS_STYLES[item.status || ""] || "border-gray-500/30 bg-gray-500/20 text-gray-300"
                        }`}
                      >
                        {item.perluVerifikasi ? "Perlu Verifikasi" : item.status || "Tanpa Status"}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {item.lokasiSaatIni || "Lokasi belum diisi"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
