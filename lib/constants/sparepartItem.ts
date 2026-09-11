import { SparepartItem } from "@/types";

/** Status stok / kondisi operasional item di sistem */
export const ITEM_STATUS_VALUES = [
  "Tersedia",
  "Digunakan",
  "Rusak",
  "Hilang",
  "Maintenance",
  "Perlu Pengecekan",
] as const;

export type ItemStatusValue = (typeof ITEM_STATUS_VALUES)[number];

/** Hasil audit fisik (cari fisik) — terpisah dari status stok */
export const CARI_FISIK_VALUES = [
  "Sesuai",
  "Tidak Ditemukan",
  "Outstanding",
  "Mutasi Keluar",
] as const;

export type CariFisikValue = (typeof CARI_FISIK_VALUES)[number];

export const DEFAULT_ITEM_STATUS: ItemStatusValue = "Tersedia";
export const DEFAULT_CARI_FISIK: CariFisikValue = "Sesuai";
export const DEFAULT_LOKASI = "Gudang";

export const ITEM_STATUS_LABELS: Record<ItemStatusValue, string> = {
  Tersedia: "Tersedia",
  Digunakan: "Digunakan",
  Rusak: "Rusak",
  Hilang: "Hilang",
  Maintenance: "Maintenance",
  "Perlu Pengecekan": "Perlu Pengecekan",
};

export const CARI_FISIK_LABELS: Record<CariFisikValue, string> = {
  Sesuai: "Sesuai",
  "Tidak Ditemukan": "Tidak Ditemukan",
  Outstanding: "Outstanding",
  "Mutasi Keluar": "Mutasi Keluar",
};

const STATUS_ALIASES: Record<string, ItemStatusValue> = {
  tersedia: "Tersedia",
  available: "Tersedia",
  digunakan: "Digunakan",
  dipakai: "Digunakan",
  used: "Digunakan",
  rusak: "Rusak",
  damage: "Rusak",
  damaged: "Rusak",
  hilang: "Hilang",
  lost: "Hilang",
  maintenance: "Maintenance",
  perbaikan: "Maintenance",
  "perlu pengecekan": "Perlu Pengecekan",
  pengecekan: "Perlu Pengecekan",
  unknown: "Perlu Pengecekan",
};

const CARI_FISIK_ALIASES: Record<string, CariFisikValue> = {
  sesuai: "Sesuai",
  ok: "Sesuai",
  "tidak ditemukan": "Tidak Ditemukan",
  "tidak ada": "Tidak Ditemukan",
  outstanding: "Outstanding",
  "mutasi keluar": "Mutasi Keluar",
  mutasi: "Mutasi Keluar",
};

export function normalizeItemStatus(value?: string | null): ItemStatusValue {
  if (!value?.trim()) return DEFAULT_ITEM_STATUS;
  const key = value.trim().toLowerCase();
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  const match = ITEM_STATUS_VALUES.find(
    (s) => s.toLowerCase() === key
  );
  return match ?? DEFAULT_ITEM_STATUS;
}

export function normalizeCariFisik(value?: string | null): CariFisikValue {
  if (!value?.trim()) return DEFAULT_CARI_FISIK;
  const key = value.trim().toLowerCase();
  if (CARI_FISIK_ALIASES[key]) return CARI_FISIK_ALIASES[key];
  const match = CARI_FISIK_VALUES.find(
    (s) => s.toLowerCase() === key
  );
  return match ?? DEFAULT_CARI_FISIK;
}

export function normalizeLokasi(value?: string | null): string {
  const v = value?.trim();
  return v || DEFAULT_LOKASI;
}

/** Kolom standar Excel inventaris */
export const EXCEL_COLUMNS = {
  NO: "No",
  NAMA: "Nama Perangkat",
  SN: "Serial Number",
  TAG: "Tag",
  CARI_FISIK: "Cari Fisik",
  STATUS: "Status Stok",
  LOKASI: "Lokasi",
  KATEGORI: "Kategori",
  KETERANGAN: "Keterangan",
  TANGGAL: "Tanggal Update",
} as const;

export interface NormalizedSparepartRow {
  namaPerangkat: string;
  serialNumber: string;
  tagging: string;
  cariFisik: CariFisikValue;
  status: ItemStatusValue;
  lokasiSaatIni: string;
  kategori: string;
  keterangan: string;
}

export function itemToExcelRow(
  item: SparepartItem,
  index: number
): Record<string, string | number> {
  return {
    [EXCEL_COLUMNS.NO]: index + 1,
    [EXCEL_COLUMNS.NAMA]: item.namaPerangkat || "",
    [EXCEL_COLUMNS.SN]: item.serialNumber || "",
    [EXCEL_COLUMNS.TAG]: item.tagging || "",
    [EXCEL_COLUMNS.CARI_FISIK]: normalizeCariFisik(item.cariFisik),
    [EXCEL_COLUMNS.STATUS]: normalizeItemStatus(item.status),
    [EXCEL_COLUMNS.LOKASI]: normalizeLokasi(item.lokasiSaatIni),
    [EXCEL_COLUMNS.KATEGORI]: "",
    [EXCEL_COLUMNS.KETERANGAN]: item.keterangan || "",
    [EXCEL_COLUMNS.TANGGAL]: "",
  };
}
