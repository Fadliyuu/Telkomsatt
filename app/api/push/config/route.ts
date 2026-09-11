import { NextRequest, NextResponse } from "next/server";
import { pushUser } from "@/lib/server/pushAuth";
import { webPushKeys } from "@/lib/server/webPush";

export async function GET(request: NextRequest) {
  try { await pushUser(request); }
  catch { return NextResponse.json({ error: "Silakan login kembali" }, { status: 401 }); }
  const { publicKey } = await webPushKeys();
  return NextResponse.json({ publicKey });
}
