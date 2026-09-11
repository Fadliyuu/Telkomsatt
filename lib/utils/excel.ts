import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { SparepartItem } from "@/types";
import { getSparepartItems } from "@/lib/firebase/sparepartItems";
import {
  createSparepartItem,
  updateSparepartItem,
  findExistingItemBySnOrTag,
} from "@/lib/firebase/sparepartItems";
import { formatDate } from "@/lib/utils";
import {
  EXCEL_COLUMNS,
  itemToExcelRow,
  normalizeCariFisik,
  normalizeItemStatus,
  normalizeLokasi,
  NormalizedSparepartRow,
} from "@/lib/constants/sparepartItem";

export type { NormalizedSparepartRow };

export interface ExcelImportRow {
  [key: string]: string | number | undefined;
}

function normalizeValue(val: unknown): string {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (s === "-" || s === "—") return "";
  return s;
}

/** Normalisasi satu baris Excel (dukung format lama & baru) */
export function normalizeExcelRow(row: ExcelImportRow): NormalizedSparepartRow {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return normalizeValue(v);
      }
    }
    return "";
  };

  const namaPerangkat = get("Nama Perangkat", "namaPerangkat", "Nama");
  const serialNumber = get("Serial Number", "serialNumber", "SN");
  const tagging = get("Tag", "tagging", "Tagging");
  const cariFisikRaw = get("Cari Fisik", "cariFisik");

  const statusStok = get(
    "Status Stok",
    "status",
    "Status Item",
    "Status Barang"
  );
  const lokasiCol = get("Lokasi", "lokasiSaatIni", "Lokasi Saat Ini");

  /** Format lama: kolom "Status" = lokasi fisik */
  const legacyStatusCol = get("Status");
  let status = statusStok;
  let lokasi = lokasiCol;

  if (!statusStok && legacyStatusCol) {
    const maybeStatus = normalizeItemStatus(legacyStatusCol);
    const isLikelyStockStatus = [
      "Tersedia",
      "Digunakan",
      "Rusak",
      "Hilang",
      "Maintenance",
    ].includes(maybeStatus);
    if (isLikelyStockStatus && legacyStatusCol.toLowerCase() === maybeStatus.toLowerCase()) {
      status = maybeStatus;
    } else if (!lokasiCol) {
      lokasi = legacyStatusCol;
    }
  }

  if (!status) status = normalizeItemStatus(undefined);

  return {
    namaPerangkat,
    serialNumber,
    tagging,
    cariFisik: normalizeCariFisik(cariFisikRaw),
    status: normalizeItemStatus(status),
    lokasiSaatIni: normalizeLokasi(lokasi),
    kategori: get("Kategori", "kategori"),
    keterangan: get("Keterangan", "keterangan"),
  };
}

function buildSheetFromItems(items: SparepartItem[]) {
  const exportData = items.map((item, index) => {
    const row = itemToExcelRow(item, index);
    row[EXCEL_COLUMNS.TANGGAL] = formatDate(item.updatedAt);
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws["!cols"] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
  ];
  return ws;
}

export const exportToExcel = async (): Promise<void> => {
  const allItems = await getSparepartItems();
  const ws = buildSheetFromItems(allItems);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventaris");
  const fileName = `Inventaris_${new Date().toISOString().split("T")[0]}.xlsx`;
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, fileName);
};

export const exportSelectedToExcel = (
  items: SparepartItem[],
  fileName?: string
): void => {
  if (items.length === 0) {
    throw new Error("Tidak ada item yang dipilih untuk export");
  }
  const ws = buildSheetFromItems(items);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventaris");
  const exportFileName =
    fileName || `Inventaris_${new Date().toISOString().split("T")[0]}.xlsx`;
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, exportFileName);
};

export const exportRowsPreviewToExcel = (
  rows: NormalizedSparepartRow[],
  fileName?: string
): void => {
  const exportData = rows.map((row, index) => ({
    [EXCEL_COLUMNS.NO]: index + 1,
    [EXCEL_COLUMNS.NAMA]: row.namaPerangkat,
    [EXCEL_COLUMNS.SN]: row.serialNumber,
    [EXCEL_COLUMNS.TAG]: row.tagging,
    [EXCEL_COLUMNS.CARI_FISIK]: row.cariFisik,
    [EXCEL_COLUMNS.STATUS]: row.status,
    [EXCEL_COLUMNS.LOKASI]: row.lokasiSaatIni,
    [EXCEL_COLUMNS.KATEGORI]: row.kategori,
    [EXCEL_COLUMNS.KETERANGAN]: row.keterangan,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Preview OCR");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    fileName || `Preview_OCR_${new Date().toISOString().split("T")[0]}.xlsx`
  );
};

export const downloadExcelTemplate = (): void => {
  const templateData = [
    {
      [EXCEL_COLUMNS.NO]: 1,
      [EXCEL_COLUMNS.NAMA]: "BUC 2 WATT FULL C-BAND NIT8102WF - NIF",
      [EXCEL_COLUMNS.SN]: "A07458A12",
      [EXCEL_COLUMNS.TAG]: "TLSAT1339900026009",
      [EXCEL_COLUMNS.CARI_FISIK]: "Sesuai",
      [EXCEL_COLUMNS.STATUS]: "Tersedia",
      [EXCEL_COLUMNS.LOKASI]: "Gudang Regional 6",
      [EXCEL_COLUMNS.KATEGORI]: "RF",
      [EXCEL_COLUMNS.KETERANGAN]: "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventaris");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, "Template_Inventaris.xlsx");
};

export async function importNormalizedRows(
  rows: NormalizedSparepartRow[],
  options?: { skipDuplicates?: boolean }
): Promise<{
  success: number;
  failed: number;
  errors: string[];
  summary: { itemsCreated: number; itemsUpdated: number; skipped: number };
}> {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;
  const summary = { itemsCreated: 0, itemsUpdated: 0, skipped: 0 };

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const line = index + 1;

    if (!row.namaPerangkat.trim()) {
      errors.push(`Baris ${line}: Nama Perangkat wajib diisi`);
      failed++;
      continue;
    }

    const sn = row.serialNumber.trim();
    const tag = row.tagging.trim();
    if (!sn && !tag) {
      errors.push(`Baris ${line}: Serial Number atau Tag wajib diisi salah satu`);
      failed++;
      continue;
    }

    try {
      const existing = await findExistingItemBySnOrTag(sn, tag);
      if (existing && options?.skipDuplicates) {
        summary.skipped++;
        continue;
      }

      const payload = {
        namaPerangkat: row.namaPerangkat.trim(),
        serialNumber: sn,
        tagging: tag || undefined,
        cariFisik: row.cariFisik,
        lokasiSaatIni: row.lokasiSaatIni,
        status: row.status,
        keterangan: row.keterangan.trim() || undefined,
      };

      if (existing) {
        await updateSparepartItem(existing.id, payload);
        summary.itemsUpdated++;
      } else {
        await createSparepartItem(payload);
        summary.itemsCreated++;
      }
      success++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error";
      errors.push(`Baris ${line}: ${message}`);
      failed++;
    }
  }

  return { success, failed, errors, summary };
}

export const importFromExcel = async (
  file: File
): Promise<{
  success: number;
  failed: number;
  errors: string[];
  summary: {
    itemsCreated: number;
    itemsUpdated: number;
    skipped: number;
  };
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Gagal membaca file"));
          return;
        }

        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: ExcelImportRow[] = XLSX.utils.sheet_to_json(worksheet);
        const normalized = jsonData.map(normalizeExcelRow);
        const result = await importNormalizedRows(normalized);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsBinaryString(file);
  });
};
