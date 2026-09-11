import jsPDF from "jspdf";

export const A4_PORTRAIT_MM = { w: 210, h: 297 };
export const PDF_RED: [number, number, number] = [227, 30, 36];
export const PDF_SLATE: [number, number, number] = [71, 85, 105];

export function formatIdDateTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatIdDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function generateDocNumber(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(now.getTime()).slice(-5);
  return `${prefix}/${y}${m}${d}/${seq}`;
}

export async function tryAddLogo(
  doc: jsPDF,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bases = [window.location.origin];
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (envBase && !bases.includes(envBase)) bases.push(envBase);

  for (const base of bases) {
    try {
      // The 32px ODF icon is intended for small UI icons, not printed documents.
      const res = await fetch(`${base}/logo/logo.png`);
      if (!res.ok) continue;
      const image = new Uint8Array(await res.arrayBuffer());
      const { width, height } = doc.getImageProperties(image);
      if (width <= 0 || height <= 0 || maxW <= 0 || maxH <= 0) continue;
      const scale = Math.min(maxW / width, maxH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      doc.addImage(
        image, "PNG",
        x + (maxW - drawW) / 2, y + (maxH - drawH) / 2,
        drawW, drawH
      );
      return true;
    } catch {
      /* next */
    }
  }
  return false;
}

export function drawPdfTopBar(doc: jsPDF, pageW: number) {
  doc.setFillColor(...PDF_RED);
  doc.rect(0, 0, pageW, 3.5, "F");
}
