"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ErrorState from "@/components/ErrorState";
import { getTransactions } from "@/lib/firebase/transactions";
import { Transaksi, getJenisTransaksiLabel } from "@/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  FileText,
  Search,
  Filter,
  Plus,
  ShoppingCart,
  Loader2,
  Calendar,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Eye,
  AlertCircle,
  Package,
} from "lucide-react";

export default function DaftarTransaksiPage() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterJenis, setFilterJenis] = useState<string>("all");

  useEffect(() => {
    const status = statusParam;
    setFilterStatus(status && ["pending", "completed", "rejected"].includes(status) ? status : "all");
  }, [statusParam]);

  const loadTransactionsData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setError("");
      const allTx = await getTransactions(
        user.role === "teknisi" ? { requestedByUid: user.id } : undefined,
        null
      );
      
      // Access Control Scoping:
      // Teknisi: Hanya melihat transaksi miliknya (requestedByUid == user.id)
      // Admin Gudang & Supervisor: Melihat seluruh transaksi
      if (user.role === "teknisi") {
        setTransactions(allTx.filter((t) => t.requestedByUid === user.id));
      } else {
        setTransactions(allTx);
      }
    } catch (err: unknown) {
      console.error("Error loading transactions:", err);
      const message = err instanceof Error ? err.message : "Gagal memuat daftar transaksi";
      setError(message);
      toast.error("Gagal memuat data transaksi");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTransactionsData();
  }, [loadTransactionsData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filter status
      if (filterStatus !== "all" && tx.statusTransaksi !== filterStatus) {
        return false;
      }
      // Filter jenis transaksi
      if (filterJenis !== "all" && tx.jenisTransaksi !== filterJenis) {
        return false;
      }
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        tx.namaItem?.toLowerCase().includes(q) ||
        tx.serialNumber?.toLowerCase().includes(q) ||
        tx.nomorSpt?.toLowerCase().includes(q) ||
        tx.requestedByName?.toLowerCase().includes(q) ||
        tx.lokasiTujuan?.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchQuery, filterStatus, filterJenis]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Menunggu Approval</span>
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Disetujui</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded-lg border border-red-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Ditolak</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-gray-500/20 text-gray-300 text-xs font-bold rounded-lg border border-gray-500/30">
            <span>{status || "—"}</span>
          </span>
        );
    }
  };

  const getJenisBadge = (jenis: string) => {
    const label = getJenisTransaksiLabel(jenis);
    switch (jenis) {
      case "MOVE":
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-lg border border-blue-500/30">{label}</span>;
      case "OUT":
        return <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-lg border border-purple-500/30">{label}</span>;
      case "DAMAGE":
        return <span className="px-2.5 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded-lg border border-red-500/30">{label}</span>;
      case "RETURN":
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30">{label}</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-500/20 text-gray-300 text-xs font-bold rounded-lg border border-gray-500/30">{label}</span>;
    }
  };

  return (
      <div className="space-y-6 animate-fade-in text-white">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
              Daftar Transaksi
            </h1>
            <p className="text-sm text-gray-400">
              {user?.role === "teknisi"
                ? "Riwayat dan status pengajuan transaksi milik Anda"
                : "Seluruh pengajuan transaksi pergerakan dan mutasi barang gudang"}
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {user?.role === "teknisi" && (
              <Link
                href="/transaksi/keranjang"
                className="flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 hover:scale-105 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Keranjang Pengajuan</span>
              </Link>
            )}

            {user?.role === "admin_gudang" && (
              <Link
                href="/spareparts/verifikasi"
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-600/30 hover:scale-105 transition-all"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Verifikasi Pengajuan</span>
              </Link>
            )}

            <button
              onClick={loadTransactionsData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2.5 bg-white/10 border border-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-semibold text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl p-5 border border-white/10 animate-slide-in-right space-y-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari Nomor SPT, nama item, serial number, pengaju, atau lokasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-white/15 rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none transition-all text-sm bg-white/5 text-white placeholder-gray-400 focus:bg-white/10"
              />
            </div>
            
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:w-[440px] xl:shrink-0">
              <div className="flex min-w-0 items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  aria-label="Filter status transaksi"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-3 border border-white/15 rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none text-sm bg-[#161922] text-white"
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Menunggu Approval</option>
                  <option value="completed">Disetujui</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>

              <select
                aria-label="Filter jenis transaksi"
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full px-3 py-3 border border-white/15 rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none text-sm bg-[#161922] text-white"
              >
                <option value="all">Semua Jenis Transaksi</option>
                <option value="MOVE">Pindah Lokasi</option>
                <option value="OUT">Barang Keluar</option>
                <option value="DAMAGE">Barang Rusak</option>
                <option value="RETURN">Pengembalian Barang</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table / Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <Loader2 className="w-8 h-8 text-telkomsat-red animate-spin" />
            <span className="ml-3 text-gray-400 font-medium">Memuat data transaksi...</span>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadTransactionsData} />
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl shadow-xl border border-white/10 p-6 backdrop-blur-xl">
            <Package className="w-16 h-16 text-gray-400 opacity-40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">
              Tidak Ada Transaksi Ditemukan
            </h3>
            <p className="text-sm text-gray-400">
              {searchQuery || filterStatus !== "all" || filterJenis !== "all"
                ? "Tidak ada transaksi yang sesuai dengan kriteria pencarian atau filter Anda."
                : "Belum ada riwayat transaksi yang tercatat di dalam sistem."}
            </p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Menampilkan <span className="text-white font-extrabold">{filteredTransactions.length}</span> transaksi
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/10 text-xs font-bold text-gray-300 uppercase border-b border-white/10">
                  <tr>
                    <th className="px-6 py-3.5">Tanggal</th>
                    <th className="px-6 py-3.5">Jenis Transaksi</th>
                    <th className="px-6 py-3.5">Nomor SPT</th>
                    <th className="px-6 py-3.5">Item & Serial Number</th>
                    <th className="px-6 py-3.5">Lokasi (Asal ➔ Tujuan)</th>
                    <th className="px-6 py-3.5">Pengaju</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-300">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>{formatDate(tx.createdAt)}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {getJenisBadge(tx.jenisTransaksi)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-white font-bold">
                        {tx.nomorSpt || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-white">
                            {tx.namaItem || tx.idSparepart}
                          </p>
                          {tx.serialNumber && (
                            <p className="text-xs text-gray-400 font-mono">
                              SN: {tx.serialNumber}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-300">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>
                            {tx.lokasiAsal || "Gudang"} ➔ <strong className="text-white">{tx.lokasiTujuan || "Gudang"}</strong>
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-300">
                        <div className="flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>{tx.requestedByName || "—"}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(tx.statusTransaksi)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/transaksi/${tx.id}`}
                          className="inline-flex items-center space-x-1 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white font-bold text-xs px-3.5 py-1.5 rounded-xl hover:scale-105 transition-all shadow-md shadow-red-600/20"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Rincian</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  );
}
