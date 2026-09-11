import jsPDF from "jspdf";
import { TELKOMSAT_FOOTER_LINES } from "@/lib/constants/beritaAcara";
import { tryAddLogo, PDF_SLATE } from "./pdfShared";

export function formatHariTanggalId(d: Date): string {
  const hari = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
  const tgl = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
  return `${hari} / ${tgl}`;
}

/** Label + garis titik-titik (nilai diisi jika ada) */
export function drawDottedField(
  doc: jsPDF,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  labelW: number,
  lineW: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(label, x, y);

  const lineX = x + labelW;
  const display = value?.trim() || "";

  if (display) {
    doc.text(display, lineX + 1, y);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(lineX, y + 0.8, lineX + lineW, y + 0.8);
    doc.setLineDashPattern([], 0);
  } else {
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([0.6, 0.6], 0);
    doc.line(lineX, y + 0.8, lineX + lineW, y + 0.8);
    doc.setLineDashPattern([], 0);
  }
}

export function drawCheckbox(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  checked: boolean,
  label: string
) {
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.25);
  doc.rect(x, y - size + 0.5, size, size);
  if (checked) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size + 1);
    doc.text("✓", x + 0.4, y + 0.3);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(label, x + size + 1.5, y);
}

export async function drawBaHeader(
  doc: jsPDF,
  margin: { left: number; right: number; top: number },
  pageW: number,
  title: string,
  showPmCm: boolean,
  tipeMaintenance?: "PM" | "CM" | ""
) {
  await tryAddLogo(doc, margin.left, margin.top - 3, 44, 18);
  const titleY = margin.top + 19;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(title, pageW / 2, titleY, { align: "center" });

  if (showPmCm) {
    const boxY = titleY + 6;
    const cx = pageW / 2 - 18;
    drawCheckbox(doc, cx, boxY, 3.5, tipeMaintenance === "PM", "PM");
    drawCheckbox(doc, cx + 22, boxY, 3.5, tipeMaintenance === "CM", "CM");
  }

  return titleY + (showPmCm ? 12 : 6);
}

export function drawTelkomsatFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: { left: number; right: number; bottom: number },
  pageNum: number,
  totalPages: number,
  formCode: string,
  formRev: string
) {
  const footerTop = pageH - margin.bottom - 22;
  doc.setFontSize(5.5);
  doc.setTextColor(...PDF_SLATE);
  let fy = footerTop;
  TELKOMSAT_FOOTER_LINES.forEach((line) => {
    doc.text(line, pageW / 2, fy, { align: "center", maxWidth: pageW - margin.left - margin.right });
    fy += 3.2;
  });

  doc.setFontSize(7);
  doc.text(
    `Hal. ${pageNum} dari ${totalPages}`,
    pageW - margin.right,
    pageH - margin.bottom + 2,
    { align: "right" }
  );
  doc.text(
    `${formCode}, Rev:${formRev}`,
    pageW - margin.right,
    pageH - margin.bottom + 6,
    { align: "right" }
  );
}

export async function drawLaporanHeader(
  doc: jsPDF,
  margin: { left: number; right: number; top: number },
  pageW: number,
  title: string
) {
  await tryAddLogo(doc, margin.left, margin.top - 3, 44, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("BAKTI", pageW - margin.right, margin.top + 5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(title, pageW / 2, margin.top + 19, { align: "center" });

  return margin.top + 25;
}
