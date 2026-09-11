"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, Package, Users } from "lucide-react";
import { getTransactions } from "@/lib/firebase/transactions";
import { getItemsPerluVerifikasiCount, getSparepartItemsCount } from "@/lib/firebase/sparepartItems";
import { getUsers } from "@/lib/firebase/users";
import { Transaksi } from "@/types";
import { formatDate } from "@/lib/utils";

export default function ManagerDashboardView() {
  const [pending, setPending] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        const [pendingCount, itemCount, users, tx] = await Promise.all([
          getItemsPerluVerifikasiCount(),
          getSparepartItemsCount(),
          getUsers(),
          getTransactions({ startDate: start, endDate: new Date() }),
        ]);
        setPending(pendingCount);
        setTotalItems(itemCount);
        setUserCount(users.length);
        setTransactions(tx.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const move = transactions.filter((t) => t.jenisTransaksi === "MOVE").length;
    const damage = transactions.filter((t) => t.jenisTransaksi === "DAMAGE").length;
    return { move, damage, total: transactions.length };
  }, [transactions]);

  const cards = [
    { label: "Pending Approval", value: pending, icon: ClipboardCheck, href: "/spareparts/verifikasi" },
    { label: "Transaksi 30 Hari", value: stats.total, icon: FileText, href: "/laporan" },
    { label: "Total Unit", value: totalItems, icon: Package, href: "/spareparts" },
    { label: "Pengguna", value: userCount, icon: Users, href: "/users" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-telkomsat-black">Dashboard Manager</h1>
        <p className="mt-1 text-telkomsat-gray">Ringkasan approval, transaksi tim, dan pengelolaan pengguna.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-telkomsat-gray">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-telkomsat-black">{loading ? "..." : card.value}</p>
              </div>
              <div className="rounded-xl bg-telkomsat-red p-3">
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-telkomsat-black">Transaksi Terbaru</h2>
            <Link href="/laporan" className="inline-flex items-center gap-1 text-sm font-semibold text-telkomsat-red">
              Lihat laporan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {loading ? (
            <p className="py-8 text-center text-telkomsat-gray">Memuat...</p>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-telkomsat-gray">Belum ada transaksi 30 hari terakhir</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 6).map((tx) => (
                <Link key={tx.id} href={`/transaksi/${tx.id}`} className="flex items-center justify-between rounded-xl border border-telkomsat-gray-lighter p-3 hover:bg-telkomsat-gray-lighter/40">
                  <div>
                    <p className="font-semibold text-telkomsat-black">{tx.namaItem || tx.idSparepart}</p>
                    <p className="text-xs text-telkomsat-gray">{formatDate(tx.createdAt)} · {tx.carriedByName || tx.namaTeknisi}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{tx.jenisTransaksi}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-telkomsat-black">Akses Cepat</h2>
          <div className="mt-4 space-y-3">
            <Link href="/spareparts/verifikasi" className="flex items-center justify-between rounded-xl bg-telkomsat-gray-lighter/50 p-4 font-semibold hover:bg-telkomsat-gray-lighter">
              Approval Permintaan <ArrowRight className="h-4 w-4 text-telkomsat-red" />
            </Link>
            <Link href="/users" className="flex items-center justify-between rounded-xl bg-telkomsat-gray-lighter/50 p-4 font-semibold hover:bg-telkomsat-gray-lighter">
              Manajemen User <ArrowRight className="h-4 w-4 text-telkomsat-red" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
