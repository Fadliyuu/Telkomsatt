import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AdminScanItem } from "@/lib/store/useAdminScanStore";
import {
  getBeritaAcaraTemplate,
  LAYANAN_BA_CHECKLIST,
  type BeritaAcaraJenis,
  type TipeMaintenance,
} from "@/lib/constants/beritaAcara";
import {
  A4_PORTRAIT_MM,
  generateDocNumber,
  PDF_RED,
  tryAddLogo,
} from "./pdfShared";
import {
  drawBaHeader,
  drawCheckbox,
  drawDottedField,
  drawLaporanHeader,
  drawTelkomsatFooter,
  formatHariTanggalId,
} from "./beritaAcaraFormDraw";

export interface BeritaAcaraPdfParams {
  nomor: string;
  jenis: BeritaAcaraJenis;
  lokasiSite: string;
  namaPelanggan?: string;
  alamat?: string;
  namaTeknisi: string;
  noHpTeknisi?: string;
  namaPic?: string;
  noHpPic?: string;
  noTiketComplaint?: string;
  noTiketMaintenance?: string;
  tipeMaintenance?: TipeMaintenance | "";
  layananTerpilih?: string[];
  sumberMasalah?: string;
  tindakan?: string;
  catatanRingkasan?: string;
  items: AdminScanItem[];
  adminName: string;
  pekerjaanTambahan?: string;
}

const MARGIN = { left: 15, right: 15, top: 12, bottom: 28 };

async function renderBaMaintenance(
  doc: jsPDF,
  params: BeritaAcaraPdfParams,
  template: ReturnType<typeof getBeritaAcaraTemplate>
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN.left - MARGIN.right;
  const labelW = 52;
  const lineW = contentW - labelW;

  let y = MARGIN.top;
  y = await drawBaHeader(
    doc,
    MARGIN,
    pageW,
    template.judul,
    template.jenis === "maintenance",
    params.tipeMaintenance
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const intro =
    "Saya yang bertandatangan di bawah ini menyatakan bahwa telah dilakukan kegiatan maintenance dengan baik dan sesuai standar yang telah ditetapkan, pada :";
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, MARGIN.left, y);
  y += introLines.length * 4 + 5;

  const fields: [string, string | undefined][] = [
    ["Hari/ Tanggal", formatHariTanggalId(new Date())],
    ["Pelanggan", params.namaPelanggan],
    ["Nama Lokasi", params.lokasiSite],
    ["Alamat", params.alamat],
    ["No. Tiket Complaint Handling", params.noTiketComplaint],
    ["No. Tiket Maintenance", params.noTiketMaintenance || params.nomor],
    ["Nama Teknisi", params.namaTeknisi],
    ["No. HP Teknisi", params.noHpTeknisi],
    ["Nama PIC", params.namaPic],
    ["No. HP PIC", params.noHpPic],
  ];

  fields.forEach(([label, val]) => {
    drawDottedField(doc, label, val, MARGIN.left, y, labelW, lineW);
    y += 6.5;
  });

  y += 4;
  const stmt =
    "Dari hasil pekerjaan maintenance yang telah dilakukan, layanan telah berjalan dengan normal. Pernyataan ini sekaligus dapat dipergunakan sebagai Berita Acara pengerjaan maintenance oleh Telkomsat sebagai penyedia produk dan layanan :";
  const stmtLines = doc.splitTextToSize(stmt, contentW);
  doc.text(stmtLines, MARGIN.left, y);
  y += stmtLines.length * 4 + 5;

  const selected = new Set(params.layananTerpilih || []);
  const colW = contentW / 3;
  const perCol = Math.ceil(LAYANAN_BA_CHECKLIST.length / 3);
  for (let c = 0; c < 3; c++) {
    const colX = MARGIN.left + c * colW;
    let cy = y;
    const slice = LAYANAN_BA_CHECKLIST.slice(c * perCol, (c + 1) * perCol);
    slice.forEach((layanan) => {
      drawCheckbox(doc, colX, cy, 3, selected.has(layanan), layanan);
      cy += 5;
    });
    if (c === 2) {
      drawCheckbox(
        doc,
        colX,
        cy,
        3,
        false,
        "___________________________"
      );
    }
  }
  y += perCol * 5 + 8;

  if (params.items.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Daftar perangkat terkait:", MARGIN.left, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["No", "Perangkat", "SN", "Tag", "Status"]],
      body: params.items.map((item, i) => [
        String(i + 1),
        item.namaPerangkat,
        item.serialNumber || "—",
        item.tagging || "—",
        item.status || item.newStatus || "—",
      ]),
      tableWidth: contentW,
      margin: MARGIN,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: {
        fillColor: PDF_RED,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 25, halign: "center" },
      },
    });
    y =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y + 20;
    y += 6;
  }

  if (params.pekerjaanTambahan?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Catatan:", MARGIN.left, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(
      doc.splitTextToSize(params.pekerjaanTambahan, contentW),
      MARGIN.left,
      y
    );
    y += 12;
  }

  const signY = Math.min(y + 4, pageH - 55);
  const halfW = contentW / 2 - 4;

  doc.setFontSize(9);
  doc.text("Dibuat Oleh,", MARGIN.left + halfW / 2, signY, { align: "center" });
  doc.text("Mengetahui,", MARGIN.left + halfW + halfW / 2 + 4, signY, {
    align: "center",
  });

  doc.line(MARGIN.left, signY + 18, MARGIN.left + halfW - 2, signY + 18);
  doc.line(
    MARGIN.left + halfW + 6,
    signY + 18,
    MARGIN.left + contentW,
    signY + 18
  );

  doc.setFontSize(8);
  doc.text(
    `( ${params.namaTeknisi} )`,
    MARGIN.left + halfW / 2,
    signY + 23,
    { align: "center" }
  );
  doc.setFontSize(7);
  doc.text("*Nama Teknisi", MARGIN.left + halfW / 2, signY + 27, {
    align: "center",
  });
  doc.text(
    "( .................................... )",
    MARGIN.left + halfW + halfW / 2 + 4,
    signY + 23,
    { align: "center" }
  );

  await tryAddLogo(
    doc,
    pageW - MARGIN.right - 32,
    pageH - MARGIN.bottom - 20,
    32,
    14
  );

  drawTelkomsatFooter(
    doc,
    pageW,
    pageH,
    MARGIN,
    1,
    1,
    template.formCode,
    template.formRev
  );
}

async function renderLaporanPemeliharaan(
  doc: jsPDF,
  params: BeritaAcaraPdfParams,
  template: ReturnType<typeof getBeritaAcaraTemplate>
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN.left - MARGIN.right;

  let y = await drawLaporanHeader(doc, MARGIN, pageW, template.judul);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VII. RINGKASAN PEMECAHAN MASALAH", MARGIN.left, y);
  y += 5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const hint =
    "(Isi sumber masalah dan tindakan yang dilakukan dengan lengkap pada kolom yang disediakan. Bila diperlukan tambahan data sebagai informasi bisa disisipkan di kolom Catatan.)";
  const hintLines = doc.splitTextToSize(hint, contentW);
  doc.text(hintLines, MARGIN.left, y);
  y += hintLines.length * 3.5 + 4;

  const sumber =
    params.sumberMasalah?.trim() ||
    params.pekerjaanTambahan?.trim() ||
    "—";
  const tindakan = params.tindakan?.trim() || "—";
  const catatan =
    params.catatanRingkasan?.trim() ||
    params.items
      .map(
        (i) =>
          `${i.namaPerangkat}${i.serialNumber ? ` (SN: ${i.serialNumber})` : ""}`
      )
      .join("; ") ||
    "—";

  autoTable(doc, {
    startY: y,
    head: [["Sumber Masalah", "Tindakan"]],
    body: [[sumber, tindakan]],
    tableWidth: contentW,
    margin: MARGIN,
    styles: { fontSize: 8, minCellHeight: 22, valign: "top" },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 30,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: contentW / 2 },
      1: { cellWidth: contentW / 2 },
    },
  });

  y =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 30;
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Catatan"]],
    body: [[catatan]],
    tableWidth: contentW,
    margin: MARGIN,
    styles: { fontSize: 8, minCellHeight: 18, valign: "top" },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 30,
      fontStyle: "bold",
      halign: "center",
    },
  });

  y =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 25;
  y += 10;

  const signY = Math.min(y, pageH - 50);
  const halfW = contentW / 2 - 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    "Petugas/Teknisi Pemeliharaan",
    MARGIN.left + halfW / 2,
    signY,
    { align: "center" }
  );
  doc.text(
    "Petugas/Aparat Setempat",
    MARGIN.left + halfW + halfW / 2 + 4,
    signY,
    { align: "center" }
  );

  doc.line(MARGIN.left, signY + 16, MARGIN.left + halfW - 2, signY + 16);
  doc.line(
    MARGIN.left + halfW + 6,
    signY + 16,
    MARGIN.left + contentW,
    signY + 16
  );

  doc.setFontSize(8);
  doc.text(
    `( ${params.namaTeknisi} )`,
    MARGIN.left + halfW / 2,
    signY + 21,
    { align: "center" }
  );
  doc.text(
    "( .................................... )",
    MARGIN.left + halfW + halfW / 2 + 4,
    signY + 21,
    { align: "center" }
  );

  drawTelkomsatFooter(
    doc,
    pageW,
    pageH,
    MARGIN,
    1,
    1,
    template.formCode,
    template.formRev
  );
}

export async function downloadBeritaAcaraPdf(
  params: BeritaAcaraPdfParams
): Promise<void> {
  const template = getBeritaAcaraTemplate(params.jenis);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [A4_PORTRAIT_MM.w, A4_PORTRAIT_MM.h],
    compress: true,
  });

  doc.setProperties({
    title: template.judul,
    subject: "Berita Acara Telkomsat Regional 6",
    creator: "Telkomsat Inventaris QR",
  });

  if (template.formLayout === "laporan_pemeliharaan") {
    await renderLaporanPemeliharaan(doc, params, template);
  } else {
    await renderBaMaintenance(doc, params, template);
  }

  // Untuk maintenance: tambah halaman ringkasan pemecahan masalah jika ada data
  if (
    template.jenis === "maintenance" &&
    (params.sumberMasalah?.trim() ||
      params.tindakan?.trim() ||
      params.catatanRingkasan?.trim())
  ) {
    doc.addPage();
    await renderLaporanPemeliharaan(doc, params, template);
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      drawTelkomsatFooter(
        doc,
        doc.internal.pageSize.getWidth(),
        doc.internal.pageSize.getHeight(),
        MARGIN,
        p,
        total,
        template.formCode,
        template.formRev
      );
    }
  }

  doc.save(
    `berita-acara_${params.jenis}_${params.nomor.replace(/\//g, "-")}.pdf`
  );
}

export function createBeritaAcaraNumber(): string {
  return generateDocNumber("BA");
}
