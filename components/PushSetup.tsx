"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { enablePush } from "@/lib/firebase/push";
import { useAuthLoading } from "./AuthProvider";

export default function PushSetup() {
  const user = useAuthStore(state => state.user);
  const authLoading = useAuthLoading();
  const uid = user?.id;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!uid || authLoading) return;
    let active = true;
    void enablePush(false).then(() => { if (active) setReady(true); }).catch(() => {});
    return () => { active = false; };
  }, [uid, authLoading]);
  if (!user || authLoading || ready || dismissed) return null;
  return <aside className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-white/15 bg-slate-900 p-4 text-white shadow-xl" aria-label="Pengaturan notifikasi">
    <div className="flex gap-3"><BellRing className="h-6 w-6 shrink-0 text-red-400" /><div>
      <p className="font-semibold">Terima pemberitahuan langsung</p>
      <p className="mt-1 text-sm text-slate-300">Aktifkan notifikasi untuk menerima pembaruan saat aplikasi tidak dibuka.</p>
    </div></div>
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    <div className="mt-3 flex gap-2"><button disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={async () => {
      setBusy(true); setError("");
      try { await enablePush(); setReady(true); }
      catch (e) { setError(e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi"); }
      finally { setBusy(false); }
    }}>{busy ? "Mengaktifkan…" : "Aktifkan notifikasi"}</button>
    <button onClick={() => setDismissed(true)} className="px-3 py-2 text-sm text-slate-300">Nanti</button></div>
  </aside>;
}
