import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_PUBLIC_BASE_URL = "https://tsatspare.netlify.app";

function publicHttpsOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // QR labels are shared across devices, so local development addresses must
    // never become their destination (including a stale production env value).
    const localHost =
      !host.includes(".") || host.endsWith(".localhost") || host.endsWith(".local") ||
      /^(?:0|10|127)\./.test(host) || /^169\.254\./.test(host) ||
      /^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith("[");
    if (url.protocol !== "https:" || url.username || url.password || localHost) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Public, shareable origin. Internal navigation should continue using relative URLs. */
export function getPublicBaseUrl(): string {
  return publicHttpsOrigin(process.env.NEXT_PUBLIC_BASE_URL)
    || publicHttpsOrigin(typeof window !== "undefined" ? window.location.origin : undefined)
    || DEFAULT_PUBLIC_BASE_URL;
}

/** Rebuild from the document ID rather than trusting historical qrCodeUrl values. */
export function generateQRCodeUrl(sparepartId: string): string {
  return `${getPublicBaseUrl()}/scan/${encodeURIComponent(sparepartId)}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function generateSessionToken(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

