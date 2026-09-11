"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCircle2, RefreshCw } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import {
  getNotificationsForUser,
  markNotificationRead,
  subscribeNotificationsForUser,
} from "@/lib/firebase/notifications";
import { AppNotification, User } from "@/types";
import { enablePush } from "@/lib/firebase/push";
import { formatDate } from "@/lib/utils";

export default function NotificationBell({ user }: { user: User }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<NotificationPermission>("default");
  const browserNotificationsSupported =
    typeof window !== "undefined" && "Notification" in window;

  const unread = useMemo(
    () => items.filter((item) => !(item.readBy || []).includes(user.id)).length,
    [items, user.id]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getNotificationsForUser(user);
      setItems(rows);
    } catch (error) {
      console.warn("Gagal memuat notifikasi:", error);
      setError("Gagal memuat notifikasi");
    } finally {
      setLoading(false);
    }
  };

  const requestBrowserNotificationPermission = async () => {
    if (!browserNotificationsSupported) {
      setError("Browser tidak mendukung notifikasi desktop");
      return;
    }

    try {
      await enablePush();
      setBrowserNotificationPermission(Notification.permission);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi"); }
  };


  useEffect(() => {
    if (browserNotificationsSupported) {
      setBrowserNotificationPermission(Notification.permission);
    }
  }, [browserNotificationsSupported]);

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe = subscribeNotificationsForUser(
      user,
      (rows) => {

        setItems(rows);
        setLoading(false);
        setError("");
      },
      (error) => {
        console.warn("Gagal memuat notifikasi:", error);
        setError("Gagal memuat notifikasi");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const markRead = async (notification: AppNotification) => {
    if ((notification.readBy || []).includes(user.id)) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, readBy: Array.from(new Set([...(item.readBy || []), user.id])) }
          : item
      )
    );
    try {
      await markNotificationRead(notification, user.id);
    } catch (error) {
      console.warn("Gagal menandai notifikasi:", error);
      load();
    }
  };

  const markAllRead = async () => {
    const unreadItems = items.filter((item) => !(item.readBy || []).includes(user.id));
    if (unreadItems.length === 0) return;

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        readBy: Array.from(new Set([...(item.readBy || []), user.id])),
      }))
    );

    try {
      await Promise.all(unreadItems.map((item) => markNotificationRead(item, user.id)));
    } catch (error) {
      console.warn("Gagal menandai semua notifikasi:", error);
      load();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`relative rounded-xl border border-telkomsat-gray-lighter/70 bg-white/80 p-2.5 text-telkomsat-black shadow-sm transition hover:bg-white ${
          open ? "scale-105 text-telkomsat-red" : ""
        }`}
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-telkomsat-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[70] w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-white shadow-2xl animate-scale-in">
          <div className="flex items-center justify-between border-b border-telkomsat-gray-lighter px-4 py-3">
            <div>
              <p className="font-bold text-telkomsat-black">Notifikasi</p>
              {unread > 0 && (
                <p className="text-[11px] text-telkomsat-gray">
                  {unread} belum dibaca
                </p>
              )}
              {browserNotificationsSupported && browserNotificationPermission === "granted" && (
                <p className="text-[11px] text-emerald-600">
                  Notifikasi browser aktif
                </p>
              )}
              {browserNotificationsSupported && browserNotificationPermission === "denied" && (
                <p className="text-[11px] text-telkomsat-red">
                  Izin browser diblokir
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {browserNotificationsSupported && browserNotificationPermission === "default" && (
                <button
                  type="button"
                  onClick={requestBrowserNotificationPermission}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-telkomsat-red transition hover:bg-red-100"
                  title="Izinkan notifikasi browser"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Izinkan
                </button>
              )}
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold text-telkomsat-red"
                >
                  Tandai semua
                </button>
              )}
              <button
                type="button"
                onClick={load}
                className="rounded-lg p-1.5 text-telkomsat-red transition hover:bg-red-50"
                aria-label="Muat ulang notifikasi"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-telkomsat-black">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 text-sm font-semibold text-telkomsat-red"
                >
                  Coba lagi
                </button>
              </div>
            ) : loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-telkomsat-gray">
                Memuat notifikasi...
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-telkomsat-gray">
                Belum ada notifikasi
              </p>
            ) : (
              items.map((item) => {
                const isUnread = !(item.readBy || []).includes(user.id);
                const content = (
                  <div
                    className={`border-b border-telkomsat-gray-lighter px-4 py-3 transition hover:bg-telkomsat-gray-lighter/40 ${
                      isUnread ? "bg-red-50/50" : "bg-white"
                    }`}
                    onClick={() => markRead(item)}
                  >
                    <div className="flex items-start gap-2">
                      <UserAvatar
                        name={item.actorName}
                        src={item.actorPhotoUrl}
                        size="sm"
                        className={isUnread ? "ring-2 ring-telkomsat-red/20" : ""}
                      />
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5">
                          <p className="text-sm font-bold text-telkomsat-black">
                            {item.title}
                          </p>
                          <CheckCircle2
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              isUnread ? "text-telkomsat-red" : "text-telkomsat-gray"
                            }`}
                          />
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-telkomsat-gray">
                          {item.message}
                        </p>
                        {item.details && item.details.length > 0 && (
                          <div className="mt-2 rounded-lg bg-white/70 border border-telkomsat-gray-lighter px-3 py-2">
                            <p className="text-[11px] font-bold text-telkomsat-black mb-1">
                              Detail item
                            </p>
                            <ul className="space-y-1">
                              {item.details.map((detail, detailIndex) => (
                                <li
                                  key={`${item.id}-${detailIndex}`}
                                  className="text-[11px] leading-relaxed text-telkomsat-gray"
                                >
                                  {detailIndex + 1}. {detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="mt-2 text-[11px] text-telkomsat-gray">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                return item.link ? (
                  <Link key={item.id} href={item.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
