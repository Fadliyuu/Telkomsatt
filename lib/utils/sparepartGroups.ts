import { SparepartItem } from "@/types";
import { normalizeItemStatus as normalizeStatus } from "@/lib/constants/sparepartItem";

export interface SparepartItemGroup {
  key: string;
  namaPerangkat: string;
  status: string;
  kategori?: string;
  jumlah: number;
  lokasiDisplay: string;
  latestCreatedAt?: Date;
  items: SparepartItem[];
}

export function normalizeItemStatus(status?: string): string {
  return normalizeStatus(status);
}

export function getGroupKey(namaPerangkat: string, status?: string): string {
  return `${namaPerangkat.trim()}::${normalizeItemStatus(status)}`;
}

export function filterSparepartItems(
  items: SparepartItem[],
  options: {
    searchQuery?: string;
    filterStatus?: string;
  }
): SparepartItem[] {
  const query = options.searchQuery?.trim().toLowerCase() ?? "";

  return items.filter((item) => {
    const status = normalizeItemStatus(item.status);

    if (options.filterStatus && options.filterStatus !== "all") {
      if (status !== options.filterStatus) return false;
    }

    if (!query) return true;

    return (
      item.namaPerangkat?.toLowerCase().includes(query) ||
      item.serialNumber?.toLowerCase().includes(query) ||
      item.tagging?.toLowerCase().includes(query) ||
      status.toLowerCase().includes(query) ||
      item.lokasiSaatIni?.toLowerCase().includes(query)
    );
  });
}

export function resolveLokasiDisplay(items: SparepartItem[]): string {
  const counts = new Map<string, number>();

  for (const item of items) {
    const lokasi = item.lokasiSaatIni?.trim() || "—";
    counts.set(lokasi, (counts.get(lokasi) ?? 0) + 1);
  }

  if (counts.size === 0) return "—";

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0][1];
  const top = sorted.filter(([, count]) => count === maxCount).map(([lokasi]) => lokasi);

  if (counts.size === 1) return top[0];
  if (top.length === 1 && maxCount > 1) return top[0];

  return top.join(", ");
}

export function groupSparepartItems(
  items: SparepartItem[],
  kategoriBySparepartId?: Map<string, string>
): SparepartItemGroup[] {
  const map = new Map<string, SparepartItem[]>();

  for (const item of items) {
    const nama = item.namaPerangkat?.trim() || "Tanpa Nama";
    const key = getGroupKey(nama, item.status);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const groups: SparepartItemGroup[] = [];

  for (const [key, groupItems] of map.entries()) {
    const first = groupItems[0];
    const namaPerangkat = first.namaPerangkat?.trim() || "Tanpa Nama";
    const status = normalizeItemStatus(first.status);

    let kategori: string | undefined;
    if (kategoriBySparepartId && first.idSparepart) {
      kategori = kategoriBySparepartId.get(first.idSparepart);
    }

    const times = groupItems
      .map((i) => (i.createdAt ? new Date(i.createdAt).getTime() : 0))
      .filter((t) => t > 0);
    const maxTime = times.length > 0 ? Math.max(...times) : 0;
    const latestCreatedAt = maxTime > 0 ? new Date(maxTime) : undefined;

    groups.push({
      key,
      namaPerangkat,
      status,
      kategori,
      jumlah: groupItems.length,
      lokasiDisplay: resolveLokasiDisplay(groupItems),
      latestCreatedAt,
      items: groupItems.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return (a.serialNumber || "").localeCompare(b.serialNumber || "");
      }),
    });
  }

  // Sort groups by latest creation / entry date DESCENDING (newest entry first, not alphabetical)
  return groups.sort((a, b) => {
    const timeA = a.latestCreatedAt ? a.latestCreatedAt.getTime() : 0;
    const timeB = b.latestCreatedAt ? b.latestCreatedAt.getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    const byName = a.namaPerangkat.localeCompare(b.namaPerangkat, "id");
    if (byName !== 0) return byName;
    return a.status.localeCompare(b.status, "id");
  });
}

export function paginateGroups<T>(groups: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return groups.slice(start, start + pageSize);
}

export function getStatusBadgeClass(status: string): string {
  if (status === "Rusak" || status === "Hilang") {
    return "bg-red-500/20 text-red-400 border border-red-500/30 font-bold";
  }
  if (status === "Digunakan" || status === "Maintenance" || status === "Perlu Pengecekan") {
    return "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold";
  }
  return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold";
}
