"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Package,
  TrendingUp,
  WalletCards,
  AlertTriangle,
} from "lucide-react";
import { getTransactions } from "@/lib/firebase/transactions";
import { getSparepartItemsCount } from "@/lib/firebase/sparepartItems";
import { Transaksi } from "@/types";
import { formatDate } from "@/lib/utils";

const JENIS_LABEL: Record<string, string> = {
  MOVE: "Barang Keluar",
  DAMAGE: "Rusak",
  FOUND: "Ditemukan",
  DISMANTLE: "Dismantle",
  RETURN: "Kembali",
};

export default function AdminKeuanganDashboardView() {
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const start = new Date();
      start.setDate(start.getDate() - 30);

      const [tx, itemCount] = await Promise.all([
        getTransactions({ startDate: start, endDate: new Date() }),
        getSparepartItemsCount(),
      ]);

      setTransactions(tx.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      setTotalItems(itemCount);
    } catch (error) {
      console.error("Error loading finance dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const keluar = transactions.filter((t) => t.jenisTransaksi === "MOVE");
    const rusak = transactions.filter((t) => t.jenisTransaksi === "DAMAGE");
    const dismantle = transactions.filter((t) => t.jenisTransaksi === "DISMANTLE");

    return {
      totalTransaksi: transactions.length,
      barangKeluar: keluar.length,
      risikoBiaya: rusak.length + dismantle.length,
    };
  }, [transactions]);

  const recent = transactions.slice(0, 8);

  const cards = [
    {
      label: "Total Sparepart",
      value: totalItems,
      desc: "Unit fisik tercatat",
      icon: Package,
      color: "from-blue-600 to-blue-700",
    },
    {
      label: "Transaksi 30 Hari",
      value: stats.totalTransaksi,
      desc: "Aktivitas barang",
      icon: TrendingUp,
      color: "from-emerald-600 to-teal-700",
    },
    {
      label: "Barang Keluar",
      value: stats.barangKeluar,
      desc: "Perlu pantauan biaya",
      icon: WalletCards,
      color: "from-violet-600 to-purple-700",
    },
    {
      label: "Rusak/Dismantle",
      value: stats.risikoBiaya,
      desc: "Potensi pengadaan/perbaikan",
      icon: AlertTriangle,
      color: "from-orange-500 to-red-600",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-telkomsat-black mb-1">
            Dashboard Admin Keuangan
          </h1>
          <p className="text-telkomsat-gray">
            Ringkasan inventaris, transaksi, dan kebutuhan laporan keuangan.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/laporan"
            className="inline-flex items-center gap-2 bg-telkomsat-red text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-telkomsat-red-dark transition-colors"
          >
            <FileText className="w-4 h-4" />
            Laporan
          </Link>
          <Link
            href="/spareparts"
            className="inline-flex items-center gap-2 border-2 border-telkomsat-red text-telkomsat-red px-4 py-2.5 rounded-xl font-semibold hover:bg-telkomsat-red/10 transition-colors"
          >
            <Package className="w-4 h-4" />
            Data Sparepart
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-telkomsat-gray">{card.label}</p>
                <p className="text-3xl font-bold text-telkomsat-black mt-1">
                  {loading ? "..." : card.value}
                </p>
                <p className="text-xs text-telkomsat-gray mt-1">{card.desc}</p>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-telkomsat-red" />
              <h2 className="font-bold text-lg">Transaksi Terbaru</h2>
            </div>
            <Link
              href="/laporan"
              className="text-sm text-telkomsat-red font-semibold flex items-center gap-1"
            >
              Lihat semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-center text-telkomsat-gray py-8">Memuat...</p>
            ) : recent.length === 0 ? (
              <p className="text-center text-telkomsat-gray py-8">
                Belum ada transaksi 30 hari terakhir
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-telkomsat-gray border-b">
                      <th className="pb-2">Tanggal</th>
                      <th className="pb-2">Barang</th>
                      <th className="pb-2">Jenis</th>
                      <th className="pb-2">Lokasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-100">
                        <td className="py-3">{formatDate(tx.createdAt)}</td>
                        <td className="py-3 font-medium">
                          {tx.namaItem || tx.idSparepart.slice(0, 8)}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                            {JENIS_LABEL[tx.jenisTransaksi] || tx.jenisTransaksi}
                          </span>
                        </td>
                        <td className="py-3 text-telkomsat-gray">
                          {tx.lokasiTujuan || tx.lokasiAsal || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-bold text-lg text-telkomsat-black mb-4">
            Akses Cepat
          </h2>
          <div className="space-y-3">
            <Link
              href="/laporan"
              className="flex items-center justify-between p-4 rounded-xl bg-telkomsat-gray-lighter/50 hover:bg-telkomsat-gray-lighter transition-colors"
            >
              <span className="font-semibold">Laporan Pengadaan</span>
              <ArrowRight className="w-4 h-4 text-telkomsat-red" />
            </Link>
            <Link
              href="/spareparts"
              className="flex items-center justify-between p-4 rounded-xl bg-telkomsat-gray-lighter/50 hover:bg-telkomsat-gray-lighter transition-colors"
            >
              <span className="font-semibold">Kebutuhan Sparepart</span>
              <ArrowRight className="w-4 h-4 text-telkomsat-red" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
