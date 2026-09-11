import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { isGuestUploadFolder, verifyFirebaseIdToken } from "@/lib/server/verifyFirebaseToken";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { UserRole } from "@/types";
import { rateLimit, getClientIp } from "@/lib/server/rateLimiter";
import {
  badRequestResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from "@/lib/server/apiResponse";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Magic-byte signatures ────────────────────────────────────────────────────

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  switch (mimeType) {
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    case "image/png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );

    case "image/gif":
      // GIF87a or GIF89a — check all 6 header bytes
      return (
        buffer[0] === 0x47 && // G
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x38 && // 8
        (buffer[4] === 0x37 || buffer[4] === 0x39) && // 7 or 9
        buffer[5] === 0x61   // a
      );

    case "image/webp":
      return (
        buffer[0] === 0x52 && // R
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x46 && // F
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50   // P
      );

    default:
      return false;
  }
}

// ─── Authorization ────────────────────────────────────────────────────────────

interface AuthorizeResult {
  ok: boolean;
  folder?: string;
  uid?: string;
  status?: number;
  message?: string;
}

async function authorizeUpload(request: NextRequest, requestedFolder: string): Promise<AuthorizeResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const user = await verifyFirebaseIdToken(token);
    if (!user) {
      return { ok: false, status: 401, message: "Token tidak valid" };
    }

    const userSnap = await adminDb().collection("users").doc(user.uid).get();
    const role = userSnap.data()?.role as UserRole | undefined;
    if (!role) {
      return { ok: false, status: 403, message: "Akses ditolak" };
    }

    return {
      ok: true,
      folder: `inventaris-sparepart/${role}`,
      uid: user.uid,
    };
  }

  // Guest upload — only to explicitly allowed folder prefixes
  if (isGuestUploadFolder(requestedFolder)) {
    return { ok: true, folder: "inventaris-sparepart/guest" };
  }

  return { ok: false, status: 401, message: "Login diperlukan untuk upload ke folder ini" };
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit: 20 uploads per minute per IP
  const rl = rateLimit(`upload:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "inventaris-sparepart/guest";

    if (!file) return badRequestResponse("File tidak ditemukan");
    if (!ALLOWED_MIME_TYPES.has(file.type)) return badRequestResponse("Tipe file tidak didukung");
    if (file.size > MAX_FILE_SIZE) return badRequestResponse("Ukuran file maksimal 5MB");

    const auth = await authorizeUpload(request, folder);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.message ?? "Akses ditolak" },
        { status: auth.status ?? 403 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes against declared MIME type
    if (!validateMagicBytes(buffer, file.type)) {
      return badRequestResponse("Konten file tidak sesuai dengan tipe yang dideklarasikan");
    }

    const base64 = buffer.toString("base64");
    const dataURI = `data:${file.type};base64,${base64}`;

    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader.upload(
        dataURI,
        {
          folder: auth.folder,
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (error, uploadResult) => {
          if (error) reject(error);
          else if (uploadResult) resolve(uploadResult);
          else reject(new Error("Upload gagal"));
        }
      );
    });

    return successResponse({ url: result.secure_url, publicId: result.public_id });
  } catch (error: unknown) {
    return serverErrorResponse(error, "Gagal upload gambar");
  }
}

// ─── DELETE /api/upload ───────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  // Rate limit: 30 deletions per minute per IP
  const rl = rateLimit(`delete-upload:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ success: false, error: "Terlalu banyak permintaan." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return unauthorizedResponse();

    const user = await verifyFirebaseIdToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: "Token tidak valid" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get("publicId");

    if (!publicId) return badRequestResponse("publicId wajib diisi");

    // ─── Ownership check ──────────────────────────────────────────────────────
    // Verify the publicId folder prefix matches the requesting user's role.
    // This prevents one user from deleting another user's uploads.
    const userSnap = await adminDb().collection("users").doc(user.uid).get();
    const role = userSnap.data()?.role as UserRole | undefined;

    if (!role) {
      return NextResponse.json({ success: false, error: "Akses ditolak" }, { status: 403 });
    }

    const allowedPrefixes = [
      `inventaris-sparepart/${role}/`,
      "inventaris-sparepart/guest/", // admin can clean up guest uploads
    ];

    const isOwner = allowedPrefixes.some((prefix) => publicId.startsWith(prefix));

    // Admin can delete any file under inventaris-sparepart/
    const isAdmin = role === "admin";
    const isUnderAppFolder = publicId.startsWith("inventaris-sparepart/");

    if (!isAdmin && !isOwner) {
      if (!isUnderAppFolder) {
        return NextResponse.json(
          { success: false, error: "Tidak diizinkan menghapus file ini" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Tidak diizinkan menghapus file milik user lain" },
        { status: 403 }
      );
    }

    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return successResponse();
  } catch (error: unknown) {
    return serverErrorResponse(error, "Gagal menghapus gambar");
  }
}
