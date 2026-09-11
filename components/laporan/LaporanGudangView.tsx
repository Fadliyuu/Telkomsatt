"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  FileText,
  Package,
  AlertTriangle,
  Activity,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { downloadLaporanGudangPdf } from "@/lib/pdf/laporanGudang";
import { USER_ROLE_LABELS } from "@/types";
import { formatDate } from "@/lib/utils";
import {
  ArahBarang,
  filterByArah,
  formatLokasiPergerakan,
  getArahBadgeClass,
  getArahBarang,
  getArahLabel,
  getGudangStats,
  getJenisBadgeClass,
  JENIS_TRANSAKSI_LABELS,
} from "@/lib/constants/transaksiReport";
import {
  LaporanFilters,
  useLaporanTransaksi,
} from "@/lib/hooks/useLaporanTransaksi";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";
import Link from "next/link";

type TabArah = "semua" | ArahBarang;

function IconDownload({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

export default function LaporanGudangView() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<LaporanFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [activeTab, setActiveTab] = useState<TabArah>("semua");

  const {
    transactions,
    sparepartNames,
    loading,
    getUniqueTechnicians,
  } = useLaporanTransaksi(filters);

  const filteredTransactions = useMemo(
    () => filterByArah(transactions, activeTab),
    [transactions, activeTab]
  );

  const stats = useMemo(() => getGudangStats(transactions), [transactions]);
  const filteredStats = useMemo(
    () => getGudangStats(filteredTransactions),
    [filteredTransactions]
  );

  const handleExportPdf = async () => {
    if (loading) {
      toast.error("Tunggu hingga data selesai dimuat");
      return;
    }
    if (filteredTransactions.length === 0) {
      toast.error("Tidak ada data untuk diekspor. Ubah filter atau tab.");
      return;
    }
    if (!user?.nama) {
      toast.error("Data pengguna tidak tersedia");
      return;
    }

    try {
      await downloadLaporanGudangPdf({
        transactions: filteredTransactions,
        sparepartNames,
        filters,
        activeTab,
        meta: {
          exportedByName: user.nama,
          exportedByEmail: user.email,
          exportedByRole: USER_ROLE_LABELS[user.role],
        },
      });

      toast.success("PDF laporan gudang berhasil dibuat");
    } catch (err: unknown) {
      console.error("Gagal export PDF:", err);
      const message =
        err instanceof Error ? err.message : "Gagal mengunduh Laporan PDF";
      toast.error(message);
    }
  };

  const tabs: { id: TabArah; label: string; count: number }[] = [
    { id: "semua", label: "Semua", count: stats.total },
    { id: "keluar", label: "Barang Keluar", count: stats.keluar },
    { id: "masuk", label: "Barang Masuk", count: stats.masuk },
    { id: "lainnya", label: "Rusak / Lainnya", count: stats.lainnya },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-8 text-white">
      <div className="border-b border-white/10 pb-5">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
          Laporan Barang Masuk &amp; Keluar
        </h1>
        <p className="text-sm text-gray-400">
          Monitor pergerakan sparepart keluar dari gudang dan masuk kembali ke inventaris.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-300">Total Transaksi</p>
              <p className="mt-1 text-4xl font-extrabold text-white">
                {stats.total}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3.5 border border-white/10 shadow-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-600/20 to-indigo-900/30 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Barang Keluar
              </p>
              <p className="mt-1 text-4xl font-extrabold text-white">{stats.keluar}</p>
              <p className="mt-1 text-xs text-gray-300">
                MOVE {stats.move} · Dismantle {stats.dismantle}
              </p>
            </div>
            <div className="rounded-2xl bg-purple-500/20 p-3.5 border border-purple-500/30 shadow-lg">
              <ArrowUpFromLine className="h-6 w-6 text-purple-300" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-600/20 to-teal-900/30 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Barang Masuk
              </p>
              <p className="mt-1 text-4xl font-extrabold text-white">{stats.masuk}</p>
              <p className="mt-1 text-xs text-gray-300">
                Return {stats.return} · Found {stats.found}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-500/20 p-3.5 border border-emerald-500/30 shadow-lg">
              <ArrowDownToLine className="h-6 w-6 text-emerald-300" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-600/20 to-red-900/30 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-300">
                Laporan Rusak
              </p>
              <p className="mt-1 text-4xl font-extrabold text-white">{stats.damage}</p>
              <p className="mt-1 text-xs text-gray-300">Status DAMAGE</p>
            </div>
            <div className="rounded-2xl bg-red-500/20 p-3.5 border border-red-500/30 shadow-lg">
              <AlertTriangle className="h-6 w-6 text-red-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="rounded-xl bg-telkomsat-red/20 border border-telkomsat-red/30 p-2">
            <Filter className="h-5 w-5 text-telkomsat-red" />
          </div>
          <h2 className="text-lg font-bold text-white">Filter Periode &amp; Personel</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-sm">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-400 uppercase">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none transition-all focus:border-telkomsat-red focus:bg-white/10 focus:ring-2 focus:ring-telkomsat-red/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-400 uppercase">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none transition-all focus:border-telkomsat-red focus:bg-white/10 focus:ring-2 focus:ring-telkomsat-red/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-400 uppercase">
              Dibawa / Ditemukan Oleh
            </label>
            <select
              value={filters.namaTeknisi || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  namaTeknisi: e.target.value || undefined,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#161922] text-white px-4 py-3 outline-none transition-all focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
            >
              <option value="">Semua teknisi</option>
              {getUniqueTechnicians().map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white shadow-lg shadow-red-600/30 scale-[1.02]"
                : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === tab.id
                  ? "bg-white/25 text-white"
                  : "bg-white/10 text-gray-400"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-6 py-4">
          <h2 className="text-lg font-bold text-white">
            Daftar Pergerakan
            {activeTab !== "semua" && (
              <span className="ml-2 text-sm font-extrabold text-telkomsat-red">
                — {getArahLabel(activeTab)}
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || filteredTransactions.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconDownload className="h-4 w-4 shrink-0" />
              Cetak PDF ({filteredTransactions.length} Baris)
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-telkomsat-red border-t-transparent" />
              <p className="mt-4 text-xs text-gray-400 font-medium">Memuat transaksi gudang...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto mb-4 h-16 w-16 text-gray-400 opacity-40" />
              <p className="text-lg font-bold text-white">
                Tidak ada transaksi
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Ubah periode tanggal atau tab filter untuk melihat data lain.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold text-gray-300 uppercase">
                    <th className="pb-3 px-2">Tanggal</th>
                    <th className="pb-3 px-2">Arah</th>
                    <th className="pb-3 px-2">Perangkat</th>
                    <th className="pb-3 px-2">Dibawa / Ditemukan</th>
                    <th className="pb-3 px-2">Approver</th>
                    <th className="pb-3 px-2">Jenis</th>
                    <th className="pb-3 px-2">Pergerakan</th>
                    <th className="pb-3 px-2">Kondisi</th>
                    <th className="pb-3 px-2 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.map((t) => {
                    const arah = getArahBarang(t.jenisTransaksi);
                    const sparepart = getTransactionSparepartLines(t);
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-white/10 transition-colors"
                      >
                        <td className="py-3.5 px-2 text-xs text-gray-300">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${getArahBadgeClass(arah)}`}>
                            {getArahLabel(arah)}
                          </span>
                        </td>
                        <td className="py-3.5 px-2">
                          <p className="font-bold text-white">{sparepart.name}</p>
                          {sparepart.serialNumber && (
                            <p className="text-[11px] font-mono text-gray-400">SN: {sparepart.serialNumber}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-xs text-gray-300 font-medium">
                          {getCarriedBy(t)}
                        </td>
                        <td className="py-3.5 px-2 text-xs text-gray-300">
                          {getApprovedBy(t)}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${getJenisBadgeClass(t.jenisTransaksi)}`}>
                            {JENIS_TRANSAKSI_LABELS[t.jenisTransaksi] || t.jenisTransaksi}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-xs text-gray-300">
                          {formatLokasiPergerakan(t)}
                        </td>
                        <td className="py-3.5 px-2 text-xs font-bold text-emerald-400">
                          {t.statusBarang || "Normal"}
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <Link
                            href={`/transaksi/${t.id}`}
                            className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-telkomsat-red" />
                            <span>Rincian</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
