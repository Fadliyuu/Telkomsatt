"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import ErrorState from "@/components/ErrorState";
import { getActivitiesForUser } from "@/lib/firebase/notifications";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { AppNotification } from "@/types";
import { formatDate } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Search,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  all: "Semua Aktivitas",
  system: "Sistem",
  request: "Permintaan",
  approval: "Approval",
  transaction: "Transaksi",
};

const TYPE_CLASS: Record<string, string> = {
  system: "bg-slate-100 text-slate-700 border-slate-200",
  request: "bg-orange-100 text-orange-700 border-orange-200",
  approval: "bg-green-100 text-green-700 border-green-200",
  transaction: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function AktivitasPage() {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const loadActivities = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");
      const rows = await getActivitiesForUser(user, 150);
      setActivities(rows);
    } catch (error) {
      console.error("Gagal memuat aktivitas:", error);
      setActivities([]);
      setError("Gagal memuat aktivitas. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return activities.filter((item) => {
      const matchesType = type === "all" || item.type === type;
      const haystack = [
        item.title,
        item.message,
        item.actorName,
        item.actorRole,
        ...(item.details || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesType && (!keyword || haystack.includes(keyword));
    });
  }, [activities, search, type]);

  const stats = useMemo(
    () => ({
      total: activities.length,
      request: activities.filter((item) => item.type === "request").length,
      approval: activities.filter((item) => item.type === "approval").length,
      transaction: activities.filter((item) => item.type === "transaction").length,
    }),
    [activities]
  );

  const statCards = [
    { label: "Total Aktivitas", value: stats.total, icon: Activity },
    { label: "Permintaan", value: stats.request, icon: Bell },
    { label: "Approval", value: stats.approval, icon: ClipboardCheck },
    { label: "Transaksi", value: stats.transaction, icon: FileText },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-telkomsat-black mb-1">
              Aktivitas
            </h1>
            <p className="text-telkomsat-gray">
              Riwayat perubahan data, transaksi, approval, dan notifikasi sistem.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-telkomsat-gray">{card.label}</p>
                  <p className="text-3xl font-bold text-telkomsat-black mt-1">
                    {loading ? "..." : card.value}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-telkomsat-red/10 text-telkomsat-red">
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-telkomsat-gray" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari aktivitas, nama item, SN, lokasi, atau pelaku..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 focus:bg-white focus:ring-2 focus:ring-telkomsat-red outline-none"
              />
            </div>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="px-4 py-3 rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 focus:ring-2 focus:ring-telkomsat-red outline-none"
            >
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-bold text-lg text-telkomsat-black">
              Daftar Aktivitas
            </h2>
            <p className="text-sm text-telkomsat-gray">
              {filtered.length} aktivitas
            </p>
          </div>

          {loading ? (
            <p className="text-center text-telkomsat-gray py-12">Memuat aktivitas...</p>
          ) : error ? (
            <ErrorState message={error} onRetry={loadActivities} />
          ) : filtered.length === 0 ? (
            <p className="text-center text-telkomsat-gray py-12">
              Tidak ada aktivitas yang cocok
            </p>
          ) : (
            <div className="divide-y divide-telkomsat-gray-lighter">
              {filtered.map((item) => (
                <div key={item.id} className="p-5 hover:bg-telkomsat-gray-lighter/30">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-telkomsat-red mt-1 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-telkomsat-black">
                            {item.title}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${
                              TYPE_CLASS[item.type || "system"] || TYPE_CLASS.system
                            }`}
                          >
                            {TYPE_LABEL[item.type || "system"] || "Sistem"}
                          </span>
                        </div>
                        <p className="text-sm text-telkomsat-gray mt-1">
                          {item.message}
                        </p>
                        {item.details && item.details.length > 0 && (
                          <div className="mt-3 rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 p-3">
                            <p className="text-xs font-bold text-telkomsat-black mb-2">
                              Detail Data
                            </p>
                            <div className="space-y-2">
                              {item.details.map((detail, index) => (
                                <div
                                  key={`${item.id}-${index}`}
                                  className="text-sm text-telkomsat-gray bg-white rounded-lg px-3 py-2"
                                >
                                  {index + 1}. {detail}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-telkomsat-gray mt-3">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>

                    {item.link && (
                      <Link
                        href={item.link}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-telkomsat-red hover:text-telkomsat-red-dark"
                      >
                        Buka <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
