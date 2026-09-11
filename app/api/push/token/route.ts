import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { pushUser } from "@/lib/server/pushAuth";
import { validPushSubscription } from "@/lib/server/webPush";

async function handle(request: NextRequest, remove: boolean) {
  let user;
  try { user = await pushUser(request); }
  catch { return NextResponse.json({ error: "Silakan login kembali" }, { status: 401 }); }
  const parsed = await request.json().catch(() => null);
  const body = parsed && typeof parsed === "object" ? parsed : {};
  const web = validPushSubscription(body.subscription);
  const token = web ? body.subscription.endpoint : body.token;
  if (typeof token !== "string" || token.length < 20 || token.length > 4096 || (body.subscription && !web)) {
    return NextResponse.json({ error: "Token perangkat tidak valid" }, { status: 400 });
  }
  const ref = adminDb().collection("push_tokens").doc(createHash("sha256").update(token).digest("hex"));
  if (remove) {
    await adminDb().runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.data()?.uid === user.uid) tx.delete(ref);
    });
  } else {
    await ref.set({ token, uid: user.uid, updatedAt: new Date(),
      ...(web ? { subscription: { endpoint: token, keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth } } } : {}) });
  }
  return NextResponse.json({ success: true });
}
export const POST = (request: NextRequest) => handle(request, false);
export const DELETE = (request: NextRequest) => handle(request, true);
