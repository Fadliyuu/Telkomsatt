import {
  CARI_FISIK_VALUES,
  ITEM_STATUS_VALUES,
  JenisTransaksi,
  KondisiDismantle,
  StatusBarang,
  USER_ROLES,
  UserRole,
  UserStatus,
} from "@/types";

export class ValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const USER_STATUSES: UserStatus[] = ["aktif", "nonaktif"];
const TRANSACTION_TYPES: JenisTransaksi[] = [
  "MOVE",
  "DAMAGE",
  "RETURN",
  "FOUND",
  "DISMANTLE",
];
const STATUS_BARANG: StatusBarang[] = [
  "Normal",
  "Rusak",
  "Hilang",
  "Perlu Pengecekan",
];
const KONDISI_VALUES: KondisiDismantle[] = [
  "Rusak",
  "Bagus",
  "Tidak Diketahui",
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Payload tidak valid");
  }
  return value as Record<string, unknown>;
}

function stringField(
  data: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; min?: number }
) {
  const value = data[key];
  if (value === undefined || value === null || value === "") {
    if (options?.required) throw new ValidationError(`${key} wajib diisi`);
    return undefined;
  }
  if (typeof value !== "string") throw new ValidationError(`${key} harus teks`);
  const trimmed = value.trim();
  if (options?.min && trimmed.length < options.min) {
    throw new ValidationError(`${key} minimal ${options.min} karakter`);
  }
  return trimmed;
}

function enumField<T extends string>(
  data: Record<string, unknown>,
  key: string,
  values: readonly T[],
  fallback?: T
) {
  const value = data[key] ?? fallback;
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new ValidationError(`${key} tidak valid`);
  }
  return value as T;
}

export function validateUserCreatePayload(payload: unknown) {
  const data = asRecord(payload);
  return {
    nama: stringField(data, "nama", { required: true, min: 2 })!,
    email: stringField(data, "email", { required: true })!,
    password: stringField(data, "password", { required: true, min: 6 })!,
    role: enumField(data, "role", USER_ROLES),
    status: enumField(data, "status", USER_STATUSES, "aktif"),
    jabatan: stringField(data, "jabatan"),
    nomorHP: stringField(data, "nomorHP"),
    alamat: stringField(data, "alamat"),
    divisi: stringField(data, "divisi"),
    fotoProfilUrl: stringField(data, "fotoProfilUrl"),
    fotoProfilPublicId: stringField(data, "fotoProfilPublicId"),
    tanggalMulai: stringField(data, "tanggalMulai"),
    tanggalSelesai: stringField(data, "tanggalSelesai"),
  };
}

export function validateTransaksiCreate(payload: unknown) {
  const data = asRecord(payload);
  const jumlah = data.jumlah;
  if (typeof jumlah !== "number" || jumlah < 1) {
    throw new ValidationError("jumlah harus lebih dari 0");
  }
  return {
    idSparepart: stringField(data, "idSparepart", { required: true })!,
    namaTeknisi: stringField(data, "namaTeknisi", { required: true })!,
    jenisTransaksi: enumField(data, "jenisTransaksi", TRANSACTION_TYPES),
    jumlah,
    statusBarang: enumField(data, "statusBarang", STATUS_BARANG),
  };
}

export function validateSparepartItemPayload(payload: unknown) {
  const data = asRecord(payload);
  const status = data.status;
  const cariFisik = data.cariFisik;
  if (status !== undefined && !ITEM_STATUS_VALUES.includes(status as never)) {
    throw new ValidationError("status item tidak valid");
  }
  if (cariFisik !== undefined && !CARI_FISIK_VALUES.includes(cariFisik as never)) {
    throw new ValidationError("cariFisik tidak valid");
  }
  if (
    data.kondisiDismantle !== undefined &&
    !KONDISI_VALUES.includes(data.kondisiDismantle as KondisiDismantle)
  ) {
    throw new ValidationError("kondisiDismantle tidak valid");
  }
  return {
    namaPerangkat: stringField(data, "namaPerangkat", { required: true })!,
    serialNumber: stringField(data, "serialNumber"),
    tagging: stringField(data, "tagging"),
  };
}

/**
 * Returns true if the given role has permission to manage users (create/delete).
 * Both "manager" and "admin" roles are authorized.
 */
export function canManageUsers(role?: UserRole): boolean {
  return role === "manager" || role === "admin";
}
