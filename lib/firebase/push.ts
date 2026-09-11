import { auth } from "./config";

declare global {
  interface Window {
    TelkomsatPush?: { postMessage: (message: string) => void; onmessage: ((event: { data: string }) => void) | null };
  }
}
let token = "";


async function saveToken(value: string, method = "POST", subscription?: PushSubscriptionJSON) {
  const user = auth.currentUser;
  if (!user) throw new Error("Silakan login kembali");
  const response = await fetch("/api/push/token", {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ token: value, subscription }),
  });
  if (!response.ok) throw new Error("Gagal mendaftarkan notifikasi. Coba lagi.");
}

export async function enablePush(requestPermission = true) {
  let value: string;
  if (window.TelkomsatPush) {
    value = await new Promise<string>((resolve, reject) => {
      const bridge = window.TelkomsatPush!;
      const timeout = window.setTimeout(() => reject(new Error("Aktivasi notifikasi Android belum selesai. Coba lagi.")), 30000);
      bridge.onmessage = event => {
        clearTimeout(timeout);
        const result = JSON.parse(event.data);
        if (result.token) resolve(result.token); else reject(new Error(result.error || "Izinkan notifikasi di pengaturan aplikasi."));
      };
      bridge.postMessage(JSON.stringify({ action: requestPermission ? "enable" : "status" }));
    });
  } else {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Notifikasi belum didukung browser ini. Gunakan Chrome atau pasang aplikasi ke layar utama.");
    const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") throw new Error("Izinkan notifikasi melalui pengaturan situs untuk menerima pemberitahuan.");
    const user = auth.currentUser;
    if (!user) throw new Error("Silakan login kembali");
    const configResponse = await fetch("/api/push/config", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!configResponse.ok) throw new Error("Gagal menyiapkan notifikasi. Coba lagi.");
    const { publicKey } = await configResponse.json();
    const rawKey = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
    const applicationServerKey = Uint8Array.from(rawKey, character => character.charCodeAt(0));
    await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) throw new Error("Web Push belum didukung browser ini.");
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    value = subscription.endpoint;
    await saveToken(value, "POST", subscription.toJSON());
    token = value;
    localStorage.setItem("telkomsat-push-token", value);
    return;
  }
  if (!value) throw new Error("Token notifikasi belum tersedia. Coba lagi.");
  await saveToken(value);
  token = value;
  localStorage.setItem("telkomsat-push-token", value);
}

export async function disablePush() {
  const current = token || localStorage.getItem("telkomsat-push-token");
  if (current) await saveToken(current, "DELETE");
  token = "";
  localStorage.removeItem("telkomsat-push-token");
}
