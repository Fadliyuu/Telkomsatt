import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { tryAddLogo } from "./pdfShared";
import type { Transaksi } from "@/types";
import {
  ArahBarang,
  getArahBarang,
  getArahLabel,
  getGudangStats,
} from "@/lib/constants/transaksiReport";
import type { JenisTransaksi } from "@/types";
import type { LaporanFilters } from "@/lib/hooks/useLaporanTransaksi";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";

/** A4 portrait standar: 210 × 297 mm */
const A4_PORTRAIT_MM = { w: 210, h: 297 };

const RED: [number, number, number] = [227, 30, 36];
const RED_DARK: [number, number, number] = [185, 28, 34];
const SLATE: [number, number, number] = [71, 85, 105];
const SLATE_LIGHT: [number, number, number] = [148, 163, 184];
const PAGE_BG: [number, number, number] = [248, 250, 252];
const ORANGE: [number, number, number] = [234, 88, 12];
const EMERALD: [number, number, number] = [5, 150, 105];

const MARGIN = { top: 8, right: 12, bottom: 14, left: 12 };
const FOOTER_H = 12;

export interface LaporanGudangPdfMeta {
  exportedByName: string;
  exportedByEmail?: string;
  exportedByRole?: string;
}

function formatIdDateTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatIdDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso + "T12:00:00"));
  } catch {
    return iso;
  }
}

function drawPageFrame(doc: jsPDF, pageW: number, pageH: number) {
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, pageW, pageH, "F");
}

function drawTopBar(doc: jsPDF, pageW: number) {
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 4, "F");
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
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(x, y + 0.8, x, y + h - 0.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...accent);
  doc.text(value, x + 3, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(...SLATE);
  doc.text(doc.splitTextToSize(label, w - 6), x + 3, y + 10.5);
}

function arahBadgeStyle(arah: ArahBarang): {
  fill: [number, number, number];
  text: [number, number, number];
} {
  switch (arah) {
    case "keluar":
      return { fill: [255, 237, 213], text: [194, 65, 12] };
    case "masuk":
      return { fill: [209, 250, 229], text: [6, 95, 70] };
    default:
      return { fill: [241, 245, 249], text: [71, 85, 105] };
  }
}

function jenisBadgeStyle(
  j: JenisTransaksi
): { fill: [number, number, number]; text: [number, number, number] } {
  switch (j) {
    case "MOVE":
      return { fill: [219, 234, 254], text: [29, 78, 216] };
    case "RETURN":
      return { fill: [220, 252, 231], text: [22, 101, 52] };
    case "FOUND":
      return { fill: [209, 250, 229], text: [6, 95, 70] };
    case "DISMANTLE":
      return { fill: [255, 237, 213], text: [194, 65, 12] };
    case "DAMAGE":
      return { fill: [254, 226, 226], text: [185, 28, 28] };
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
    default:
      return { fill: [241, 245, 249], text: [71, 85, 105] };
  }
}

const JENIS_PDF_LABEL: Record<JenisTransaksi, string> = {
  OUT: "Keluar",
  MOVE: "Pindah",
  DAMAGE: "Rusak",
  RETURN: "Kembali",
  FOUND: "Ditemukan",
  DISMANTLE: "Dismantle",
};

function formatDatePdf(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function lokasiCell(value?: string): string {
  return value?.trim() || "—";
}

function sparepartCell(t: Transaksi, names: Record<string, string>): string {
  const base = names[t.idSparepart] || t.namaItem || "—";
  const sn = t.serialNumber?.trim();
  return sn ? `${base}\nSN: ${sn}` : base;
}

/** Nomor urut rapi di kolom No (1, 2, 3 …) */
function sparepartCellComplete(t: Transaksi, names: Record<string, string>): string {
  const lines = getTransactionSparepartLines(t);
  const base = names[t.idSparepart] || lines.name || "-";
  return `${base}\nSN: ${lines.serialNumber}\nTagging: ${lines.tagging}`;
}

function rowNumber(index: number): string {
  return String(index + 1);
}

function getTableLayout(contentWidth: number) {
  const col = {
    no: 7,
    tgl: 16,
    arah: 9,
    item: 34,
    teknisi: 22,
    jenis: 13,
    asal: 22,
    tujuan: 18,
    status: 9,
  };
  const fixed =
    col.no +
    col.tgl +
    col.arah +
    col.teknisi +
    col.jenis +
    col.asal +
    col.tujuan +
    col.status;
  col.item = Math.max(col.item, contentWidth - fixed);
  return { tableWidth: contentWidth, col };
}

function addFooter(
  doc: jsPDF,
  meta: LaporanGudangPdfMeta,
  pageW: number,
  pageH: number
) {
  const n = doc.getNumberOfPages();
  const roleLabel = meta.exportedByRole || "Admin Gudang";
  const exporter = meta.exportedByEmail
    ? `${meta.exportedByName} (${meta.exportedByEmail})`
    : meta.exportedByName;
  const footerY = pageH - MARGIN.bottom;

  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(MARGIN.left, footerY - 4, pageW - MARGIN.right, footerY - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Diekspor: ${exporter} · ${roleLabel}`,
      MARGIN.left,
      footerY
    );
    doc.text(
      `Dicetak ${formatIdDateTime(new Date())}`,
      MARGIN.left,
      footerY + 3.2
    );
    doc.text(
      `Halaman ${i} dari ${n}`,
      pageW - MARGIN.right,
      footerY + 1.5,
      { align: "right" }
    );
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `A4 portrait (${A4_PORTRAIT_MM.w}×${A4_PORTRAIT_MM.h} mm) · Telkomsat R6`,
      pageW / 2,
      footerY + 3.2,
      { align: "center" }
    );
  }
}

export async function downloadLaporanGudangPdf(params: {
  transactions: Transaksi[];
  sparepartNames: Record<string, string>;
  filters: LaporanFilters;
  activeTab: ArahBarang | "semua";
  meta: LaporanGudangPdfMeta;
}): Promise<void> {
  const { transactions, sparepartNames, filters, activeTab, meta } = params;
  const stats = getGudangStats(transactions);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [A4_PORTRAIT_MM.w, A4_PORTRAIT_MM.h],
    compress: true,
  });

  doc.setProperties({
    title: "Laporan Barang Masuk Keluar",
    subject: "Inventaris Sparepart Telkomsat Regional 6",
    creator: "Telkomsat Inventaris QR",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN.left - MARGIN.right;
  const { tableWidth, col } = getTableLayout(contentW);

  drawPageFrame(doc, pageW, pageH);
  drawTopBar(doc, pageW);

  let y = MARGIN.top + 2;

  const headerH = 20;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN.left, y, contentW, headerH, 2, 2, "FD");

  const logoY = y + 4;
  const hasLogo = await tryAddLogo(doc, MARGIN.left + 3, logoY, 18, 8);

  const textX = MARGIN.left + (hasLogo ? 24 : 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("LAPORAN BARANG MASUK & KELUAR", textX, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  const filterLine = [
    `Periode ${formatIdDateShort(filters.startDate)} – ${formatIdDateShort(filters.endDate)}`,
    activeTab === "semua" ? "Semua arah" : getArahLabel(activeTab),
    filters.namaTeknisi?.trim() ? `Teknisi: ${filters.namaTeknisi.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(doc.splitTextToSize(filterLine, contentW - (textX - MARGIN.left) - 50), textX, y + 12);

  const metaW = 48;
  const metaX = pageW - MARGIN.right - metaW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...RED_DARK);
  doc.text("Ekspor", metaX + 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(...SLATE);
  doc.text(doc.splitTextToSize(meta.exportedByName, metaW - 4), metaX + 2, y + 10);
  doc.text(
    doc.splitTextToSize(formatIdDateTime(new Date()), metaW - 4),
    metaX + 2,
    y + 14
  );

  y += headerH + 3;

  const statH = 11;
  const statGap = 2.5;
  const statW = (contentW - 3 * statGap) / 4;
  drawStatCard(doc, MARGIN.left, y, statW, statH, "Total", String(stats.total), [71, 85, 105]);
  drawStatCard(
    doc,
    MARGIN.left + statW + statGap,
    y,
    statW,
    statH,
    "Keluar",
    String(stats.keluar),
    ORANGE
  );
  drawStatCard(
    doc,
    MARGIN.left + 2 * (statW + statGap),
    y,
    statW,
    statH,
    "Masuk",
    String(stats.masuk),
    EMERALD
  );
  drawStatCard(
    doc,
    MARGIN.left + 3 * (statW + statGap),
    y,
    statW,
    statH,
    "Lainnya",
    String(stats.lainnya),
    RED
  );

  const tableStartY = y + statH + 4;

  const head = [
    [
      "No.",
      "Tanggal",
      "Arah",
      "Perangkat",
      "Dibawa / Ditemukan",
      "Disetujui",
      "Jenis",
      "Lokasi",
      "Kond.",
    ],
  ];

  const body =
    transactions.length > 0
      ? transactions.map((t, i) => {
          const arah = getArahBarang(t.jenisTransaksi);
          return [
            rowNumber(i),
            formatDatePdf(t.createdAt),
            getArahLabel(arah),
            sparepartCellComplete(t, sparepartNames),
            getCarriedBy(t),
            getApprovedBy(t),
            JENIS_PDF_LABEL[t.jenisTransaksi],
            lokasiCell(t.lokasiTujuan || t.lokasiAsal),
            t.statusBarang || "—",
          ];
        })
      : [["-", "Tidak ada data", "", "", "", "", "", "", ""]];

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    tableWidth,
    margin: {
      left: MARGIN.left,
      right: MARGIN.right,
      top: MARGIN.top + 4,
      bottom: MARGIN.bottom + FOOTER_H,
    },
    rowPageBreak: "auto",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 6,
      overflow: "linebreak",
      cellPadding: 1.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.12,
      valign: "top",
      textColor: [30, 41, 59],
      minCellHeight: 5,
    },
    headStyles: {
      fillColor: RED,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 6,
      valign: "middle",
      cellPadding: 1.8,
      minCellHeight: 6.5,
    },
    alternateRowStyles: { fillColor: [252, 253, 255] },
    columnStyles: {
      0: {
        halign: "center",
        valign: "middle",
        cellWidth: col.no,
        fontStyle: "bold",
      },
      1: { cellWidth: col.tgl, fontSize: 5.8 },
      2: { halign: "center", valign: "middle", cellWidth: col.arah, fontSize: 5.8 },
      3: { cellWidth: col.item, fontSize: 5.8 },
      4: { cellWidth: col.teknisi, fontSize: 5.8 },
      5: { cellWidth: col.tujuan, fontSize: 5.8 },
      6: { halign: "center", valign: "middle", cellWidth: col.jenis, fontSize: 5.8 },
      7: { cellWidth: col.asal, fontSize: 5.8 },
      8: { halign: "center", valign: "middle", cellWidth: col.status, fontSize: 5.8 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rowIdx = data.row.index;
      const t = transactions[rowIdx];
      if (!t) return;

      if (data.column.index === 0) {
        data.cell.text = [rowNumber(rowIdx)];
        data.cell.styles.halign = "center";
        data.cell.styles.valign = "middle";
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [71, 85, 105];
        data.cell.styles.fillColor = [248, 250, 252];
      }

      if (data.column.index === 2) {
        const arah = getArahBarang(t.jenisTransaksi);
        const { fill, text } = arahBadgeStyle(arah);
        data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = text;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.valign = "middle";
        data.cell.styles.halign = "center";
      }

      if (data.column.index === 6) {
        const { fill, text } = jenisBadgeStyle(t.jenisTransaksi);
        data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = text;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.valign = "middle";
        data.cell.styles.halign = "center";
      }

      if (data.column.index === 8) {
        const { fill, text } = statusBadgeStyle(t.statusBarang);
        data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = text;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.valign = "middle";
        data.cell.styles.halign = "center";
      }
    },
    // Background harus digambar SEBELUM tabel (willDrawPage), bukan setelah (didDrawPage)
    // — kalau tidak, fill halaman menutupi baris tabel di halaman 2+.
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawPageFrame(doc, pageW, pageH);
        drawTopBar(doc, pageW);
      }
    },
  });

  addFooter(doc, meta, pageW, pageH);

  const tabSlug = activeTab === "semua" ? "semua" : activeTab;
  doc.save(
    `laporan-masuk-keluar_${filters.startDate}_${filters.endDate}_${tabSlug}.pdf`
  );
}


