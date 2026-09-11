// User Types
export type UserRole =
  | "admin"
  | "direktur"
  | "manager"
  | "supervisor"
  | "admin_gudang"
  | "admin_keuangan"
  | "teknisi";
export type UserStatus = "aktif" | "nonaktif";
export type ProfileIconSize = "sm" | "md" | "lg";

export const USER_ROLES: UserRole[] = [
  "admin",
  "admin_gudang",
  "teknisi",
  "supervisor",
];

export interface User {
  id: string;
  nama: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  jabatan?: string;
  nomorHP?: string;
  alamat?: string;
  divisi?: string;
  fotoProfilUrl?: string;
  fotoProfilPublicId?: string;
  fotoProfilSize?: ProfileIconSize;
  tanggalMulai?: Date;
  tanggalSelesai?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Role Labels untuk display (4 Role Utama)
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin Sistem",
  admin_gudang: "Admin Gudang",
  teknisi: "Teknisi",
  supervisor: "Supervisor",
  direktur: "Direktur",
  manager: "Manager",
  admin_keuangan: "Admin Keuangan",
};

// Role Colors untuk styling (WCAG AA Compliant)
export const USER_ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  admin: { bg: "bg-rose-100", text: "text-rose-900" },
  admin_gudang: { bg: "bg-amber-100", text: "text-amber-900" },
  teknisi: { bg: "bg-green-100", text: "text-green-900" },
  supervisor: { bg: "bg-indigo-100", text: "text-indigo-900" },
  direktur: { bg: "bg-purple-100", text: "text-purple-900" },
  manager: { bg: "bg-blue-100", text: "text-blue-900" },
  admin_keuangan: { bg: "bg-emerald-100", text: "text-emerald-900" },
};

// Sparepart Types
export interface Sparepart {
  id: string;
  kodeSpare: string;
  namaSpare: string;
  kategori: string;
  deskripsi?: string;
  lokasiDefault: string;
  stokTotal: number;
  stokGudang: number;
  qrCodePath?: string;
  qrCodeUrl?: string;
  fotoUrl?: string[]; // Array URL foto sparepart dari Cloudinary
  createdAt: Date;
  updatedAt: Date;
}

export type {
  ItemStatusValue,
  CariFisikValue,
} from "@/lib/constants/sparepartItem";

export {
  ITEM_STATUS_VALUES,
  CARI_FISIK_VALUES,
  DEFAULT_ITEM_STATUS,
  DEFAULT_CARI_FISIK,
  DEFAULT_LOKASI,
} from "@/lib/constants/sparepartItem";

// Sparepart Item - Setiap item fisik dengan SN dan tagging
export interface SparepartItem {
  id: string;
  idSparepart?: string; // Reference ke sparepart type (opsional untuk format sederhana)
  namaPerangkat: string; // Nama perangkat (wajib, sesuai format PDF)
  serialNumber: string; // SN unik per item (opsional, biarkan kosong jika tidak ada)
  tagging?: string; // Tag/label tambahan
  cariFisik?: "Sesuai" | "Tidak Ditemukan" | "Outstanding" | "Mutasi Keluar"; // Status fisik sesuai PDF
  lokasiSaatIni?: string; // Lokasi saat ini (Status di PDF, opsional)
  status?: "Tersedia" | "Digunakan" | "Rusak" | "Hilang" | "Maintenance" | "Perlu Pengecekan"; // Status sistem (opsional)
  keterangan?: string;
  qrCodeUrl?: string; // QR Code URL untuk scan item
  fotoUrl?: string[]; // Array URL foto dari Cloudinary
  // Field untuk tracking item yang ditambahkan oleh teknisi
  ditambahkanOleh?: string; // Nama teknisi yang menambahkan
  jenisTeknisi?: "freelance" | "karyawan" | "vendor"; // Jenis teknisi
  carriedByName?: string;
  carriedByRole?: UserRole;
  requestedByUid?: string;
  requestedAction?: JenisTransaksi;
  requestedLocation?: string;
  requestNote?: string;
  requestFotoUrl?: string[];
  perluVerifikasi?: boolean; // Apakah perlu diverifikasi admin
  diverifikasiOleh?: string; // Admin yang memverifikasi
  tanggalVerifikasi?: Date; // Tanggal verifikasi
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedByName?: string;
  approvedByRole?: UserRole;
  approvedByUid?: string;
  approvedAt?: Date;
  rejectedByName?: string;
  rejectedByRole?: UserRole;
  rejectedAt?: Date;
  rejectReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Lokasi Types
export type LokasiType = "Gudang" | "Site" | "Customer" | "Workshop" | "Lainnya";

export interface Lokasi {
  id: string;
  namaLokasi: string;
  tipe: LokasiType;
  alamat?: string;
  keterangan?: string;
  createdAt: Date;
}

// Transaction Types
export type ActiveTransactionType = "OUT" | "MOVE" | "RETURN" | "DAMAGE";
export type LegacyTransactionType = "FOUND" | "DISMANTLE";
export type JenisTransaksi = ActiveTransactionType | LegacyTransactionType;
export type StatusTransaksi = "pending" | "completed" | "rejected";
export type StatusBarang = "Normal" | "Rusak" | "Hilang" | "Perlu Pengecekan";
export type KondisiDismantle = "Rusak" | "Bagus" | "Tidak Diketahui";

export const JENIS_TRANSAKSI_LABELS: Record<JenisTransaksi, string> = {
  MOVE: "Pindah Lokasi",
  OUT: "Barang Keluar",
  DAMAGE: "Barang Rusak",
  RETURN: "Pengembalian Barang",
  FOUND: "Barang Ditemukan (Legacy)",
  DISMANTLE: "Dismantle (Legacy)",
};

export function getJenisTransaksiLabel(jenis?: string): string {
  if (!jenis) return "-";
  return JENIS_TRANSAKSI_LABELS[jenis as JenisTransaksi] || jenis;
}

export interface Transaksi {
  id: string;
  idSparepart: string;
  namaItem?: string;
  serialNumber?: string;
  tagging?: string;
  jenisTransaksi: JenisTransaksi;
  nomorSpt?: string; // Wajib untuk OUT dan MOVE
  lokasiAsal?: string;
  lokasiTujuan?: string;
  kondisiSebelum?: string;
  kondisiSesudah?: string;
  statusTransaksi: StatusTransaksi; // Wajib: pending | completed | rejected
  jumlah: number;
  statusBarang: StatusBarang;
  
  // Ownership & Verification tracking
  requestedByUid: string; // Unified owner UID
  requestedByName: string; // Unified owner Name
  requestedByRole?: UserRole;
  requestedAt: Date;
  
  approvedByUid?: string;
  approvedByName?: string;
  approvedByRole?: UserRole;
  approvedAt?: Date;

  rejectedByUid?: string;
  rejectedByName?: string;
  rejectedByRole?: UserRole;
  rejectedAt?: Date;
  rejectReason?: string;

  // Legacy fields for backward compatibility
  namaTeknisi?: string;
  carriedByName?: string;
  carriedByRole?: UserRole;
  idPenerima?: string;
  namaPenerima?: string;
  jabatanPenerima?: UserRole;

  keterangan?: string;
  fotoUrl?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// Session Keranjang Types
export type JenisTeknisi = "freelance" | "karyawan" | "vendor";
export type SessionStatus = "aktif" | "selesai";

export interface SessionKeranjang {
  id: string;
  sessionToken: string;
  namaTeknisi: string;
  jenisTeknisi?: JenisTeknisi;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionKeranjangItem {
  id: string;
  idSessionKeranjang: string;
  idSparepart: string;
  jenisAksi: "OUT" | "MOVE" | "RETURN" | "DAMAGE" | "FOUND" | "DISMANTLE";
  lokasiDitemukan?: string; // Lokasi saat barang ditemukan (untuk FOUND)
  kondisiDismantle?: KondisiDismantle; // Kondisi untuk DISMANTLE: Rusak atau Bagus
  kondisiBarang?: KondisiDismantle; // Kondisi untuk FOUND: Rusak, Bagus, atau Tidak Diketahui
  createdAt: Date;
}

// Guest Teknisi (optional)
export interface TeknisiGuest {
  id: string;
  namaTeknisi: string;
  jenis: JenisTeknisi;
  createdAt: Date;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  actorName?: string;
  actorRole?: UserRole;
  actorPhotoUrl?: string;
  targetRoles?: UserRole[];
  targetUids?: string[];
  readBy?: string[];
  link?: string;
  details?: string[];
  type?: "transaction" | "approval" | "request" | "system";
  createdAt: Date;
}
