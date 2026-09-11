"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ErrorState from "@/components/ErrorState";
import UserAvatar from "@/components/UserAvatar";
import { getActivitiesForUser } from "@/lib/firebase/notifications";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { AppNotification } from "@/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Bell, Filter } from "lucide-react";

type FilterType = "all" | NonNullable<AppNotification["type"]>;

export default function NotifikasiPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [visibleCount, setVisibleCount] = useState(20);

  const loadRows = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setError("");
      const data = await getActivitiesForUser(user, 200);
      setRows(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal memuat notifikasi";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(
    () => rows.filter((row) => filter === "all" || row.type === filter),
    [rows, filter]
  );
  const visibleRows = filteredRows.slice(0, visibleCount);

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-telkomsat-black">Notifikasi</h1>
          <p className="mt-1 text-telkomsat-gray">Riwayat notifikasi sistem dan approval.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-4 shadow-sm">
          <Filter className="h-4 w-4 text-telkomsat-red" />
          {(["all", "system", "transaction", "approval", "request"] as FilterType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setFilter(type);
                setVisibleCount(20);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                filter === type
                  ? "bg-telkomsat-red text-white"
                  : "bg-telkomsat-gray-lighter/50 text-telkomsat-black hover:bg-telkomsat-gray-lighter"
              }`}
            >
              {type === "all" ? "Semua" : type}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-10 text-center text-telkomsat-gray shadow-sm">
            Memuat notifikasi...
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadRows} />
        ) : visibleRows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
            <Bell className="mx-auto mb-3 h-12 w-12 text-telkomsat-gray opacity-50" />
            <p className="font-semibold text-telkomsat-black">Belum ada notifikasi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((row) => (
              <div key={row.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <UserAvatar
                      name={row.actorName}
                      src={row.actorPhotoUrl}
                      size="md"
                      className="mt-1"
                    />
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-telkomsat-black">{row.title}</h2>
                      {row.type ? (
                        <span className="rounded-full bg-telkomsat-gray-lighter px-2 py-0.5 text-xs font-semibold text-telkomsat-gray">
                          {row.type}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-telkomsat-gray">{row.message}</p>
                    {row.details?.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-telkomsat-gray">
                        {row.details.slice(0, 3).map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-telkomsat-gray">{formatDate(row.createdAt)}</p>
                    {row.link ? (
                      <Link href={row.link} className="mt-2 inline-block text-sm font-semibold text-telkomsat-red">
                        Buka
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {visibleRows.length < filteredRows.length ? (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 20)}
                className="w-full rounded-xl border bg-white px-4 py-3 font-semibold text-telkomsat-red shadow-sm hover:bg-telkomsat-gray-lighter/40"
              >
                Muat lagi
              </button>
            ) : null}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
