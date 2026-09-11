import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { tryAddLogo } from "./pdfShared";
import type { Transaksi, JenisTransaksi } from "@/types";
import { formatDate } from "@/lib/utils";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionLocation,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";

const RED: [number, number, number] = [227, 30, 36];
const RED_DARK: [number, number, number] = [185, 28, 34];
const SLATE: [number, number, number] = [71, 85, 105];
const SLATE_LIGHT: [number, number, number] = [148, 163, 184];
const PAGE_BG: [number, number, number] = [248, 250, 252];

export interface LaporanPdfFilters {
  startDate: string;
  endDate: string;
  jenisTransaksi?: JenisTransaksi;
  namaTeknisi?: string;
}

export interface LaporanPdfStats {
  move: number;
  damage: number;
  return: number;
  total: number;
}

function jenisLabel(j: string): string {
  const m: Record<string, string> = {
    MOVE: "Pindah",
    DAMAGE: "Rusak",
    RETURN: "Kembali",
    FOUND: "Ditemukan",
    DISMANTLE: "Dismantle",
  };
  return m[j] || j;
}

function filterDeskripsi(f: LaporanPdfFilters): string {
  const p: string[] = [];
  p.push(`Periode ${f.startDate} s/d ${f.endDate}`);
  if (f.jenisTransaksi) p.push(`Jenis: ${jenisLabel(f.jenisTransaksi)}`);
  if (f.namaTeknisi) p.push(`Dibawa/ditemukan oleh: ${f.namaTeknisi}`);
  return p.join(" · ");
}

function sparepartCell(t: Transaksi, names: Record<string, string>): string {
  const base = names[t.idSparepart] || t.namaItem || "—";
  const sn = t.serialNumber?.trim();
  return sn ? `${base}\nSN: ${sn}` : base;
}

function sparepartCellComplete(t: Transaksi, names: Record<string, string>): string {
  const lines = getTransactionSparepartLines(t);
  const base = names[t.idSparepart] || lines.name || "-";
  return `${base}\nSN: ${lines.serialNumber}\nTagging: ${lines.tagging}`;
}

function jenisBadgeStyle(
  j: Transaksi["jenisTransaksi"]
): { fill: [number, number, number]; text: [number, number, number] } {
  switch (j) {
    case "MOVE":
      return { fill: [219, 234, 254], text: [29, 78, 216] };
    case "DAMAGE":
      return { fill: [254, 226, 226], text: [185, 28, 28] };
    case "RETURN":
      return { fill: [220, 252, 231], text: [22, 101, 52] };
    case "FOUND":
      return { fill: [209, 250, 229], text: [6, 95, 70] };
    case "DISMANTLE":
      return { fill: [255, 237, 213], text: [194, 65, 12] };
    default:
      return { fill: [241, 245, 249], text: [71, 85, 105] };
  }
}

function statusBadgeStyle(
  s: Transaksi["statusBarang"]
): { fill: [number, number, number]; text: [number, number, number] } {
  switch (s) {
    case "Normal":
      return { fill: [220, 252, 231], text: [22, 101, 52] };
    case "Rusak":
      return { fill: [254, 226, 226], text: [185, 28, 28] };
    case "Hilang":
      return { fill: [243, 244, 246], text: [75, 85, 99] };
    default:
      return { fill: [241, 245, 249], text: [71, 85, 105] };
  }
}

/** Fallback logo vektor jika file PNG tidak termuat */
function drawFallbackLogo(doc: jsPDF, x: number, y: number, size: number) {
  const r = size * 0.42;
  const cx = x + r;
  const cy = y + r;
  doc.setFillColor(...RED);
  doc.circle(cx, cy, r, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.35);
  doc.circle(cx, cy, r - 0.4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 1.35);
  doc.setTextColor(255, 255, 255);
  doc.text("TS", cx, cy + 1.3, { align: "center", baseline: "middle" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...RED_DARK);
  doc.text("telkom", x + size * 0.95, y + r * 0.55, { baseline: "middle" });
  doc.setTextColor(...RED);
  doc.text("sat", x + size * 0.95 + doc.getTextWidth("telkom"), y + r * 0.55, { baseline: "middle" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...SLATE);
  doc.text("Regional 6", x + size * 0.95, y + r * 1.35);
}

function addFooter(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(12, h - 14, w - 12, h - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Dicetak: ${new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date())}`,
      12,
      h - 8
    );
    doc.text(`Halaman ${i} / ${n}`, w - 12, h - 8, { align: "right" });
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Dokumen laporan sistem inventaris — bersifat internal", w / 2, h - 8, { align: "center" });
  }
}

function drawStatCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: [number, number, number]
) {
  const shadow = 0.45;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(x + shadow, y + shadow, w, h, 2.2, 2.2, "F");
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");
  doc.setDrawColor(...accent);
  doc.setLineWidth(1.1);
  doc.line(x, y + 1.1, x, y + h - 1.1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...accent);
  doc.text(value, x + 4.5, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...SLATE);
  const lines = doc.splitTextToSize(label, w - 8);
  doc.text(lines, x + 4.5, y + 15.5);
}

function drawPageFrame(doc: jsPDF, pageW: number, pageH: number) {
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, pageW, pageH, "F");
}

export async function downloadLaporanTransaksiPdf(params: {
  transactions: Transaksi[];
  sparepartNames: Record<string, string>;
  filters: LaporanPdfFilters;
  stats: LaporanPdfStats;
}): Promise<void> {
  const { transactions, sparepartNames, filters, stats } = params;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  drawPageFrame(doc, pageW, pageH);

  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 7, "F");
  doc.setFillColor(...RED_DARK);
  doc.rect(0, 7, pageW, 0.9, "F");

  const headerTop = 12;
  const headerH = 28;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, headerTop, pageW - 2 * margin, headerH, 3, 3, "FD");

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 226, 226);
  doc.roundedRect(pageW - margin - 54, headerTop + 4, 50, headerH - 8, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...RED);
  doc.text("INVENTARIS", pageW - margin - 29, headerTop + 12, { align: "center" });
  doc.setFontSize(8);
  doc.text("SPAREPART", pageW - margin - 29, headerTop + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text("Regional 6", pageW - margin - 29, headerTop + 24, { align: "center" });

  const logoBoxX = margin + 5;
  const logoBoxY = headerTop + 5;
  const logoW = 28;
  const logoH = 12;
  const hasLogo = await tryAddLogo(doc, logoBoxX, logoBoxY, logoW, logoH);
  if (!hasLogo) {
    drawFallbackLogo(doc, logoBoxX, logoBoxY - 1, 14);
  }

  const titleX = margin + (hasLogo ? logoW + 12 : 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(30, 41, 59);
  doc.text("LAPORAN TRANSAKSI SPAREPART", titleX, headerTop + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...SLATE);
  doc.text("Telkomsat Regional 6 · Sistem Inventaris QR", titleX, headerTop + 17);

  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LIGHT);
  const sub = filterDeskripsi(filters);
  const subLines = doc.splitTextToSize(sub, pageW - titleX - margin - 8);
  doc.text(subLines, titleX, headerTop + 22.5);

  const statY = headerTop + headerH + 5;
  const gap = 3.2;
  const statW = (pageW - 2 * margin - 3 * gap) / 4;
  const statCardH = 19;

  drawStatCard(doc, margin, statY, statW, statCardH, "Total transaksi", String(stats.total), [71, 85, 105]);
  drawStatCard(
    doc,
    margin + statW + gap,
    statY,
    statW,
    statCardH,
    "Barang dipindahkan (MOVE)",
    String(stats.move),
    [37, 99, 235]
  );
  drawStatCard(
    doc,
    margin + 2 * (statW + gap),
    statY,
    statW,
    statCardH,
    "Barang rusak (DAMAGE)",
    String(stats.damage),
    RED
  );
  drawStatCard(
    doc,
    margin + 3 * (statW + gap),
    statY,
    statW,
    statCardH,
    "Barang dikembalikan (RETURN)",
    String(stats.return),
    [22, 163, 74]
  );

  const tableStartY = statY + statCardH + 7;

  const head = [
    [
      "No",
      "Tanggal",
      "Sparepart / Item",
      "Dibawa / Ditemukan Oleh",
      "Disetujui Oleh",
      "Jenis",
      "Lokasi",
      "Status",
    ],
  ];

  const body = transactions.map((t, i) => [
    String(i + 1),
    formatDate(t.createdAt),
    sparepartCellComplete(t, sparepartNames),
    getCarriedBy(t),
    getApprovedBy(t),
    jenisLabel(t.jenisTransaksi),
    getTransactionLocation(t),
    t.statusBarang || "—",
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    margin: { left: margin, right: margin, top: margin },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.2, right: 2.2 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: "middle",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: RED,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.8,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2, right: 2 },
    },
    alternateRowStyles: { fillColor: [252, 253, 255] },
    columnStyles: {
      0: { halign: "center", cellWidth: 11 },
      1: { cellWidth: 30 },
      2: { cellWidth: 55 },
      3: { cellWidth: 36 },
      4: { cellWidth: 34 },
      5: { halign: "center", cellWidth: 23 },
      6: { cellWidth: 37 },
      7: { halign: "center", cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rowIdx = data.row.index;
      const t = transactions[rowIdx];
      if (!t) return;
      if (data.column.index === 5) {
        const { fill, text } = jenisBadgeStyle(t.jenisTransaksi);
        data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = text;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7.8;
      }
      if (data.column.index === 7) {
        const { fill, text } = statusBadgeStyle(t.statusBarang);
        data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = text;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7.8;
      }
    },
    willDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        doc.setFillColor(...PAGE_BG);
        doc.rect(0, 0, pageW, pageH, "F");
        doc.setFillColor(...RED);
        doc.rect(0, 0, pageW, 3.5, "F");
      }
    },
  });

  addFooter(doc);

  const fname = `laporan-transaksi_${filters.startDate}_${filters.endDate}.pdf`;
  doc.save(fname);
}


