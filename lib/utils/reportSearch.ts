import type { Transaksi } from "@/types";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionSparepartLines,
} from "@/lib/utils/transactionDisplay";

function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}

/**
 * Mencari pada informasi yang relevan di laporan, terutama lokasi tujuan.
 * Pencarian bersifat tidak peka huruf besar-kecil dan mendukung potongan kata.
 */
export function matchesReportSearch(
  transaction: Transaksi,
  query: string,
  sparepartName?: string
): boolean {
  const keyword = normalize(query);
  if (!keyword) return true;

  const sparepart = getTransactionSparepartLines(transaction);
  const searchableText = [
    sparepartName,
    sparepart.name,
    sparepart.serialNumber,
    sparepart.tagging,
    transaction.lokasiTujuan,
    getCarriedBy(transaction),
    getApprovedBy(transaction),
    transaction.jenisTransaksi,
    transaction.statusBarang,
    transaction.keterangan,
    transaction.nomorSpt,
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(keyword);
}
