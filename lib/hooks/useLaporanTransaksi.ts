import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getTransactions } from "@/lib/firebase/transactions";
import { getSparepartById } from "@/lib/firebase/spareparts";
import { getSparepartItemById } from "@/lib/firebase/sparepartItems";
import { Transaksi } from "@/types";

export interface LaporanFilters {
  startDate: string;
  endDate: string;
  namaTeknisi?: string;
}

export function useLaporanTransaksi(filters: LaporanFilters) {
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [transactionsInPeriod, setTransactionsInPeriod] = useState<Transaksi[]>(
    []
  );
  const [sparepartNames, setSparepartNames] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  const resolveNames = useCallback(async (data: Transaksi[]) => {
    const uniqueIds = [...new Set(data.map((t) => t.idSparepart))];
    const names: Record<string, string> = {};

    data.forEach((t) => {
      if (t.namaItem && !names[t.idSparepart]) {
        names[t.idSparepart] = t.namaItem;
      }
    });

    await Promise.all(
      uniqueIds.map(async (id) => {
        if (names[id]) return;
        try {
          const item = await getSparepartItemById(id);
          if (item) {
            names[id] = item.namaPerangkat;
            return;
          }
        } catch {
          /* not item */
        }
        try {
          const sparepart = await getSparepartById(id);
          if (sparepart) names[id] = sparepart.namaSpare;
        } catch {
          /* not found */
        }
      })
    );

    setSparepartNames(names);
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const inPeriod = await getTransactions({
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate + "T23:59:59"),
      });
      inPeriod.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setTransactionsInPeriod(inPeriod);

      let data = inPeriod;
      if (filters.namaTeknisi?.trim()) {
        const n = filters.namaTeknisi.trim();
        data = data.filter(
          (t) =>
            ((t.carriedByName || t.namaPenerima || t.namaTeknisi) ?? "").trim() === n
        );
      }

      setTransactions(data);
      await resolveNames(data);
    } catch (error: unknown) {
      console.error("Error loading transactions:", error);
      const msg =
        error instanceof Error ? error.message : "Gagal memuat laporan";
      toast.error(
        msg.includes("index")
          ? "Query membutuhkan index Firestore. Hubungi admin."
          : "Gagal memuat laporan. Periksa koneksi atau izin."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, resolveNames]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const getUniqueTechnicians = useCallback(() => {
    const names = transactionsInPeriod
      .map((t) => ((t.carriedByName || t.namaPenerima || t.namaTeknisi) ?? "").trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "id"));
  }, [transactionsInPeriod]);

  return {
    transactions,
    transactionsInPeriod,
    sparepartNames,
    loading,
    reload: loadTransactions,
    getUniqueTechnicians,
  };
}
