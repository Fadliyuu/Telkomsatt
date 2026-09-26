import { JenisTransaksi, Transaksi } from "@/types";

/** Arah pergerakan stok dari sudut pandang gudang */
export type ArahBarang = "keluar" | "masuk" | "lainnya";

export const JENIS_TRANSAKSI_LABELS: Record<JenisTransaksi, string> = {
  MOVE: "Pindah Lokasi",
  OUT: "Barang Keluar",
  DAMAGE: "Barang Rusak",
  RETURN: "Pengembalian Barang",
  FOUND: "Barang Ditemukan (Legacy)",
  DISMANTLE: "Dismantle (Legacy)",
};

/** Barang keluar gudang / ke lapangan */
export const JENIS_BARANG_KELUAR: JenisTransaksi[] = ["MOVE", "OUT", "DISMANTLE"];

/** Barang masuk gudang / ke inventaris */
export const JENIS_BARANG_MASUK: JenisTransaksi[] = ["RETURN", "FOUND"];

export function getArahBarang(jenis: JenisTransaksi): ArahBarang {
  if (JENIS_BARANG_KELUAR.includes(jenis)) return "keluar";
  if (JENIS_BARANG_MASUK.includes(jenis)) return "masuk";
  return "lainnya";
}

export function isBarangKeluar(jenis: JenisTransaksi): boolean {
  return getArahBarang(jenis) === "keluar";
}

export function isBarangMasuk(jenis: JenisTransaksi): boolean {
  return getArahBarang(jenis) === "masuk";
}

export function filterByArah(
  transactions: Transaksi[],
  arah?: ArahBarang | "semua"
): Transaksi[] {
  if (!arah || arah === "semua") return transactions;
  return transactions.filter((t) => getArahBarang(t.jenisTransaksi) === arah);
}

export function getGudangStats(transactions: Transaksi[]) {
  const keluar = transactions.filter((t) => isBarangKeluar(t.jenisTransaksi));
  const masuk = transactions.filter((t) => isBarangMasuk(t.jenisTransaksi));
  const lainnya = transactions.filter(
    (t) => getArahBarang(t.jenisTransaksi) === "lainnya"
  );

  return {
    total: transactions.length,
    keluar: keluar.length,
    masuk: masuk.length,
    lainnya: lainnya.length,
    move: transactions.filter((t) => t.jenisTransaksi === "MOVE").length,
    return: transactions.filter((t) => t.jenisTransaksi === "RETURN").length,
    found: transactions.filter((t) => t.jenisTransaksi === "FOUND").length,
    dismantle: transactions.filter((t) => t.jenisTransaksi === "DISMANTLE")
      .length,
    damage: transactions.filter((t) => t.jenisTransaksi === "DAMAGE").length,
  };
}

export function formatLokasiPergerakan(t: Transaksi): string {
  const asal = t.lokasiAsal?.trim();
  const tujuan = t.lokasiTujuan?.trim();
  if (asal && tujuan) return `${asal} → ${tujuan}`;
  return tujuan || asal || "—";
}

export function getArahBadgeClass(arah: ArahBarang): string {
  switch (arah) {
    case "keluar":
      return "bg-orange-100 text-orange-800 border border-orange-200";
    case "masuk":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

export function getArahLabel(arah: ArahBarang): string {
  switch (arah) {
    case "keluar":
      return "Keluar";
    case "masuk":
      return "Masuk";
    default:
      return "Lainnya";
  }
}

export function getJenisBadgeClass(jenis: JenisTransaksi): string {
  switch (jenis) {
    case "MOVE":
      return "bg-blue-100 text-blue-700 border border-blue-200";
    case "RETURN":
      return "bg-green-100 text-green-700 border border-green-200";
    case "FOUND":
      return "bg-teal-100 text-teal-700 border border-teal-200";
    case "DISMANTLE":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "DAMAGE":
      return "bg-red-100 text-red-700 border border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}
