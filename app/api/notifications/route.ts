import { NextRequest, NextResponse } from "next/server";
import { getMessaging } from "firebase-admin/messaging";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { pushUser } from "@/lib/server/pushAuth";
import { rateLimit } from "@/lib/server/rateLimiter";
import { sendWebPush } from "@/lib/server/webPush";

export async function POST(request: NextRequest) {
  let actor;
  try { actor = await pushUser(request); }
  catch { return NextResponse.json({ error: "Silakan login kembali" }, { status: 401 }); }
  if (!rateLimit(`notifications:${actor.uid}`, { limit: 60, windowMs: 60000 }).allowed) {
    return NextResponse.json({ error: "Terlalu banyak notifikasi" }, { status: 429 });
  }
  const parsed = await request.json().catch(() => null);
  const data = parsed && typeof parsed === "object" ? parsed : {};
  if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 200 ||
      typeof data.message !== "string" || data.message.length > 2000) {
    return NextResponse.json({ error: "Notifikasi tidak valid" }, { status: 400 });
  }
  const roles = Array.isArray(data.targetRoles) ? data.targetRoles.filter((v: unknown) => typeof v === "string").slice(0, 20) : [];
  const uids = Array.isArray(data.targetUids) ? data.targetUids.filter((v: unknown) => typeof v === "string").slice(0, 100) : [];
  const link = typeof data.link === "string" && /^\/(?!\/)/.test(data.link) && !data.link.includes("\\") ? data.link : "/";
  const db = adminDb();
  const ref = await db.collection("notifications").add({
    title: data.title, message: data.message, link,
    actorUid: actor.uid, actorName: actor.nama, actorRole: actor.role,
    targetRoles: roles, targetUids: uids, readBy: [], createdAt: new Date(),
    type: typeof data.type === "string" ? data.type : "system",
    details: Array.isArray(data.details) ? data.details.filter((v: unknown) => typeof v === "string").slice(0, 100) : [],
  });
  // Persistence succeeds even if the push provider is temporarily unavailable.
  let pushDelivered = true;
  try {
    const users = await db.collection("users").where("status", "==", "aktif").get();
    const recipients = users.docs.filter(user => roles.includes(user.data().role) || uids.includes(user.id));
    const devices = (await Promise.all(recipients.map(user => db.collection("push_tokens").where("uid", "==", user.id).get()))).flatMap(snapshot => snapshot.docs);
    const browsers = devices.filter(device => device.data().subscription);
    for (let offset = 0; offset < browsers.length; offset += 20) {
      await Promise.all(browsers.slice(offset, offset + 20).map(async device => {
        try { await sendWebPush(device.data().subscription, { title: data.title, body: data.message.slice(0, 800), link, notificationId: ref.id }); }
        catch (error) {
          pushDelivered = false;
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await device.ref.delete();
          else console.error("Web push failed", error);
        }
      }));
    }
    const native = devices.filter(device => !device.data().subscription);
    for (let offset = 0; offset < native.length; offset += 500) {
      const chunk = native.slice(offset, offset + 500);
      const result = await getMessaging().sendEachForMulticast({
        tokens: chunk.map(device => device.data().token),
        notification: { title: data.title, body: data.message.slice(0, 800) },
        data: { link, notificationId: ref.id },
        android: { priority: "high", notification: { channelId: "inventory_updates", tag: ref.id } },
        webpush: { notification: { icon: "/logo/ODF.png", tag: ref.id, data: { link } } },
      });
      await Promise.all(result.responses.map(async (response, index) => {
        if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.error?.code || "")) await chunk[index].ref.delete();
        if (!response.success) pushDelivered = false;
      }));
    }
  } catch (error) { pushDelivered = false; console.error("Push delivery failed", error); }
  return NextResponse.json({ id: ref.id, pushDelivered });
}
