"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { ITEM_STATUS_VALUES } from "@/lib/constants/sparepartItem";
import SparepartGroupDetailModal from "@/components/SparepartGroupDetailModal";
import {
  getSparepartItems,
  deleteSparepartItem,
  deleteMultipleSparepartItems,
  updateMultipleSparepartItems,
  getItemsPerluVerifikasiCount,
} from "@/lib/firebase/sparepartItems";
import { getSpareparts } from "@/lib/firebase/spareparts";
import { exportSelectedToExcel } from "@/lib/utils/excel";
import {
  filterSparepartItems,
  groupSparepartItems,
  paginateGroups,
  getStatusBadgeClass,
  resolveLokasiDisplay,
  SparepartItemGroup,
} from "@/lib/utils/sparepartGroups";
import { SparepartItem } from "@/types";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  FileSpreadsheet,
  Package,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckSquare,
  Square,
  X,
  Download,
  Filter,
  Loader2,
  Eye,
  Camera,
  Trash2,
  Calendar,
} from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 15;

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center px-6 py-4 border-b border-telkomsat-gray-lighter"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-telkomsat-gray-lighter rounded w-3/4" />
            <div className="h-3 bg-telkomsat-gray-lighter rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SparepartsPage() {
  const { user } = useAuthStore();
  const isReadOnly = user?.role !== "admin_gudang";
  const [items, setItems] = useState<SparepartItem[]>([]);
  const [allItems, setAllItems] = useState<SparepartItem[]>([]);
  const [kategoriMap, setKategoriMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [detailGroup, setDetailGroup] = useState<SparepartItemGroup | null>(null);
  const [selectedMainIds, setSelectedMainIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkCariFisik, setBulkCariFisik] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLokasi, setBulkLokasi] = useState("");
  const [bulkTarget, setBulkTarget] = useState<"selected" | "filtered">("selected");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingAllItems, setLoadingAllItems] = useState(false);
  const [exportFilterStatus, setExportFilterStatus] = useState<string>("all");
  const [exportFilterLokasi, setExportFilterLokasi] = useState<string>("all");
  const [exportFilterCariFisik, setExportFilterCariFisik] = useState<string>("all");
  const [exportSearchQuery, setExportSearchQuery] = useState("");

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const [all, verifikasiCount, spareparts] = await Promise.all([
        getSparepartItems(),
        getItemsPerluVerifikasiCount(),
        getSpareparts(),
      ]);

      setItems(all);
      setAllItems(all);
      setPendingVerificationCount(verifikasiCount);
      setKategoriMap(
        new Map(spareparts.map((sp) => [sp.id, sp.kategori]))
      );
    } catch (error) {
      toast.error("Gagal memuat data sparepart");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const filteredItems = useMemo(
    () =>
      filterSparepartItems(items, {
        searchQuery,
        filterStatus,
      }),
    [items, searchQuery, filterStatus]
  );

  useEffect(() => {
    setSelectedMainIds((prev) => {
      const availableIds = new Set(filteredItems.map((item) => item.id));
      const next = new Set([...prev].filter((id) => availableIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredItems]);

  const allGroups = useMemo(
    () => groupSparepartItems(filteredItems, kategoriMap),
    [filteredItems, kategoriMap]
  );

  const totalGroups = allGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE));
  const paginatedGroups = useMemo(
    () => paginateGroups(allGroups, currentPage, PAGE_SIZE),
    [allGroups, currentPage]
  );

  const filteredItemIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );
  const allItemIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedMainCount = selectedMainIds.size;
  const allFilteredSelected =
    filteredItemIds.length > 0 &&
    filteredItemIds.every((id) => selectedMainIds.has(id));

  const handleRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadItems();
    setRefreshing(false);
    toast.success("Data berhasil di-refresh");
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus item "${nama}"?`)) return;

    try {
      await deleteSparepartItem(id, {
        name: user?.nama,
        role: user?.role,
      });
      toast.success("Item berhasil dihapus");
      await loadItems();

      if (detailGroup) {
        const remaining = detailGroup.items.filter((i) => i.id !== id);
        if (remaining.length === 0) {
          setDetailGroup(null);
        } else {
          setDetailGroup({
            ...detailGroup,
            jumlah: remaining.length,
            items: remaining,
            lokasiDisplay: resolveLokasiDisplay(remaining),
          });
        }
      }
    } catch (error) {
      toast.error("Gagal menghapus item");
      console.error(error);
    }
  };

  const toggleSelectGroup = (group: SparepartItemGroup) => {
    const groupIds = group.items.map((item) => item.id);
    const isSelected = groupIds.every((id) => selectedMainIds.has(id));

    setSelectedMainIds((prev) => {
      const next = new Set(prev);
      groupIds.forEach((id) => {
        if (isSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedMainIds((prev) => {
      if (allFilteredSelected) return new Set();
      const next = new Set(prev);
      filteredItemIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearMainSelection = () => setSelectedMainIds(new Set());

  const deleteItemsByIds = async (ids: string[], label: string) => {
    if (ids.length === 0) {
      toast.error("Tidak ada item yang dipilih");
      return;
    }

    const confirmed = confirm(`Yakin ingin menghapus ${ids.length} item ${label}?`);
    if (!confirmed) return;

    if (ids.length > 20) {
      const typed = prompt(`Ketik HAPUS untuk menghapus ${ids.length} item.`);
      if (typed !== "HAPUS") return;
    }

    setBulkDeleting(true);
    try {
      const result = await deleteMultipleSparepartItems(ids, {
        name: user?.nama,
        role: user?.role,
      });
      if (result.failed > 0) {
        toast.error(`${result.success} item dihapus, ${result.failed} gagal`);
      } else {
        toast.success(`${result.success} item berhasil dihapus`);
      }
      clearMainSelection();
      setDetailGroup(null);
      await loadItems();
    } catch (error) {
      toast.error("Gagal menghapus data");
      console.error(error);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteSelected = () =>
    deleteItemsByIds([...selectedMainIds], "yang dipilih");

  const handleDeleteFiltered = () =>
    deleteItemsByIds(filteredItemIds, filterStatus === "all" && !searchQuery ? "hasil filter saat ini" : "sesuai filter");

  const handleDeleteAll = () =>
    deleteItemsByIds(allItemIds, "di seluruh data sparepart");

  const handleBulkUpdate = async () => {
    const targetIds =
      bulkTarget === "filtered" ? filteredItemIds : [...selectedMainIds];
    const payload: Partial<SparepartItem> = {};

    if (bulkCariFisik) payload.cariFisik = bulkCariFisik as SparepartItem["cariFisik"];
    if (bulkStatus) payload.status = bulkStatus as SparepartItem["status"];
    if (bulkLokasi.trim()) payload.lokasiSaatIni = bulkLokasi.trim();

    if (targetIds.length === 0) {
      toast.error(
        bulkTarget === "filtered"
          ? "Tidak ada item pada hasil filter"
          : "Pilih minimal 1 item"
      );
      return;
    }
    if (Object.keys(payload).length === 0) {
      toast.error("Pilih minimal satu field untuk diperbarui");
      return;
    }

    const label =
      bulkTarget === "filtered"
        ? `${targetIds.length} item hasil filter`
        : `${targetIds.length} item pilihan`;
    if (!confirm(`Terapkan perubahan ke ${label}?`)) return;

    setBulkUpdating(true);
    try {
      const result = await updateMultipleSparepartItems(targetIds, payload, {
        name: user?.nama,
        role: user?.role,
      });
      if (result.failed > 0) {
        toast.error(`${result.success} item diperbarui, ${result.failed} gagal`);
      } else {
        toast.success(`${result.success} item berhasil diperbarui`);
      }
      setBulkCariFisik("");
      setBulkStatus("");
      setBulkLokasi("");
      await loadItems();
    } catch (error) {
      toast.error("Gagal memperbarui item");
      console.error(error);
    } finally {
      setBulkUpdating(false);
    }
  };

  const openGroupDetail = (group: SparepartItemGroup) => {
    setDetailGroup(group);
  };

  const loadAllItemsForExport = async () => {
    setLoadingAllItems(true);
    try {
      const all = await getSparepartItems();
      setAllItems(all);
    } catch (error) {
      toast.error("Gagal memuat data untuk export");
    } finally {
      setLoadingAllItems(false);
    }
  };

  const openExportModal = async () => {
    setShowExportModal(true);
    setSelectedIds(new Set());
    setExportFilterStatus("all");
    setExportFilterLokasi("all");
    setExportFilterCariFisik("all");
    setExportSearchQuery("");
    await loadAllItemsForExport();
  };

  const getFilteredExportItems = () => {
    return filterSparepartItems(allItems, {
      searchQuery: exportSearchQuery,
      filterStatus: exportFilterStatus,
    }).filter((item) => {
      const matchesLokasi =
        exportFilterLokasi === "all" ||
        item.lokasiSaatIni === exportFilterLokasi;
      const matchesCariFisik =
        exportFilterCariFisik === "all" ||
        item.cariFisik === exportFilterCariFisik;
      return matchesLokasi && matchesCariFisik;
    });
  };

  const getUniqueValues = (key: keyof SparepartItem) => {
    const values = new Set<string>();
    allItems.forEach((item) => {
      const value = item[key];
      if (value && typeof value === "string") values.add(value);
    });
    return Array.from(values).sort();
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllExport = () => {
    const filtered = getFilteredExportItems();
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((item) => item.id)));
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal 1 item untuk export");
      return;
    }
    setExporting(true);
    try {
      const selectedItems = allItems.filter((item) => selectedIds.has(item.id));
      exportSelectedToExcel(selectedItems);
      toast.success(`${selectedItems.length} item berhasil di-export!`);
      setShowExportModal(false);
      setSelectedIds(new Set());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal export";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllFiltered = () => {
    const filteredExportItems = getFilteredExportItems();
    if (filteredExportItems.length === 0) {
      toast.error("Tidak ada item yang sesuai filter");
      return;
    }
    setExporting(true);
    try {
      exportSelectedToExcel(filteredExportItems);
      toast.success(`${filteredExportItems.length} item berhasil di-export!`);
      setShowExportModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal export";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-in-left">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
              Data Sparepart
            </h1>
            <p className="text-gray-400 text-lg">
              {isReadOnly
                ? "Lihat inventaris unit fisik (read-only)"
                : items.length > 0
                  ? `${totalGroups} grup · ${filteredItems.length} unit fisik${filteredItems.length !== items.length ? ` (dari ${items.length})` : ""}`
                  : "Kelola data sparepart dan QR Code"}
            </p>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {!isReadOnly && (
            <Link
              href="/spareparts/verifikasi"
              className="relative group flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Verifikasi</span>
              {pendingVerificationCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  {pendingVerificationCount > 99 ? "99+" : pendingVerificationCount}
                </span>
              )}
            </Link>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {!isReadOnly && (
            <>
            <button
              type="button"
              onClick={openExportModal}
              className="group flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <Link
              href="/spareparts/export-import"
              className="group flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Excel</span>
            </Link>
            {user?.role === "admin_gudang" && (
              <Link
                href="/spareparts/import-foto"
                className="group flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
              >
                <Camera className="w-5 h-5" />
                <span className="hidden sm:inline">Import Foto</span>
              </Link>
            )}
            <Link
              href="/spareparts/tambah"
              className="group flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold shadow-lg shadow-red-600/30"
            >
              <Plus className="w-5 h-5" />
              <span>Tambah</span>
            </Link>
            </>
            )}
          </div>
        </div>

        <div
          className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl p-5 border border-white/10 animate-slide-in-right anim-delay-100 space-y-4 text-white"
        >
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama, SN, tagging, status, lokasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-white/15 rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-white/5 text-white placeholder-gray-400 focus:bg-white/10"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-3 border border-white/15 rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none bg-[#161922] text-white"
              >
                <option value="all">Semua Status Stok</option>
                {ITEM_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!isReadOnly && selectedMainCount > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-5 border border-telkomsat-gray-lighter space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-telkomsat-black">Seleksi Data</p>
                <p className="text-sm text-telkomsat-gray">
                  {selectedMainCount} item dipilih dari {filteredItems.length} item hasil filter
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  disabled={filteredItems.length === 0 || bulkDeleting || bulkUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-telkomsat-gray-lighter font-semibold hover:bg-telkomsat-gray-lighter disabled:opacity-50"
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {allFilteredSelected ? "Batalkan Semua" : "Pilih Semua Filter"}
                </button>
                <button
                  type="button"
                  onClick={clearMainSelection}
                  disabled={selectedMainCount === 0 || bulkDeleting || bulkUpdating}
                  className="px-4 py-2 rounded-xl border border-telkomsat-gray-lighter font-semibold hover:bg-telkomsat-gray-lighter disabled:opacity-50"
                >
                  Kosongkan Pilihan
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedMainCount === 0 || bulkDeleting || bulkUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Pilihan
                </button>
                <button
                  type="button"
                  onClick={handleDeleteFiltered}
                  disabled={filteredItems.length === 0 || bulkDeleting || bulkUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 font-semibold hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Hasil Filter
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  disabled={items.length === 0 || bulkDeleting || bulkUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 text-red-800 border border-red-300 font-semibold hover:bg-red-200 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Semua Data
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 border-t border-telkomsat-gray-lighter pt-4">
              <select
                value={bulkTarget}
                onChange={(e) =>
                  setBulkTarget(e.target.value as "selected" | "filtered")
                }
                className="px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl bg-telkomsat-gray-lighter/30"
              >
                <option value="selected">Terapkan ke pilihan</option>
                <option value="filtered">Terapkan ke hasil filter</option>
              </select>
              <select
                value={bulkCariFisik}
                onChange={(e) => setBulkCariFisik(e.target.value)}
                className="px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl bg-telkomsat-gray-lighter/30"
              >
                <option value="">Cari fisik: tidak diubah</option>
                <option value="Sesuai">Sesuai</option>
                <option value="Tidak Ditemukan">Tidak Ditemukan</option>
                <option value="Outstanding">Outstanding</option>
                <option value="Mutasi Keluar">Mutasi Keluar</option>
              </select>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl bg-telkomsat-gray-lighter/30"
              >
                <option value="">Status: tidak diubah</option>
                {ITEM_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={bulkLokasi}
                onChange={(e) => setBulkLokasi(e.target.value)}
                placeholder="Lokasi baru (opsional)"
                className="px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl bg-telkomsat-gray-lighter/30"
              />
              <button
                type="button"
                onClick={handleBulkUpdate}
                disabled={bulkUpdating || bulkDeleting}
                className="px-4 py-2.5 rounded-xl bg-telkomsat-red text-white font-semibold hover:bg-telkomsat-red-dark disabled:opacity-50"
              >
                {bulkUpdating ? "Memperbarui..." : "Terapkan Update"}
              </button>
            </div>
          </div>
        )}

        <div
          className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 overflow-hidden animate-scale-in anim-delay-200 text-white"
        >
          {loading ? (
            <TableSkeleton />
          ) : paginatedGroups.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 opacity-50" />
              <p className="text-white font-bold text-lg">
                {searchQuery || filterStatus !== "all"
                  ? "Tidak ada grup yang ditemukan"
                  : "Belum ada data sparepart"}
              </p>
              {!isReadOnly && !searchQuery && filterStatus === "all" && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/spareparts/tambah"
                    className="inline-flex items-center space-x-2 text-telkomsat-red hover:underline font-bold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Tambah Item Manual</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-white/10 border-b border-white/10">
                    <tr>
                      {!isReadOnly && (
                        <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Pilih
                        </th>
                      )}
                      <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Nama Perangkat
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Jumlah
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Lokasi
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Tanggal Masuk
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedGroups.map((group, index) => {
                      const groupIds = group.items.map((item) => item.id);
                      const groupSelected = groupIds.every((id) =>
                        selectedMainIds.has(id)
                      );
                      const groupPartiallySelected =
                        !groupSelected &&
                        groupIds.some((id) => selectedMainIds.has(id));

                      return (
                        <tr
                          key={group.key}
                          className={`transition-all duration-200 hover:bg-white/10 ${
                            groupSelected || groupPartiallySelected ? "bg-red-500/10" : ""
                          }`}
                          style={{
                            animation: `fadeIn 0.2s ease-out ${index * 0.03}s forwards`,
                          }}
                        >
                          {!isReadOnly && (
                            <td className="px-6 py-4">
                              <button
                                type="button"
                                onClick={() => toggleSelectGroup(group)}
                                className="p-1 text-telkomsat-red hover:bg-telkomsat-red/20 rounded-lg transition-colors"
                                title={groupSelected ? "Batalkan pilihan grup" : "Pilih semua item grup"}
                              >
                                {groupSelected || groupPartiallySelected ? (
                                  <CheckSquare className="w-5 h-5" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="px-6 py-4">
                          <span className="font-bold text-white">
                            {group.namaPerangkat}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300">
                          {group.kategori || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-lg ${getStatusBadgeClass(group.status)}`}
                          >
                            {group.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 bg-telkomsat-red/20 text-telkomsat-red font-extrabold rounded-lg text-sm border border-telkomsat-red/30">
                            {group.jumlah}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300 max-w-xs">
                          {group.lokasiDisplay}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>
                              {group.latestCreatedAt ? formatDate(group.latestCreatedAt) : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openGroupDetail(group)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white rounded-xl hover:scale-105 transition-all font-bold text-xs shadow-md shadow-red-600/20"
                          >
                            <Eye className="w-4 h-4" />
                            Detail
                          </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-telkomsat-gray-lighter flex flex-col sm:flex-row items-center justify-between gap-4 bg-telkomsat-gray-lighter/30">
                <div className="text-sm text-telkomsat-gray">
                  Menampilkan{" "}
                  {totalGroups === 0
                    ? 0
                    : (currentPage - 1) * PAGE_SIZE + 1}{" "}
                  - {Math.min(currentPage * PAGE_SIZE, totalGroups)} dari{" "}
                  {totalGroups} grup
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || loading}
                    className="flex items-center space-x-1 px-4 py-2 bg-white border border-telkomsat-gray-lighter rounded-lg hover:bg-telkomsat-gray-lighter transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <span className="px-4 py-2 bg-telkomsat-red text-white rounded-lg font-semibold min-w-[3rem] text-center">
                    {currentPage}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages || loading}
                    className="flex items-center space-x-1 px-4 py-2 bg-white border border-telkomsat-gray-lighter rounded-lg hover:bg-telkomsat-gray-lighter transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <SparepartGroupDetailModal
          group={detailGroup}
          onClose={() => setDetailGroup(null)}
          onDeleteItem={handleDelete}
          readOnly={isReadOnly}
        />

        {showExportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-3 lg:p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-auto h-full flex flex-col animate-scale-in">
              <div className="p-6 border-b border-telkomsat-gray-lighter flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-telkomsat-black">
                    Export Data Sparepart
                  </h2>
                  <p className="text-telkomsat-gray mt-1">
                    Export per item fisik (bukan per grup)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportModal(false);
                    setSelectedIds(new Set());
                  }}
                  className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-telkomsat-gray" />
                </button>
              </div>

              <div className="p-4 border-b border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative lg:col-span-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-telkomsat-gray w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Cari..."
                      value={exportSearchQuery}
                      onChange={(e) => setExportSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-telkomsat-gray-lighter rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <select
                    value={exportFilterStatus}
                    onChange={(e) => setExportFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-telkomsat-gray-lighter rounded-lg text-sm"
                  >
                    <option value="all">Semua Status Stok</option>
                    {ITEM_STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={exportFilterLokasi}
                    onChange={(e) => setExportFilterLokasi(e.target.value)}
                    className="px-3 py-2 border border-telkomsat-gray-lighter rounded-lg text-sm"
                  >
                    <option value="all">Semua Lokasi</option>
                    {getUniqueValues("lokasiSaatIni").map((lokasi) => (
                      <option key={lokasi} value={lokasi}>
                        {lokasi}
                      </option>
                    ))}
                  </select>
                  <select
                    value={exportFilterCariFisik}
                    onChange={(e) => setExportFilterCariFisik(e.target.value)}
                    className="px-3 py-2 border border-telkomsat-gray-lighter rounded-lg text-sm"
                  >
                    <option value="all">Semua Cari Fisik</option>
                    <option value="Sesuai">Sesuai</option>
                    <option value="Tidak Ditemukan">Tidak Ditemukan</option>
                    <option value="Outstanding">Outstanding</option>
                    <option value="Mutasi Keluar">Mutasi Keluar</option>
                  </select>
                </div>
              </div>

              <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between flex-shrink-0">
                <button
                  type="button"
                  onClick={toggleSelectAllExport}
                  className="flex items-center space-x-2 text-sm font-medium text-green-700"
                >
                  {selectedIds.size === getFilteredExportItems().length &&
                  getFilteredExportItems().length > 0 ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  <span>Pilih Semua ({getFilteredExportItems().length})</span>
                </button>
                <span className="text-sm font-semibold text-green-800">
                  {selectedIds.size} dipilih
                </span>
              </div>

              <div className="flex-1 overflow-auto">
                {loadingAllItems ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  </div>
                ) : getFilteredExportItems().length === 0 ? (
                  <div className="text-center py-20 text-telkomsat-gray">
                    Tidak ada item
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-telkomsat-gray-lighter/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 w-12" />
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                          Nama
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                          SN
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-telkomsat-gray-lighter">
                      {getFilteredExportItems().map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => toggleSelectItem(item.id)}
                          className={`cursor-pointer ${
                            selectedIds.has(item.id) ? "bg-green-50" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            {selectedIds.has(item.id) ? (
                              <CheckSquare className="w-5 h-5 text-green-600" />
                            ) : (
                              <Square className="w-5 h-5 text-telkomsat-gray" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {item.namaPerangkat}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {item.serialNumber || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {item.status || "Tersedia"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-4 border-t flex flex-wrap gap-3 justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-5 py-2.5 border-2 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExportAllFiltered}
                  disabled={exporting}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  Export Semua ({getFilteredExportItems().length})
                </button>
                <button
                  type="button"
                  onClick={handleExportSelected}
                  disabled={exporting || selectedIds.size === 0}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Export Pilihan ({selectedIds.size})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
