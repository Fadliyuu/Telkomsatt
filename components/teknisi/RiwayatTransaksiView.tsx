"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import { getTransactions } from "@/lib/firebase/transactions";
import { Transaksi } from "@/types";
import { formatDate } from "@/lib/utils";
import { History, Filter, Loader2 } from "lucide-react";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionLocation,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";

const JENIS_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "MOVE", label: "Bawa" },
  { value: "DAMAGE", label: "Rusak" },
  { value: "FOUND", label: "Ditemukan" },
  { value: "DISMANTLE", label: "Dismantle" },
];

export default function RiwayatTransaksiView() {
  const { user } = useAuthStore();
  const { namaTeknisi } = useCartStore();
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterJenis, setFilterJenis] = useState("all");
  const [days, setDays] = useState(30);

  const teknisiName = namaTeknisi || user?.nama || "";
  const isTeknisi = user?.role === "teknisi";

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() - days);
      const rows = await getTransactions({
        startDate: start,
        endDate: new Date(),
        namaTeknisi: isTeknisi ? undefined : (teknisiName || undefined),
        requestedByUid: isTeknisi ? user?.id : undefined,
      });
      setTransactions(
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [days, teknisiName, isTeknisi, user?.id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filtered = useMemo(() => {
    if (filterJenis === "all") return transactions;
    return transactions.filter((t) => t.jenisTransaksi === filterJenis);
  }, [transactions, filterJenis]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-telkomsat-black flex items-center gap-2">
          <History className="w-8 h-8 text-telkomsat-red" />
          Riwayat Transaksi
        </h1>
        <p className="text-telkomsat-gray mt-1">
          Aktivitas tercatat atas nama: <strong>{teknisiName || "-"}</strong>
        </p>
      </div>

      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-semibold text-telkomsat-gray block mb-1">
            Periode
          </label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value={7}>7 hari</option>
            <option value={30}>30 hari</option>
            <option value={90}>90 hari</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-telkomsat-gray block mb-1">
            Jenis transaksi
          </label>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {JENIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-telkomsat-gray ml-auto flex items-center gap-1">
          <Filter className="w-4 h-4" />
          {filtered.length} transaksi
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-telkomsat-red" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-telkomsat-gray">
            Tidak ada transaksi pada periode ini
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-telkomsat-gray">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Sparepart</th>
                  <th className="px-4 py-3">Dibawa / ditemukan oleh</th>
                  <th className="px-4 py-3">Disetujui oleh</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Lokasi</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const sparepart = getTransactionSparepartLines(t);
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {sparepart.name}
                        <span className="block font-mono text-xs text-telkomsat-gray">
                          SN: {sparepart.serialNumber}
                        </span>
                        <span className="block font-mono text-xs text-telkomsat-gray">
                          Tagging: {sparepart.tagging}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getCarriedBy(t)}</td>
                      <td className="px-4 py-3">{getApprovedBy(t)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                          {t.jenisTransaksi}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getTransactionLocation(t)}</td>
                      <td className="px-4 py-3">{t.statusBarang}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
