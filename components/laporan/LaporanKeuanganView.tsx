"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, PackageCheck, RotateCcw, TrendingUp } from "lucide-react";
import { LaporanFilters, useLaporanTransaksi } from "@/lib/hooks/useLaporanTransaksi";
import { formatDate } from "@/lib/utils";
import { getTransactionSparepartLines } from "@/lib/utils/transactionDisplay";

export default function LaporanKeuanganView() {
  const [filters, setFilters] = useState<LaporanFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const { transactions, sparepartNames, loading } = useLaporanTransaksi(filters);

  const stats = useMemo(() => {
    const pengadaan = transactions.filter((tx) => tx.jenisTransaksi === "FOUND" || tx.jenisTransaksi === "RETURN").length;
    const rusak = transactions.filter((tx) => tx.jenisTransaksi === "DAMAGE" || tx.statusBarang === "Rusak").length;
    const operasional = transactions.filter((tx) => tx.jenisTransaksi === "MOVE" || tx.jenisTransaksi === "DISMANTLE").length;
    return { total: transactions.length, pengadaan, rusak, operasional };
  }, [transactions]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold text-telkomsat-black">Laporan Keuangan</h1>
        <p className="mt-1 text-telkomsat-gray">Ringkasan aset, indikasi pengadaan, dan item yang berdampak biaya.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <FileText className="h-6 w-6 text-telkomsat-red" />
          <p className="mt-3 text-sm text-telkomsat-gray">Total Aktivitas</p>
          <p className="text-3xl font-bold">{loading ? "..." : stats.total}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <PackageCheck className="h-6 w-6 text-emerald-600" />
          <p className="mt-3 text-sm text-telkomsat-gray">Masuk / Pengadaan</p>
          <p className="text-3xl font-bold text-emerald-700">{loading ? "..." : stats.pengadaan}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm text-telkomsat-gray">Operasional</p>
          <p className="text-3xl font-bold text-blue-700">{loading ? "..." : stats.operasional}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <p className="mt-3 text-sm text-telkomsat-gray">Rusak / Potensi Biaya</p>
          <p className="text-3xl font-bold text-red-700">{loading ? "..." : stats.rusak}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-telkomsat-red" />
          <h2 className="text-lg font-bold">Filter Periode</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="rounded-xl border px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="rounded-xl border px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-bold">Rekap Aktivitas Aset</h2>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="py-10 text-center text-telkomsat-gray">Memuat...</p>
          ) : transactions.length === 0 ? (
            <p className="py-10 text-center text-telkomsat-gray">Tidak ada data pada periode ini</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-telkomsat-gray">
                    <th className="pb-3">Tanggal</th>
                    <th className="pb-3">Aset</th>
                    <th className="pb-3">Jenis</th>
                    <th className="pb-3">Kondisi</th>
                    <th className="pb-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const sparepart = getTransactionSparepartLines(tx);
                    return (
                      <tr key={tx.id} className="border-b border-telkomsat-gray-lighter">
                        <td className="py-3">{formatDate(tx.createdAt)}</td>
                        <td className="py-3 font-semibold">
                          {sparepartNames[tx.idSparepart] || sparepart.name}
                          <span className="block text-xs font-normal text-telkomsat-gray">
                            SN: {sparepart.serialNumber} · Tag: {sparepart.tagging}
                          </span>
                        </td>
                        <td className="py-3">{tx.jenisTransaksi}</td>
                        <td className="py-3">{tx.statusBarang}</td>
                        <td className="py-3">
                          <Link href={`/transaksi/${tx.id}`} className="font-semibold text-telkomsat-red">
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
