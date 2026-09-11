"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ErrorState from "@/components/ErrorState";
import { getReportDateRange, toLocalDateInput } from "@/lib/utils/reportDates";
import { getTransactions } from "@/lib/firebase/transactions";
import { Transaksi, JenisTransaksi } from "@/types";
import { formatDate } from "@/lib/utils";
import { FileText, Filter, TrendingUp, AlertTriangle, RotateCcw, Activity } from "lucide-react";
import toast from "react-hot-toast";
import { downloadLaporanTransaksiPdf } from "@/lib/pdf/laporanTransaksi";
import { getSparepartById } from "@/lib/firebase/spareparts";
import { getSparepartItemById } from "@/lib/firebase/sparepartItems";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionLocation,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";
import Link from "next/link";

/** Ikon unduh lokal — hindari impor `FileDown` dari lucide (sering gagal dibaca jika node_modules di OneDrive). */
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

interface ReportFilters {
  startDate: string;
  endDate: string;
  jenisTransaksi?: JenisTransaksi;
  namaTeknisi?: string;
}

export default function LaporanUmumView() {
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [loadedFilters, setLoadedFilters] = useState<ReportFilters | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: toLocalDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate: toLocalDateInput(new Date()),
  });
  const [sparepartNames, setSparepartNames] = useState<Record<string, string>>({});
  /** Semua transaksi dalam rentang tanggal (tanpa filter jenis/teknisi) — untuk opsi dropdown teknisi */
  const [transactionsInPeriod, setTransactionsInPeriod] = useState<Transaksi[]>([]);

  const loadTransactions = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      setLoading(true);
      setError("");
      setTransactions([]);
      setTransactionsInPeriod([]);
      setSparepartNames({});
      setLoadedFilters(null);
      const inPeriod = await getTransactions(getReportDateRange(filters.startDate, filters.endDate), null);
      if (currentRequest !== requestId.current) return;
      inPeriod.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setTransactionsInPeriod(inPeriod);

      let data = inPeriod;
      if (filters.jenisTransaksi) {
        data = data.filter((t) => t.jenisTransaksi === filters.jenisTransaksi);
      }
      if (filters.namaTeknisi?.trim()) {
        const n = filters.namaTeknisi.trim();
        data = data.filter(
          (t) =>
            ((t.carriedByName || t.namaPenerima || t.namaTeknisi) ?? "").trim() === n
        );
      }

      setTransactions(data);

      // Load sparepart/item names
      const uniqueIds = [...new Set(data.map((t) => t.idSparepart))];
      const names: Record<string, string> = {};
      
      // First, use namaItem from transactions if available
      data.forEach((t) => {
        if (t.namaItem && !names[t.idSparepart]) {
          names[t.idSparepart] = t.namaItem;
        }
      });
      
      // Then, lookup remaining IDs
      await Promise.all(
        uniqueIds.map(async (id) => {
          if (names[id]) return; // Already have name from transaction
          
          // Try sparepart_items first
          try {
            const item = await getSparepartItemById(id);
            if (item) {
              names[id] = item.namaPerangkat;
              return;
            }
          } catch (e) {
            // Not in sparepart_items
          }
          
          // Try spareparts collection
          try {
            const sparepart = await getSparepartById(id);
            if (sparepart) {
              names[id] = sparepart.namaSpare;
            }
          } catch (e) {
            // Not found
          }
        })
      );
      if (currentRequest !== requestId.current) return;
      setSparepartNames(names);
      setLoadedFilters(filters);
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return;
      console.error("Error loading transactions:", error);
      const message = error instanceof Error ? error.message : "";
      setError(message || "Gagal memuat laporan. Periksa koneksi atau izin.");
      toast.error(
        message.includes("index")
          ? "Query membutuhkan index Firestore. Hubungi admin."
          : "Gagal memuat laporan. Periksa koneksi atau izin."
      );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTransactions();
    return () => { requestId.current = requestId.current + 1; };
  }, [loadTransactions]);

  const getUniqueTechnicians = () => {
    const names = transactionsInPeriod
      .map((t) => ((t.carriedByName || t.namaPenerima || t.namaTeknisi) ?? "").trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "id"));
  };

  const getStats = () => {
    const move = transactions.filter((t) => t.jenisTransaksi === "MOVE").length;
    const damage = transactions.filter((t) => t.jenisTransaksi === "DAMAGE").length;
    const return_ = transactions.filter((t) => t.jenisTransaksi === "RETURN").length;

    return { move, damage, return: return_, total: transactions.length };
  };

  const stats = getStats();

  const handleExportPdf = async () => {
    if (loading || error || loadedFilters !== filters) {
      toast.error("Tunggu hingga data selesai dimuat");
      return;
    }
    if (transactions.length === 0) {
      toast.error("Tidak ada data untuk diekspor. Ubah filter atau periode.");
      return;
    }
    await toast.promise(
      downloadLaporanTransaksiPdf({
        transactions,
        sparepartNames,
        filters,
        stats,
      }),
      {
        loading: "Menyiapkan PDF…",
        success: "PDF berhasil diunduh",
        error: "Gagal membuat PDF. Coba lagi.",
      }
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="animate-slide-in-left">
          <h1 className="text-4xl font-bold text-telkomsat-black mb-2">Laporan</h1>
          <p className="text-telkomsat-gray text-lg">Laporan pergerakan dan transaksi sparepart</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-telkomsat-gray mb-1">Total Transaksi</p>
                <p className="text-3xl font-bold text-telkomsat-black">{stats.total}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-md">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          
          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-telkomsat-gray mb-1">Barang Dipindahkan</p>
                <p className="text-3xl font-bold text-blue-600">{stats.move}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          
          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-telkomsat-gray mb-1">Barang Rusak</p>
                <p className="text-3xl font-bold text-red-600">{stats.damage}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          
          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
            style={{ animationDelay: "0.25s" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-telkomsat-gray mb-1">Barang Dikembalikan</p>
                <p className="text-3xl font-bold text-green-600">{stats.return}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-telkomsat-gray-lighter animate-slide-in-right"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="flex items-center space-x-2 mb-4">
            <div className="p-2 bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark rounded-lg">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-telkomsat-black">Filter</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                Jenis Transaksi
              </label>
              <select
                value={filters.jenisTransaksi || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    jenisTransaksi: e.target.value
                      ? (e.target.value as ReportFilters["jenisTransaksi"])
                      : undefined,
                  })
                }
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              >
                <option value="">Semua</option>
                <option value="OUT">Barang Keluar</option>
                <option value="MOVE">Pindah</option>
                <option value="RETURN">Kembali</option>
                <option value="FOUND">Ditemukan</option>
                <option value="DISMANTLE">Dismantle</option>
                <option value="DAMAGE">Rusak</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                Dibawa / ditemukan oleh
              </label>
              <select
                value={filters.namaTeknisi || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    namaTeknisi: e.target.value || undefined,
                  })
                }
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              >
                <option value="">Semua</option>
                {getUniqueTechnicians().map((tech) => (
                  <option key={tech} value={tech}>
                    {tech}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-telkomsat-gray-lighter overflow-hidden animate-scale-in"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="p-6 border-b border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/5 to-transparent flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-telkomsat-black">Data Transaksi</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading || !!error || loadedFilters !== filters || transactions.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-45 disabled:pointer-events-none disabled:transform-none"
              >
                <IconDownload className="w-4 h-4 shrink-0" />
                Unduh PDF (data terfilter)
              </button>
              <div className="p-2 bg-telkomsat-gray-lighter rounded-lg hidden sm:flex">
                <FileText className="w-5 h-5 text-telkomsat-gray" />
              </div>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin"></div>
                <p className="text-telkomsat-gray mt-4">Memuat data...</p>
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={loadTransactions} />
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 animate-fade-in">
                <FileText className="w-16 h-16 text-telkomsat-gray mx-auto mb-4 opacity-50" />
                <p className="text-telkomsat-black font-semibold text-lg">
                  Tidak ada transaksi ditemukan
                </p>
                <p className="text-telkomsat-gray mt-2">
                  Coba ubah filter untuk melihat data lainnya
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-telkomsat-gray-lighter">
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Tanggal</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Sparepart</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Dibawa / ditemukan oleh</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Disetujui oleh</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Jenis</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Lokasi</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Status</th>
                      <th className="pb-4 text-xs font-bold text-telkomsat-black uppercase tracking-wider">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => {
                      const sparepart = getTransactionSparepartLines(transaction);
                      return (
                      <tr 
                        key={transaction.id} 
                        className="border-b border-telkomsat-gray-lighter transition-all duration-200 hover:bg-telkomsat-gray-lighter/50"
                        style={{ animation: `fadeIn 0.3s ease-out ${index * 0.03}s forwards` }}
                      >
                        <td className="py-4 text-sm text-telkomsat-black">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="py-4 text-sm text-telkomsat-black font-medium">
                          <div>
                            {sparepartNames[transaction.idSparepart] || sparepart.name || "Item tidak ditemukan"}
                            <span className="block text-xs text-telkomsat-gray font-mono mt-0.5">
                              SN: {sparepart.serialNumber}
                            </span>
                            <span className="block text-xs text-telkomsat-gray font-mono mt-0.5">
                              Tagging: {sparepart.tagging}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-telkomsat-gray">
                          {getCarriedBy(transaction)}
                        </td>
                        <td className="py-4 text-sm text-telkomsat-gray">
                          {getApprovedBy(transaction)}
                        </td>
                        <td className="py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                              transaction.jenisTransaksi === "MOVE"
                                ? "bg-blue-100 text-blue-700 border border-blue-200"
                                : transaction.jenisTransaksi === "DAMAGE"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-green-100 text-green-700 border border-green-200"
                            }`}
                          >
                            {transaction.jenisTransaksi}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-telkomsat-gray">
                          {getTransactionLocation(transaction)}
                        </td>
                        <td className="py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                              transaction.statusBarang === "Normal"
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : transaction.statusBarang === "Rusak"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                          >
                            {transaction.statusBarang}
                          </span>
                        </td>
                        <td className="py-4 text-sm">
                          <Link href={`/transaksi/${transaction.id}`} className="font-semibold text-telkomsat-red">
                            Lihat
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
