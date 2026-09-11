import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AdminScanItem } from "@/lib/store/useAdminScanStore";
import {
  A4_PORTRAIT_MM,
  drawPdfTopBar,
  formatIdDate,
  formatIdDateTime,
  generateDocNumber,
  PDF_RED,
  PDF_SLATE,
  tryAddLogo,
} from "./pdfShared";

export interface SuratJalanPdfParams {
  nomor: string;
  namaTeknisi: string;
  jenisTeknisi?: string;
  lokasiTujuan: string;
  items: AdminScanItem[];
  adminName: string;
  adminRole?: string;
  keterangan?: string;
}

export async function downloadSuratJalanPdf(
  params: SuratJalanPdfParams
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [A4_PORTRAIT_MM.w, A4_PORTRAIT_MM.h],
    compress: true,
  });

  const margin = { left: 14, right: 14, top: 12, bottom: 16 };
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin.left - margin.right;

  drawPdfTopBar(doc, pageW);

  let y = margin.top;
  const hasLogo = await tryAddLogo(doc, margin.left, y, 22, 10);
  const textX = margin.left + (hasLogo ? 26 : 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("SURAT JALAN BARANG", textX, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_SLATE);
  doc.text("Telkomsat Regional 6 — Inventaris Sparepart", textX, y + 10);

  y += 16;

  doc.setFontSize(8);
  doc.text(`No. Dokumen: ${params.nomor}`, margin.left, y);
  doc.text(`Tanggal: ${formatIdDate(new Date())}`, pageW - margin.right, y, {
    align: "right",
  });
  y += 5;
  doc.text(`Teknisi Penerima: ${params.namaTeknisi}`, margin.left, y);
  if (params.jenisTeknisi) {
    doc.text(`(${params.jenisTeknisi})`, margin.left + 42, y);
  }
  y += 5;
  doc.text(`Lokasi Tujuan: ${params.lokasiTujuan}`, margin.left, y);
  y += 5;
  doc.text(`Diserahkan oleh: ${params.adminName}`, margin.left, y);
  y += 8;

  const moveItems = params.items.filter((i) => i.mode === "MOVE");
  const body = moveItems.map((item, idx) => [
    String(idx + 1),
    item.namaPerangkat,
    item.serialNumber || "—",
    item.tagging || "—",
    item.lokasiSaatIni || "Gudang",
    item.status || "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["No", "Nama Perangkat", "SN", "Tag", "Asal", "Kondisi"]],
    body: body.length ? body : [["—", "Tidak ada barang", "", "", "", ""]],
    tableWidth: contentW,
    margin,
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: {
      fillColor: PDF_RED,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 52 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 32 },
      5: { cellWidth: 22, halign: "center" },
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawPdfTopBar(doc, pageW);
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;

  let noteY = finalY + 6;
  if (params.keterangan?.trim()) {
    doc.setFontSize(8);
    doc.setTextColor(...PDF_SLATE);
    doc.text("Keterangan:", margin.left, noteY);
    noteY += 4;
    doc.text(doc.splitTextToSize(params.keterangan, contentW), margin.left, noteY);
    noteY += 10;
  }

  const signY = Math.min(noteY + 8, pageH - 42);
  doc.setFontSize(8);
  doc.text("Diserahkan oleh (Admin Gudang)", margin.left, signY);
  doc.text("Diterima oleh (Teknisi)", pageW / 2 + 8, signY);

  doc.line(margin.left, signY + 18, margin.left + 55, signY + 18);
  doc.line(pageW / 2 + 8, signY + 18, pageW / 2 + 63, signY + 18);

  doc.text(`(${params.adminName})`, margin.left, signY + 23);
  doc.text(`(${params.namaTeknisi})`, pageW / 2 + 8, signY + 23);

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Dicetak ${formatIdDateTime(new Date())} · A4 portrait`,
    pageW / 2,
    pageH - 8,
    { align: "center" }
  );

  doc.save(`surat-jalan_${params.nomor.replace(/\//g, "-")}.pdf`);
}

export function createSuratJalanNumber(): string {
  return generateDocNumber("SJ");
}
