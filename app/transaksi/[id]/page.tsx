"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ErrorState from "@/components/ErrorState";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { doc, getDoc } from "firebase/firestore";
import { Transaksi, getJenisTransaksiLabel } from "@/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { formatDate } from "@/lib/utils";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionLocation,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  Package,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
} from "lucide-react";

export default function DetailTransaksiPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { user } = useAuthStore();
  const [transaction, setTransaction] = useState<Transaksi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransaction = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const snap = await getDoc(doc(db, COLLECTIONS.TRANSAKSI, id));
      if (!snap.exists()) {
        setError("Transaksi tidak ditemukan.");
        setTransaction(null);
        return;
      }
      const data = snap.data();
      const tx = {
        id: snap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || Date.now()),
        requestedAt: data.requestedAt?.toDate?.() || data.requestedAt,
        approvedAt: data.approvedAt?.toDate?.() || data.approvedAt,
        rejectedAt: data.rejectedAt?.toDate?.() || data.rejectedAt,
      } as Transaksi;

      // Access Control:
      // Teknisi hanya boleh melihat transaksi miliknya sendiri
      if (user && user.role === "teknisi" && tx.requestedByUid && tx.requestedByUid !== user.id) {
        setError("Anda tidak memiliki akses untuk melihat detail pengajuan milik teknisi lain.");
        setTransaction(null);
        return;
      }

      setTransaction(tx);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat detail transaksi";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadTransaction();
  }, [loadTransaction]);

  const sparepart = transaction ? getTransactionSparepartLines(transaction) : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-amber-500/20 text-amber-300 text-sm font-bold rounded-xl border border-amber-500/30">
            <Clock className="w-4 h-4" />
            <span>Menunggu Approval Admin Gudang</span>
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-500/20 text-emerald-300 text-sm font-bold rounded-xl border border-emerald-500/30">
            <CheckCircle className="w-4 h-4" />
            <span>Disetujui & Selesai</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-red-500/20 text-red-300 text-sm font-bold rounded-xl border border-red-500/30">
            <XCircle className="w-4 h-4" />
            <span>Ditolak</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-gray-500/20 text-gray-300 text-sm font-bold rounded-xl border border-gray-500/30">
            <span>{status || "—"}</span>
          </span>
        );
    }
  };

  return (
      <div className="space-y-6 animate-fade-in text-white">
        {/* Header & Back Link */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center space-x-4">
            <Link
              href="/transaksi"
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-colors text-white"
              title="Kembali ke Daftar Transaksi"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mb-0.5">
                Detail Transaksi
              </h1>
              <p className="text-gray-400 text-xs font-mono">
                ID Transaksi: {id}
              </p>
            </div>
          </div>

          {user?.role === "admin_gudang" && transaction?.statusTransaksi === "pending" && (
            <Link
              href="/spareparts/verifikasi"
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-5 py-2.5 rounded-xl hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-amber-600/30"
            >
              <FileCheck className="w-4 h-4" />
              <span>Proses Approval</span>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center text-gray-400 backdrop-blur-xl">
            <div className="w-8 h-8 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Memuat detail transaksi...
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadTransaction} />
        ) : transaction && sparepart ? (
          <>
            {/* Rejection Alert Box if Status is Rejected */}
            {transaction.statusTransaksi === "rejected" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 animate-scale-in shadow-xl backdrop-blur-xl">
                <div className="flex items-start space-x-3">
                  <ShieldAlert className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h3 className="font-bold text-red-300 text-lg">
                      Pengajuan Transaksi Ditolak
                    </h3>
                    <p className="text-sm text-red-200">
                      <strong className="font-bold text-white">Alasan Penolakan:</strong>{" "}
                      {transaction.rejectReason || "Tidak ada alasan spesifik yang dilampirkan."}
                    </p>
                    {transaction.rejectedByName && (
                      <p className="text-xs text-red-400 mt-1">
                        Ditolak oleh <span className="font-bold text-white">{transaction.rejectedByName}</span>{" "}
                        {transaction.rejectedAt ? `pada ${formatDate(transaction.rejectedAt)}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Main Header Info Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-4 backdrop-blur-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 font-extrabold text-xs rounded-lg border border-blue-500/30">
                      {getJenisTransaksiLabel(transaction.jenisTransaksi)}
                    </span>
                    {transaction.nomorSpt && (
                      <span className="px-3 py-1 bg-white/10 text-white font-mono font-bold text-xs rounded-lg border border-white/10">
                        SPT: {transaction.nomorSpt}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-extrabold text-white">
                    {sparepart.name}
                  </h2>
                </div>
                <div>{getStatusBadge(transaction.statusTransaksi)}</div>
              </div>

              {/* Status Change & Timeline History */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 text-sm">
                <div className="flex items-start space-x-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <Calendar className="w-5 h-5 text-telkomsat-red mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Tanggal Pengajuan</p>
                    <p className="font-bold text-white mt-0.5">
                      {formatDate(transaction.createdAt)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Oleh: <span className="font-bold text-white">{transaction.requestedByName || "Teknisi"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <MapPin className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Pergerakan Lokasi</p>
                    <p className="font-bold text-white mt-0.5">
                      {transaction.lokasiAsal || "Gudang"} ➔ {transaction.lokasiTujuan || "Gudang"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <User className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Verifikator Admin</p>
                    <p className="font-bold text-white mt-0.5">
                      {getApprovedBy(transaction)}
                    </p>
                    {transaction.approvedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Disetujui: {formatDate(transaction.approvedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Item Details */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-4 backdrop-blur-xl">
                <h3 className="font-bold text-white text-lg flex items-center space-x-2 border-b border-white/10 pb-3">
                  <Package className="w-5 h-5 text-telkomsat-red" />
                  <span>Daftar Barang yang Diajukan</span>
                </h3>
                <dl className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <dt className="text-gray-400">Nama Perangkat</dt>
                    <dd className="font-bold text-white">{sparepart.name}</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <dt className="text-gray-400">Serial Number</dt>
                    <dd className="font-mono font-bold text-white">{sparepart.serialNumber}</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <dt className="text-gray-400">Tagging</dt>
                    <dd className="font-mono text-gray-300">{sparepart.tagging}</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <dt className="text-gray-400">Jumlah Unit</dt>
                    <dd className="font-extrabold text-telkomsat-red">{transaction.jumlah} Unit</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-gray-400">Status Fisik Barang</dt>
                    <dd className="font-bold text-emerald-400">{transaction.statusBarang || "Normal"}</dd>
                  </div>
                </dl>
              </div>

              {/* Transaction Context & Notes */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-4 backdrop-blur-xl">
                <h3 className="font-bold text-white text-lg flex items-center space-x-2 border-b border-white/10 pb-3">
                  <FileText className="w-5 h-5 text-telkomsat-red" />
                  <span>Catatan & Surat Perintah</span>
                </h3>
                <dl className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <dt className="text-gray-400">Nomor SPT</dt>
                    <dd className="font-mono font-bold text-white">{transaction.nomorSpt || "—"}</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <dt className="text-gray-400">Pembawa / Penerima</dt>
                    <dd className="font-bold text-white">{getCarriedBy(transaction)}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-gray-400 mb-1.5">Catatan Keterangan Transaksi</dt>
                    <dd className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-xs font-mono">
                      {transaction.keterangan || "Tidak ada catatan tambahan."}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Supporting Photos / Documents */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-4 backdrop-blur-xl">
              <h3 className="font-bold text-white text-lg border-b border-white/10 pb-3">
                Dokumen & Foto Pendukung
              </h3>
              {transaction.fotoUrl?.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {transaction.fotoUrl.map((url, idx) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-md hover:border-telkomsat-red/50 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Foto kondisi transaksi ${idx + 1}`}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Tidak ada foto pendukung yang dilampirkan pada transaksi ini.
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
  );
}
