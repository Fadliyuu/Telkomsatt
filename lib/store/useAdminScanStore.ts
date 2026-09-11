import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ItemStatusValue, KondisiDismantle, UserRole } from "@/types";
import type {
  BeritaAcaraJenis,
  TipeMaintenance,
} from "@/lib/constants/beritaAcara";
import { ADMIN_SCAN_STORAGE_KEY } from "@/lib/constants/storageKeys";

export type AdminScanMode = "UPDATE" | "MOVE" | "DAMAGE" | "FOUND" | "DISMANTLE";

export interface AdminScanItem {
  id: string;
  idSparepart: string;
  mode: AdminScanMode;
  namaPerangkat: string;
  serialNumber?: string;
  tagging?: string;
  lokasiSaatIni?: string;
  status?: ItemStatusValue;
  keterangan?: string;
  /** Untuk mode UPDATE — nilai yang akan diterapkan saat submit */
  newStatus?: ItemStatusValue;
  newKeterangan?: string;
  newLokasi?: string;
  lokasiDitemukan?: string;
  kondisiDismantle?: KondisiDismantle;
  selected: boolean;
  scanCount: number;
}

export interface AdminScanDocMeta {
  namaTeknisi: string;
  jenisTeknisi: "karyawan" | "freelance" | "vendor";
  penerimaRole: UserRole | "";
  penerimaUserId: string;
  nomorSpt: string;
  lokasiTujuan: string;
  lokasiSite: string;
  alamat: string;
  keteranganGlobal: string;
  beritaAcaraJenis: BeritaAcaraJenis;
  namaPelanggan: string;
  pekerjaanTambahan: string;
  noTiketComplaint: string;
  noTiketMaintenance: string;
  noHpTeknisi: string;
  namaPic: string;
  noHpPic: string;
  tipeMaintenance: TipeMaintenance | "";
  layananTerpilih: string[];
  sumberMasalah: string;
  tindakan: string;
  catatanRingkasan: string;
}

interface AdminScanState {
  items: AdminScanItem[];
  defaultMode: AdminScanMode;
  docMeta: AdminScanDocMeta;
  setDefaultMode: (mode: AdminScanMode) => void;
  setDocMeta: (partial: Partial<AdminScanDocMeta>) => void;
  addOrRescanItem: (payload: Omit<AdminScanItem, "id" | "selected" | "scanCount">) => string;
  updateItem: (id: string, partial: Partial<AdminScanItem>) => void;
  removeItem: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectAll: (selected: boolean) => void;
  applyBulkToSelected: (partial: Partial<AdminScanItem>) => void;
  clearAll: () => void;
}

const defaultDocMeta: AdminScanDocMeta = {
  namaTeknisi: "",
  jenisTeknisi: "karyawan",
  penerimaRole: "",
  penerimaUserId: "",
  nomorSpt: "",
  lokasiTujuan: "",
  lokasiSite: "",
  alamat: "",
  keteranganGlobal: "",
  beritaAcaraJenis: "maintenance",
  namaPelanggan: "",
  pekerjaanTambahan: "",
  noTiketComplaint: "",
  noTiketMaintenance: "",
  noHpTeknisi: "",
  namaPic: "",
  noHpPic: "",
  tipeMaintenance: "PM",
  layananTerpilih: [],
  sumberMasalah: "",
  tindakan: "",
  catatanRingkasan: "",
};

export const useAdminScanStore = create<AdminScanState>()(
  persist(
    (set, get) => ({
      items: [],
      defaultMode: "UPDATE",
      docMeta: defaultDocMeta,
      setDefaultMode: (mode) => set({ defaultMode: mode }),
      setDocMeta: (partial) =>
        set({ docMeta: { ...get().docMeta, ...partial } }),
      addOrRescanItem: (payload) => {
        const existing = get().items.find(
          (i) => i.idSparepart === payload.idSparepart
        );
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.idSparepart === payload.idSparepart
                ? {
                    ...i,
                    ...payload,
                    scanCount: i.scanCount + 1,
                    selected: true,
                  }
                : i
            ),
          });
          return existing.id;
        }
        const id = `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        set({
          items: [
            ...get().items,
            {
              ...payload,
              id,
              selected: true,
              scanCount: 1,
            },
          ],
        });
        return id;
      },
      updateItem: (id, partial) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, ...partial } : i
          ),
        }),
      removeItem: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),
      toggleSelect: (id) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, selected: !i.selected } : i
          ),
        }),
      selectAll: (selected) =>
        set({
          items: get().items.map((i) => ({ ...i, selected })),
        }),
      applyBulkToSelected: (partial) =>
        set({
          items: get().items.map((i) =>
            i.selected ? { ...i, ...partial } : i
          ),
        }),
      clearAll: () => set({ items: [] }),
    }),
    { name: ADMIN_SCAN_STORAGE_KEY }
  )
);
