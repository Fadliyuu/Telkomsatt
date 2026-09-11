import { Transaksi, USER_ROLE_LABELS, UserRole } from "@/types";

type MaybeTransaction = Partial<Transaksi> &
  Partial<
    Record<
      | "technicianName"
      | "teknisi"
      | "jenisTeknisi"
      | "dilakukanOleh"
      | "requestedBy"
      | "approvedBy"
      | "adminGudang"
      | "namaSpare"
      | "namaPerangkat",
      string
    >
  >;

export function formatRoleName(role?: UserRole | string, name?: string): string {
  const cleanName = name?.trim();
  if (!cleanName) return "-";

  const label =
    role && role in USER_ROLE_LABELS
      ? USER_ROLE_LABELS[role as UserRole]
      : role
        ? String(role)
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
        : "User";

  return `${label} - ${cleanName}`;
}

export function getCarriedBy(transaction: MaybeTransaction): string {
  const carriedName =
    transaction.carriedByName ||
    transaction.namaPenerima ||
    transaction.technicianName ||
    transaction.teknisi ||
    transaction.namaTeknisi;
  const name = carriedName || transaction.requestedByName || transaction.requestedBy;

  const role =
    transaction.carriedByRole ||
    transaction.jabatanPenerima ||
    transaction.jenisTeknisi ||
    (!carriedName ? transaction.requestedByRole : undefined) ||
    (transaction.namaTeknisi || transaction.technicianName || transaction.teknisi
      ? "teknisi"
      : undefined);

  return formatRoleName(role, name);
}

export function getApprovedBy(transaction: MaybeTransaction): string {
  const name =
    transaction.approvedByName ||
    transaction.approvedBy ||
    transaction.adminGudang ||
    transaction.dilakukanOleh;

  const role =
    transaction.approvedByRole ||
    (transaction.adminGudang ? "admin_gudang" : undefined);

  return formatRoleName(role, name);
}

export function getTransactionSparepartLines(transaction: MaybeTransaction) {
  return {
    name: transaction.namaItem || transaction.namaSpare || transaction.namaPerangkat || "-",
    serialNumber: transaction.serialNumber || "-",
    tagging: transaction.tagging || "-",
  };
}

export function getTransactionLocation(transaction: MaybeTransaction): string {
  return transaction.lokasiTujuan || transaction.lokasiAsal || "-";
}
