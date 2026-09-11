"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import ErrorState from "@/components/ErrorState";
import { getPendingTransactions, executeAtomicApproval, executeAtomicRejection } from "@/lib/firebase/transactions";
import { createNotification } from "@/lib/firebase/notifications";
import { logActivity } from "@/lib/firebase/audit";
import { Transaksi, getJenisTransaksiLabel } from "@/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import toast from "react-hot-toast";
import Link from "next/link";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  MapPin, 
  Calendar,
  Package,
  Loader2,
  FileText,
  RefreshCw
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function VerifikasiItemPage() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPendingTransactions = async () => {
    setLoading(true);
    try {
      setError("");
      const data = await getPendingTransactions();
      setTransactions(data);
    } catch (err) {
      console.error("Error fetching pending transactions:", err);
      setError("Gagal memuat pengajuan transaksi pending.");
      toast.error("Gagal memuat data pengajuan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  const handleVerifikasi = async (txItem: Transaksi) => {
    if (!user) {
      toast.error("Anda harus login untuk memverifikasi");
      return;
    }
    if (user.role !== "admin_gudang") {
      toast.error("Hanya Admin Gudang yang berwenang memverifikasi transaksi");
      return;
    }

    setProcessingId(txItem.id);
    try {
      await executeAtomicApproval(txItem.id, {
        uid: user.id,
        name: user.nama,
        role: user.role,
      });
      if (txItem.requestedByUid) await createNotification({
        title: "Pengajuan disetujui", message: `Pengajuan ${txItem.namaItem || txItem.idSparepart} telah disetujui oleh ${user.nama}.`,
        targetRoles: [], targetUids: [txItem.requestedByUid], link: "/teknisi/riwayat", type: "transaction",
      }).catch(error => console.warn("Notifikasi persetujuan gagal", error));
      await logActivity({
        action: "TRANSACTION_APPROVE",
        actorName: user.nama,
        actorRole: user.role,
        description: `Menyetujui pengajuan ${txItem.jenisTransaksi} untuk item "${txItem.namaItem || txItem.idSparepart}" (SPT: ${txItem.nomorSpt || "-"})`,
        targetId: txItem.id,
      });
      toast.success(`Pengajuan "${txItem.namaItem || txItem.idSparepart}" berhasil disetujui!`);
      setTransactions((prev) => prev.filter((i) => i.id !== txItem.id));
    } catch (err: unknown) {
      console.error("Error verifikasi:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Gagal memverifikasi: " + message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleTolak = async (txItem: Transaksi) => {
    if (!user) {
      toast.error("Anda harus login untuk menolak");
      return;
    }
    if (user.role !== "admin_gudang") {
      toast.error("Hanya Admin Gudang yang berwenang menolak transaksi");
      return;
    }

    const rejectReason = prompt(`Alasan penolakan pengajuan "${txItem.namaItem || txItem.idSparepart}"?`);
    if (!rejectReason?.trim()) return;

    setProcessingId(txItem.id);
    try {
      await executeAtomicRejection(txItem.id, {
        uid: user.id,
        name: user.nama,
        role: user.role,
      }, rejectReason);
      if (txItem.requestedByUid) await createNotification({
        title: "Pengajuan ditolak", message: `Pengajuan ${txItem.namaItem || txItem.idSparepart} ditolak: ${rejectReason.trim()}`,
        targetRoles: [], targetUids: [txItem.requestedByUid], link: "/teknisi/riwayat", type: "transaction",
      }).catch(error => console.warn("Notifikasi penolakan gagal", error));
      await logActivity({
        action: "TRANSACTION_REJECT",
        actorName: user.nama,
        actorRole: user.role,
        description: `Menolak pengajuan ${txItem.jenisTransaksi} untuk item "${txItem.namaItem || txItem.idSparepart}". Alasan: ${rejectReason}`,
        targetId: txItem.id,
      });
      toast.success(`Pengajuan "${txItem.namaItem || txItem.idSparepart}" telah ditolak.`);
      setTransactions((prev) => prev.filter((i) => i.id !== txItem.id));
    } catch (err: unknown) {
      console.error("Error menolak transaksi:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Gagal menolak pengajuan: " + message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center space-x-4">
            <Link
              href="/spareparts"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
                Approval Permintaan Transaksi
              </h1>
              <p className="text-sm text-gray-400">
                Pengajuan transaksi sparepart yang menunggu verifikasi Admin Gudang
              </p>
            </div>
          </div>
          <button
            onClick={fetchPendingTransactions}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-colors text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Alert Info */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start space-x-3 backdrop-blur-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-300 font-bold">
              Pengajuan di bawah ini membutuhkan verifikasi Admin Gudang sebelum perubahan fisik barang terjadi.
            </p>
            <p className="text-xs text-amber-400/80 mt-1">
              Pilih Setujui untuk memproses perubahan stok/lokasi dan menyimpan approver, atau Tolak dengan alasan penolakan.
            </p>
          </div>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <Loader2 className="w-8 h-8 text-telkomsat-red animate-spin" />
            <span className="ml-3 text-gray-400 font-medium">Memuat data pengajuan...</span>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchPendingTransactions} />
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-2xl mb-4 border border-emerald-500/30">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Semua Permintaan Sudah Diproses
            </h3>
            <p className="text-sm text-gray-400">
              Tidak ada pengajuan transaksi yang perlu verifikasi saat ini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Menampilkan <span className="text-white font-extrabold">{transactions.length}</span> pengajuan transaksi yang perlu approval
            </p>
            
            {transactions.map((txItem, index) => (
              <div
                key={txItem.id}
                className="bg-white/5 rounded-2xl shadow-xl border border-white/10 p-6 backdrop-blur-xl animate-slide-in-right hover:border-white/20 transition-all"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Item Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2.5 bg-telkomsat-red/20 rounded-xl border border-telkomsat-red/30 flex-shrink-0">
                        <Package className="w-5 h-5 text-telkomsat-red" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-lg">
                          {txItem.namaItem || "Sparepart"}
                        </h3>
                        {txItem.serialNumber && (
                          <p className="text-xs text-gray-300 font-mono mt-0.5">
                            SN: {txItem.serialNumber}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          Tagging: {txItem.tagging || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center space-x-2 text-gray-300">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>
                          Diajukan oleh:{" "}
                          <span className="font-bold text-white">
                            {txItem.requestedByName || "Teknisi"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-300">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span>
                          Jenis transaksi:{" "}
                          <span className="font-bold text-blue-400">
                            {getJenisTransaksiLabel(txItem.jenisTransaksi)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-300">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span>
                          Nomor SPT:{" "}
                          <span className="font-bold text-white">
                            {txItem.nomorSpt || "-"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-300">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>
                          Lokasi:{" "}
                          <span className="font-bold text-white">
                            {txItem.lokasiAsal || "Gudang"} ➔ {txItem.lokasiTujuan || "-"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-300">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>
                          Tanggal: <span className="font-bold text-white">{formatDate(txItem.createdAt)}</span>
                        </span>
                      </div>
                    </div>

                    {txItem.keterangan && (
                      <p className="text-xs text-gray-300 bg-white/5 border border-white/10 p-3 rounded-xl">
                        <span className="font-bold text-white">Keterangan:</span> {txItem.keterangan}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col gap-2.5 lg:min-w-[140px]">
                    <button
                      onClick={() => handleVerifikasi(txItem)}
                      disabled={processingId === txItem.id}
                      className="flex-1 lg:flex-none flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl hover:scale-105 transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 font-bold text-xs"
                    >
                      {processingId === txItem.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => handleTolak(txItem)}
                      disabled={processingId === txItem.id}
                      className="flex-1 lg:flex-none flex items-center justify-center space-x-2 border border-red-500/30 bg-red-500/20 text-red-300 px-5 py-2.5 rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-50 font-bold text-xs"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
