"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Package, TrendingUp } from "lucide-react";
import { getTransactions } from "@/lib/firebase/transactions";
import { getSparepartItemsCount } from "@/lib/firebase/sparepartItems";
import { Transaksi } from "@/types";

export default function DirekturDashboardView() {
  const [totalItems, setTotalItems] = useState(0);
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const [itemCount, tx] = await Promise.all([
          getSparepartItemsCount(),
          getTransactions({ startDate: start, endDate: new Date() }),
        ]);
        setTotalItems(itemCount);
        setTransactions(tx);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const trend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        label: date.toLocaleDateString("id-ID", { weekday: "short" }),
        key: date.toISOString().slice(0, 10),
        value: 0,
      };
    });
    for (const tx of transactions) {
      const key = tx.createdAt.toISOString().slice(0, 10);
      const row = days.find((day) => day.key === key);
      if (row) row.value += 1;
    }
    const max = Math.max(1, ...days.map((day) => day.value));
    return days.map((day) => ({ ...day, height: Math.max(8, (day.value / max) * 96) }));
  }, [transactions]);

  const damageCount = transactions.filter((tx) => tx.jenisTransaksi === "DAMAGE").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-telkomsat-black">Dashboard Direktur</h1>
          <p className="mt-1 text-telkomsat-gray">Executive summary aset dan aktivitas inventaris bulan berjalan.</p>
        </div>
        <Link href="/laporan" className="inline-flex items-center gap-2 rounded-xl bg-telkomsat-red px-4 py-2.5 font-semibold text-white hover:bg-telkomsat-red-dark">
          <FileText className="h-4 w-4" />
          Buka Laporan
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <Package className="h-7 w-7 text-telkomsat-red" />
          <p className="mt-4 text-sm text-telkomsat-gray">Total Aset Unit</p>
          <p className="text-3xl font-bold text-telkomsat-black">{loading ? "..." : totalItems}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <TrendingUp className="h-7 w-7 text-emerald-600" />
          <p className="mt-4 text-sm text-telkomsat-gray">Transaksi Bulan Ini</p>
          <p className="text-3xl font-bold text-telkomsat-black">{loading ? "..." : transactions.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <BarChart3 className="h-7 w-7 text-orange-600" />
          <p className="mt-4 text-sm text-telkomsat-gray">Laporan Kerusakan</p>
          <p className="text-3xl font-bold text-telkomsat-black">{loading ? "..." : damageCount}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-telkomsat-black">Tren Transaksi 7 Hari</h2>
          <Link href="/laporan" className="inline-flex items-center gap-1 text-sm font-semibold text-telkomsat-red">
            Detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex h-36 items-end gap-3">
          {trend.map((day) => (
            <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end rounded-lg bg-telkomsat-gray-lighter/50 px-2">
                <div className="w-full rounded-t-lg bg-telkomsat-red" style={{ height: `${day.height}px` }} />
              </div>
              <span className="text-xs font-semibold text-telkomsat-gray">{day.label}</span>
              <span className="text-xs text-telkomsat-black">{day.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
