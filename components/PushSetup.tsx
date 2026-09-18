"use client";
import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { enablePush } from "@/lib/firebase/push";
import { useAuthLoading } from "./AuthProvider";

const DISMISSED_STORAGE_KEY = "telkomsat-push-dismissed";
const PUSH_TOKEN_STORAGE_KEY = "telkomsat-push-token";

export default function PushSetup() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthLoading();
  const uid = user?.id;

  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDismissed =
      typeof window !== "undefined" &&
      localStorage.getItem(DISMISSED_STORAGE_KEY) === "true";
    const alreadyAllowed =
      typeof window !== "undefined" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";
    const alreadyEnabled =
      typeof window !== "undefined" &&
      !!localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    const isAndroidBridge =
      typeof window !== "undefined" && !!window.TelkomsatPush;

    if (isDismissed) {
      setDismissed(true);
    }
    if (alreadyAllowed || alreadyEnabled || isAndroidBridge) {
      setReady(true);
    }

    if (!uid || authLoading) return;

    let active = true;
    void enablePush(false)
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active && (alreadyAllowed || alreadyEnabled || isAndroidBridge)) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [uid, authLoading]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    } catch {
      // Ignored
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    setError("");
    // Tandai agar tidak memunculkan popup lagi
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    } catch {
      // Ignored
    }
    try {
      await enablePush(true);
      setReady(true);
    } catch (e) {
      // Jika izin di browser sudah granted, tetap tandai ready agar popup tidak mengganggu
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        setReady(true);
      } else {
        setError(
          e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi"
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (
    !mounted ||
    !user ||
    authLoading ||
    ready ||
    dismissed ||
    (typeof Notification !== "undefined" &&
      Notification.permission !== "default") ||
    (typeof window !== "undefined" &&
      (!!localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) ||
        localStorage.getItem(DISMISSED_STORAGE_KEY) === "true" ||
        !!window.TelkomsatPush))
  ) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-white/15 bg-slate-900/95 backdrop-blur-xl p-4 text-white shadow-2xl animate-slide-up"
      aria-label="Pengaturan notifikasi"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <BellRing className="h-6 w-6 shrink-0 text-telkomsat-red" />
          <div>
            <p className="font-semibold text-sm">Terima pemberitahuan langsung</p>
            <p className="mt-1 text-xs text-slate-300">
              Aktifkan notifikasi untuk menerima pembaruan status transaksi dan barang inventaris.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors flex-shrink-0"
          aria-label="Tutup pesan notifikasi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-telkomsat-red hover:bg-telkomsat-red-dark px-4 py-2 text-xs font-bold text-white transition-all shadow-md shadow-red-600/30 disabled:opacity-50"
          onClick={handleEnable}
        >
          {busy ? "Mengaktifkan…" : "Aktifkan Notifikasi"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-2 text-xs text-slate-300 hover:text-white transition-colors"
        >
          Nanti Saja
        </button>
      </div>
    </aside>
  );
}
