import webpush from "web-push";
import { adminDb } from "./firebaseAdmin";

// One persistent key pair, never exposed through client Firestore rules.
export async function webPushKeys() {
  const db = adminDb();
  const ref = db.collection("push_config").doc("vapid");
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) return snapshot.data() as { publicKey: string; privateKey: string };
    const keys = webpush.generateVAPIDKeys();
    tx.set(ref, keys);
    return keys;
  });
}

export function validPushSubscription(value: unknown): value is webpush.PushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as webpush.PushSubscription;
  try {
    const url = new URL(subscription.endpoint);
    const host = url.hostname;
    const allowed = host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") || host === "web.push.apple.com" || host.endsWith(".notify.windows.com");
    return allowed && url.protocol === "https:" && !url.username && !url.password && !url.port &&
      subscription.endpoint.length < 4096 &&
      /^[A-Za-z0-9_-]{86,88}$/.test(subscription.keys?.p256dh || "") && /^[A-Za-z0-9_-]{22,24}$/.test(subscription.keys?.auth || "");
  } catch { return false; }
}

export async function sendWebPush(subscription: webpush.PushSubscription, payload: object) {
  if (!validPushSubscription(subscription)) throw new Error("Invalid push subscription");
  const keys = await webPushKeys();
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: { ...keys, subject: `mailto:${process.env.FIREBASE_CLIENT_EMAIL || "notifications@telkomsat.co.id"}` },
    TTL: 86400, urgency: "high", timeout: 10000,
  });
}
