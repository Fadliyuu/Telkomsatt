/**
 * Utility functions for Cloudinary image upload
 */

import { auth } from "@/lib/firebase/config";

const GUEST_FOLDER = "inventaris-sparepart/guest";

async function getUploadHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function resolveFolder(folder: string): string {
  if (auth.currentUser) return "inventaris-sparepart/authenticated";
  if (isGuestUploadFolder(folder)) return folder;
  return GUEST_FOLDER;
}

function isGuestUploadFolder(folder: string): boolean {
  const normalized = folder.replace(/^\/+/, "");
  return (
    normalized === "guest" ||
    normalized.startsWith("guest/") ||
    normalized.startsWith("transaksi-guest") ||
    normalized.startsWith("inventaris-sparepart/guest")
  );
}

export const uploadImage = async (
  file: File,
  folder: string = GUEST_FOLDER
): Promise<{ url: string; publicId: string }> => {
  const uploadFolder = resolveFolder(folder);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", uploadFolder);

  const response = await fetch("/api/upload", {
    method: "POST",
    headers: await getUploadHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload image");
  }

  const data = await response.json();
  return {
    url: data.url,
    publicId: data.publicId,
  };
};

export const deleteImage = async (publicId: string): Promise<void> => {
  const headers = await getUploadHeaders();
  if (!("Authorization" in headers)) {
    throw new Error("Login diperlukan untuk menghapus gambar");
  }

  const response = await fetch(
    `/api/upload?publicId=${encodeURIComponent(publicId)}`,
    { method: "DELETE", headers }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete image");
  }
};

export const getCloudinaryUrl = (
  url: string,
  options?: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  }
): string => {
  if (!url) return url;

  if (url.includes("cloudinary.com")) {
    const parts = url.split("/upload/");
    if (parts.length === 2) {
      const transformations: string[] = [];

      if (options?.width) transformations.push(`w_${options.width}`);
      if (options?.height) transformations.push(`h_${options.height}`);
      if (options?.quality) transformations.push(`q_${options.quality}`);
      if (options?.format) transformations.push(`f_${options.format}`);

      const transformStr =
        transformations.length > 0 ? `${transformations.join(",")}/` : "";

      return `${parts[0]}/upload/${transformStr}${parts[1]}`;
    }
  }

  return url;
};
