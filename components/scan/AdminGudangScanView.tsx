"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  QrCode,
  Camera,
  Trash2,
  Loader2,
  Package,
  CheckSquare,
  Square,
  FileText,
  Truck,
  Pencil,
  X,
  Send,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import QRScanner from "@/components/QRScanner";
import UnrecognizedQRModal from "@/components/scan/UnrecognizedQRModal";
import ImageUpload from "@/components/ImageUpload";
import {
  getSparepartItemById,
  resolveSparepartItemIdentifier,
  searchSparepartItemSuggestions,
  createSparepartItem,
} from "@/lib/firebase/sparepartItems";
import { getLokasiList } from "@/lib/firebase/lokasi";
import { getUsers } from "@/lib/firebase/users";
import { submitAdminScanBatch } from "@/lib/firebase/adminScanSubmit";
import {
  useAdminScanStore,
  type AdminScanMode,
  type AdminScanItem,
} from "@/lib/store/useAdminScanStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import {
  ITEM_STATUS_VALUES,
  type ItemStatusValue,
} from "@/lib/constants/sparepartItem";
import {
  BERITA_ACARA_TEMPLATES,
  LAYANAN_BA_CHECKLIST,
} from "@/lib/constants/beritaAcara";
import {
  downloadSuratJalanPdf,
  createSuratJalanNumber,
} from "@/lib/pdf/suratJalan";
import {
  downloadBeritaAcaraPdf,
  createBeritaAcaraNumber,
} from "@/lib/pdf/beritaAcara";
import { USER_ROLE_LABELS, USER_ROLES, type SparepartItem, type User, type UserRole } from "@/types";

const MODE_LABELS: Record<
  AdminScanMode,
  { label: string; short: string; color: string }
> = {
  UPDATE: { label: "Update Status", short: "Update", color: "bg-slate-600" },
  MOVE: { label: "Serah / Bawa", short: "Bawa", color: "bg-blue-600" },
  DAMAGE: { label: "Lapor Rusak", short: "Rusak", color: "bg-red-600" },
  FOUND: { label: "Ditemukan (Legacy)", short: "Found", color: "bg-gray-400" },
  DISMANTLE: { label: "Dismantle (Legacy)", short: "Dism.", color: "bg-gray-400" },
};

const ACTIVE_ADMIN_MODES: AdminScanMode[] = ["UPDATE", "MOVE", "DAMAGE"];

const MODE_DESCRIPTIONS: Partial<Record<AdminScanMode, string>> = {
  UPDATE: "Perbarui status, lokasi, dan keterangan barang melalui panel Update Status.",
  MOVE: "Pilih penerima, isi nomor SPT dan lokasi tujuan untuk menyerahkan barang. Status barang menjadi Digunakan.",
  DAMAGE: "Isi lokasi barang dan keterangan kerusakan. Status barang menjadi Rusak saat disimpan.",
};

function ItemRow({
  item,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: AdminScanItem;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const modeInfo = MODE_LABELS[item.mode] || MODE_LABELS.UPDATE;

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        item.selected ? "bg-red-50/50 border-red-200" : "bg-white border-telkomsat-gray-lighter"
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 sm:mt-0 text-telkomsat-red hover:bg-telkomsat-red/10 p-1 rounded-lg"
        >
          {item.selected ? (
            <CheckSquare className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-telkomsat-black text-sm truncate">
              {item.namaPerangkat}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${modeInfo.color}`}
            >
              {modeInfo.short}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-telkomsat-gray mt-0.5">
            {item.serialNumber && <span>SN: <span className="font-mono font-medium text-black">{item.serialNumber}</span></span>}
            {item.tagging && <span>Tag: <span className="font-mono font-medium text-black">{item.tagging}</span></span>}
            {item.lokasiSaatIni && <span>Lokasi: <span className="font-medium text-black">{item.lokasiSaatIni}</span></span>}
          </div>
          {item.mode === "UPDATE" && (item.newStatus || item.newLokasi) && (
            <p className="text-xs text-blue-600 mt-1 font-medium">
              Update → {item.newStatus || "Status tetap"} | {item.newLokasi || "Lokasi tetap"}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 self-end sm:self-center flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AdminGudangScanView() {
  const { user } = useAuthStore();
  const {
    items,
    defaultMode,
    docMeta,
    setDefaultMode,
    setDocMeta,
    addOrRescanItem,
    updateItem,
    removeItem,
    toggleSelect,
    selectAll,
    clearAll,
  } = useAdminScanStore();

  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lokasiOptions, setLokasiOptions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [manualSuggestions, setManualSuggestions] = useState<SparepartItem[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ItemStatusValue>("Tersedia");
  const [bulkKeterangan, setBulkKeterangan] = useState("");
  const [bulkLokasi, setBulkLokasi] = useState("");
  const [genSuratJalan, setGenSuratJalan] = useState(true);
  const [genBeritaAcara, setGenBeritaAcara] = useState(false);
  const [showBaDetail, setShowBaDetail] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const roleLabel = user?.role ? USER_ROLE_LABELS[user.role] : "Admin";

  const toggleLayanan = (layanan: string) => {
    const current = docMeta.layananTerpilih || [];
    const next = current.includes(layanan)
      ? current.filter((l) => l !== layanan)
      : [...current, layanan];
    setDocMeta({ layananTerpilih: next });
  };

  useEffect(() => {
    getLokasiList()
      .then((list) => setLokasiOptions(list.map((l) => l.namaLokasi)))
      .catch(() => {});
    getUsers()
      .then((list) => setUsers(list.filter((u) => u.status === "aktif")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showManual || manualId.trim().length < 2) {
      setManualSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setManualSearching(true);
      try {
        const rows = await searchSparepartItemSuggestions(manualId, 8);
        if (!cancelled) setManualSuggestions(rows);
      } catch {
        if (!cancelled) setManualSuggestions([]);
      } finally {
        if (!cancelled) setManualSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [manualId, showManual]);

  const selectedUpdateItems = items.filter((i) => i.selected && i.mode === "UPDATE");
  const selectedCount = selectedUpdateItems.length;
  const moveCount = items.filter((i) => i.mode === "MOVE").length;
  const showUpdateFields = defaultMode === "UPDATE" || items.some((i) => i.mode === "UPDATE");
  const showMoveFields = defaultMode === "MOVE" || moveCount > 0;
  const showDamageFields = defaultMode === "DAMAGE" || items.some((i) => i.mode === "DAMAGE");
  const showDestination = showMoveFields || showDamageFields || items.some(
    (i) => i.mode === "FOUND" || i.mode === "DISMANTLE"
  );
  const hasOtherModeItems = items.some((i) => i.mode !== defaultMode);
  const editingItem = items.find((i) => i.id === editingId);
  const roleOptions = USER_ROLES.filter((role) => users.some((u) => u.role === role));
  const selectedRoleUsers = docMeta.penerimaRole
    ? users.filter((u) => u.role === docMeta.penerimaRole)
    : [];
  const selectedPenerima = selectedRoleUsers.find((u) => u.id === docMeta.penerimaUserId);

  const loadItemFromDb = useCallback(async (itemId: string) => {
    const data = await getSparepartItemById(itemId);
    if (!data) return null;
    return {
      idSparepart: data.id,
      mode: defaultMode,
      namaPerangkat: data.namaPerangkat,
      serialNumber: data.serialNumber || undefined,
      tagging: data.tagging || undefined,
      lokasiSaatIni: data.lokasiSaatIni,
      status: data.status,
      keterangan: data.keterangan,
      newStatus: data.status,
      newKeterangan: data.keterangan || "",
      newLokasi: data.lokasiSaatIni || "",
    };
  }, [defaultMode]);

  const handleAddItem = async (itemId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const payload = await loadItemFromDb(itemId);
      if (!payload) {
        toast.error("Item tidak ditemukan di database");
        return;
      }

      const wasExisting = items.some((i) => i.idSparepart === itemId);
      const lineId = addOrRescanItem(payload);
      if (wasExisting) {
        toast("Item di-scan ulang — data diperbarui", { icon: "🔄" });
        setEditingId(lineId);
      } else {
        toast.success(`✓ ${payload.namaPerangkat} ditambahkan`);
        if (defaultMode === "UPDATE") setEditingId(lineId);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat item");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualAdd = async (value: string) => {
    const identifier = value.trim();
    if (!identifier) return;

    setIsProcessing(true);
    try {
      const item = await resolveSparepartItemIdentifier(identifier);
      if (!item) {
        toast.error("Item tidak ditemukan dari ID, SN, atau tagging");
        return;
      }
      setIsProcessing(false);
      await handleAddItem(item.id);
      setManualId("");
      setManualSuggestions([]);
      setShowManual(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencari item");
      setIsProcessing(false);
    }
  };

  const handleBulkApply = () => {
    if (selectedCount === 0) {
      toast.error("Pilih minimal satu item dengan mode Update Status");
      return;
    }
    const patch = {
      newStatus: bulkStatus,
      ...(bulkKeterangan.trim() ? { newKeterangan: bulkKeterangan } : {}),
      ...(bulkLokasi.trim() ? { newLokasi: bulkLokasi } : {}),
    };
    selectedUpdateItems.forEach((item) => updateItem(item.id, patch));
    toast.success(`Diterapkan ke ${selectedCount} item terpilih`);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Belum ada item di daftar scan");
      return;
    }

    const needsPenerima = moveCount > 0 || genBeritaAcara;
    if (needsPenerima && !docMeta.penerimaRole) {
      toast.error("Pilih role penerima / penanggung jawab dokumen");
      return;
    }
    if (needsPenerima && !selectedPenerima) {
      toast.error("Pilih nama user sesuai role");
      return;
    }

    if (moveCount > 0 && !docMeta.nomorSpt?.trim()) {
      toast.error("Nomor SPT (Surat Perintah Tugas) wajib diisi untuk transaksi Serah/Bawa (MOVE)");
      return;
    }

    const needsTujuan = items.some(
      (i) => i.mode === "MOVE" || i.mode === "DAMAGE" || i.mode === "FOUND"
    );
    if (needsTujuan && !docMeta.lokasiTujuan.trim()) {
      toast.error("Lokasi tujuan / site wajib diisi");
      return;
    }

    if (genBeritaAcara && !docMeta.lokasiSite.trim()) {
      toast.error("Lokasi site wajib untuk berita acara");
      return;
    }

    setSubmitting(true);
    try {
      const adminName = user?.nama || "Admin Gudang";
      const penerima = needsPenerima ? selectedPenerima : undefined;
      const penerimaName = penerima?.nama || adminName;
      const result = await submitAdminScanBatch({
        items,
        namaTeknisi: penerimaName,
        penerimaRole: penerima?.role,
        penerimaUserId: penerima?.id,
        nomorSpt: moveCount > 0 ? docMeta.nomorSpt.trim() : "",
        lokasiTujuan: docMeta.lokasiTujuan.trim() || docMeta.lokasiSite.trim(),
        keteranganGlobal: items.some((item) => item.mode !== "UPDATE")
          ? docMeta.keteranganGlobal
          : undefined,
        adminName,
        adminUid: user?.id,
        adminRole: user?.role,
      });

      if (genSuratJalan && moveCount > 0) {
        await downloadSuratJalanPdf({
          nomor: createSuratJalanNumber(),
          namaTeknisi: penerimaName,
          jenisTeknisi: docMeta.penerimaRole
            ? USER_ROLE_LABELS[docMeta.penerimaRole]
            : docMeta.jenisTeknisi,
          lokasiTujuan: docMeta.lokasiTujuan.trim(),
          items,
          adminName,
          keterangan: docMeta.keteranganGlobal,
        });
      }

      if (genBeritaAcara) {
        await downloadBeritaAcaraPdf({
          nomor: createBeritaAcaraNumber(),
          jenis: docMeta.beritaAcaraJenis,
          lokasiSite: docMeta.lokasiSite.trim(),
          namaPelanggan: docMeta.namaPelanggan,
          alamat: docMeta.alamat,
          namaTeknisi: penerimaName,
          noHpTeknisi: docMeta.noHpTeknisi,
          namaPic: docMeta.namaPic,
          noHpPic: docMeta.noHpPic,
          noTiketComplaint: docMeta.noTiketComplaint,
          noTiketMaintenance: docMeta.noTiketMaintenance,
          tipeMaintenance: docMeta.tipeMaintenance,
          layananTerpilih: docMeta.layananTerpilih,
          sumberMasalah: docMeta.sumberMasalah,
          tindakan: docMeta.tindakan,
          catatanRingkasan: docMeta.catatanRingkasan,
          items,
          adminName,
          pekerjaanTambahan: docMeta.pekerjaanTambahan,
        });
      }

      toast.success(
        `Selesai: ${result.transacted} transaksi, ${result.updated} item diperbarui`,
        { duration: 4000 }
      );
      clearAll();
      setEditingId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {showScanner && (
        <QRScanner
          onScanSuccess={handleAddItem}
          onClose={() => setShowScanner(false)}
          keepOpen
        />
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-telkomsat-black">
              Scan Gudang — Admin
            </h1>
            <p className="text-sm text-telkomsat-gray mt-1">
              Multi-scan, update status massal, surat jalan & berita acara
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center gap-2 bg-telkomsat-red text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90"
            >
              <Camera className="w-4 h-4" />
              Scan QR
            </button>
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="inline-flex items-center gap-2 border-2 border-telkomsat-red text-telkomsat-red px-4 py-2.5 rounded-xl font-semibold text-sm"
            >
              <QrCode className="w-4 h-4" />
              ID Manual
            </button>
          </div>
        </div>

        {/* Mode */}
        <div className="bg-white rounded-xl border border-telkomsat-gray-lighter p-4 shadow-sm">
          <p className="text-sm font-semibold text-telkomsat-black mb-3">
            Mode scan default
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTIVE_ADMIN_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDefaultMode(mode)}
                aria-pressed={defaultMode === mode}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold text-white transition-all ${
                  defaultMode === mode
                    ? MODE_LABELS[mode].color + " shadow-md"
                    : "bg-telkomsat-gray-lighter text-telkomsat-black"
                }`}
              >
                {MODE_LABELS[mode].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-telkomsat-gray" aria-live="polite">
            {MODE_DESCRIPTIONS[defaultMode]}
          </p>
          <p className="mt-2 text-xs text-telkomsat-gray">
            Mode berlaku untuk scan berikutnya. Perubahan disimpan setelah menekan Proses &amp; Simpan.
          </p>
          {hasOtherModeItems && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Daftar masih berisi barang dengan mode lain. Form yang dibutuhkan barang tersebut tetap ditampilkan.
              Periksa label mode pada setiap barang sebelum menyimpan.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* List */}
          <div className="xl:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-telkomsat-black">
                Daftar Scan ({items.length})
              </h2>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => selectAll(true)}
                  className="text-telkomsat-red font-medium"
                >
                  Pilih semua
                </button>
                <span className="text-telkomsat-gray">|</span>
                <button
                  type="button"
                  onClick={() => selectAll(false)}
                  className="text-telkomsat-gray"
                >
                  Batal pilih
                </button>
                {items.length > 0 && (
                  <>
                    <span className="text-telkomsat-gray">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Kosongkan daftar?")) clearAll();
                      }}
                      className="text-red-600"
                    >
                      Kosongkan
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 max-h-[480px] overflow-y-auto space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-12 text-telkomsat-gray">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Belum ada barang di-scan</p>
                </div>
              ) : (
                items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleSelect(item.id)}
                    onEdit={() => setEditingId(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* Bulk */}
            {showUpdateFields && (
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-telkomsat-red" />
                  Update Status ({selectedCount} terpilih)
                </h3>
                <p className="mb-3 text-xs text-telkomsat-gray">
                  Pengaturan ini diterapkan hanya ke barang terpilih dengan mode Update Status.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold">Status stok</label>
                    <select
                      value={bulkStatus}
                      onChange={(e) =>
                        setBulkStatus(e.target.value as ItemStatusValue)
                      }
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    >
                      {ITEM_STATUS_VALUES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold">Lokasi baru</label>
                    <input
                      list="lokasi-datalist"
                      value={bulkLokasi}
                      onChange={(e) => setBulkLokasi(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      placeholder="Opsional"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold">Keterangan</label>
                    <textarea
                      value={bulkKeterangan}
                      onChange={(e) => setBulkKeterangan(e.target.value)}
                      rows={2}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      placeholder="Opsional"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBulkApply}
                    disabled={selectedCount === 0}
                    className="w-full py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    Terapkan ke {selectedCount} item
                  </button>
                </div>
              </div>
            )}

            {/* Dokumen */}
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <h3 className="font-bold text-sm mb-3">
                {showMoveFields && showDamageFields ? "Data serah barang & kerusakan" :
                  showMoveFields ? "Data serah barang" :
                  showDamageFields ? "Laporan kerusakan" : "Dokumen pendukung"}
              </h3>
              <div className="space-y-3 text-sm">
                {(showMoveFields || genBeritaAcara) && (
                  <>
                    <div>
                      <label className="text-xs font-semibold">
                        {showMoveFields ? "Dibawa oleh / sebagai" : "Role penanggung jawab Berita Acara"}
                      </label>
                      <select
                        value={docMeta.penerimaRole}
                        onChange={(e) =>
                          setDocMeta({
                            penerimaRole: e.target.value as UserRole | "",
                            penerimaUserId: "",
                            namaTeknisi: "",
                          })
                        }
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                      >
                        <option value="">Pilih role</option>
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {USER_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold">
                        {showMoveFields ? "Nama penerima" : "Nama penanggung jawab Berita Acara"}
                      </label>
                      <select
                        value={docMeta.penerimaUserId}
                        onChange={(e) => {
                          const nextUser = users.find((u) => u.id === e.target.value);
                          setDocMeta({
                            penerimaUserId: e.target.value,
                            namaTeknisi: nextUser?.nama || "",
                          });
                        }}
                        disabled={!docMeta.penerimaRole}
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                      >
                        <option value="">
                          {docMeta.penerimaRole
                            ? "Pilih nama"
                            : "Pilih role dulu"}
                        </option>
                        {selectedRoleUsers.map((targetUser) => (
                          <option key={targetUser.id} value={targetUser.id}>
                            {targetUser.nama} - {targetUser.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {showMoveFields && (
                  <div>
                    <label className="text-xs font-semibold">
                      Nomor SPT <span className="text-red-500 font-bold">* (Wajib untuk Serah/Bawa)</span>
                    </label>
                    <input
                      type="text"
                      value={docMeta.nomorSpt}
                      onChange={(e) => setDocMeta({ nomorSpt: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      placeholder="Contoh: SPT/2026/08/001"
                    />
                  </div>
                )}
                {showDamageFields && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    Barang dengan mode Lapor Rusak akan berstatus <strong>Rusak</strong>.
                    Isi lokasi barang dan jelaskan kerusakan pada kolom keterangan.
                  </div>
                )}
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-red-700">
                    {showMoveFields ? "Disetujui oleh" : "Dicatat oleh"}
                  </p>
                  <p className="text-xs text-red-900">
                    {roleLabel} - {user?.nama || "Admin"}
                  </p>
                </div>
                {showDestination && (
                  <div>
                    <label className="text-xs font-semibold">
                      {showMoveFields && showDamageFields ? "Lokasi tujuan / lokasi barang rusak" :
                        showDamageFields ? "Lokasi barang rusak" : "Lokasi tujuan / site"}
                    </label>
                    <input
                      list="lokasi-datalist"
                      value={docMeta.lokasiTujuan}
                      onChange={(e) =>
                        setDocMeta({ lokasiTujuan: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    />
                    {showMoveFields && showDamageFields && (
                      <p className="mt-1 text-xs text-telkomsat-gray">
                        Lokasi dan keterangan ini berlaku bersama untuk barang Serah/Bawa dan Lapor Rusak.
                        Proses dalam daftar terpisah jika lokasi atau keterangannya berbeda.
                      </p>
                    )}
                  </div>
                )}
                {showDestination && (
                  <div>
                    <label className="text-xs font-semibold">
                      {showDamageFields && !showMoveFields ? "Keterangan kerusakan" : "Keterangan transaksi"}
                    </label>
                    <textarea
                      value={docMeta.keteranganGlobal}
                      onChange={(e) => setDocMeta({ keteranganGlobal: e.target.value })}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      placeholder={showDamageFields ? "Jelaskan kerusakan dan barang yang terdampak" : "Catatan penyerahan barang"}
                    />
                  </div>
                )}
                {showMoveFields && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={genSuratJalan}
                      onChange={(e) => setGenSuratJalan(e.target.checked)}
                    />
                    <Truck className="w-3.5 h-3.5" />
                    Unduh Surat Jalan ({moveCount} item serah)
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={genBeritaAcara}
                    onChange={(e) => setGenBeritaAcara(e.target.checked)}
                  />
                  <FileText className="w-3.5 h-3.5" />
                  Unduh Berita Acara
                </label>
                {genBeritaAcara && (
                  <div className="space-y-3 border-t pt-3">
                    <div>
                      <label className="text-xs font-semibold">
                        Lokasi site (Berita Acara)
                      </label>
                      <input
                        list="lokasi-datalist"
                        value={docMeta.lokasiSite}
                        onChange={(e) => setDocMeta({ lokasiSite: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                        placeholder="Bisa berbeda per kegiatan"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Pelanggan / pihak</label>
                      <input
                        value={docMeta.namaPelanggan}
                        onChange={(e) =>
                          setDocMeta({ namaPelanggan: e.target.value })
                        }
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Jenis Berita Acara</label>
                      <select
                        value={docMeta.beritaAcaraJenis}
                        onChange={(e) =>
                          setDocMeta({
                            beritaAcaraJenis: e.target
                              .value as typeof docMeta.beritaAcaraJenis,
                          })
                        }
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                      >
                        {BERITA_ACARA_TEMPLATES.map((t) => (
                          <option key={t.jenis} value={t.jenis}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold">
                        Pekerjaan tambahan (BA)
                      </label>
                      <textarea
                        value={docMeta.pekerjaanTambahan}
                        onChange={(e) =>
                          setDocMeta({ pekerjaanTambahan: e.target.value })
                        }
                        rows={2}
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                        placeholder="Detail khusus lokasi ini..."
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowBaDetail(!showBaDetail)}
                      className="w-full text-left text-xs font-semibold text-telkomsat-red py-1"
                    >
                      {showBaDetail ? "▼" : "▶"} Form BA resmi (tiket, PIC, layanan)
                    </button>

                    {showBaDetail && (
                      <div className="space-y-2 p-3 bg-gray-50 rounded-lg border text-xs">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              checked={docMeta.tipeMaintenance === "PM"}
                              onChange={() => setDocMeta({ tipeMaintenance: "PM" })}
                            />
                            PM
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              checked={docMeta.tipeMaintenance === "CM"}
                              onChange={() => setDocMeta({ tipeMaintenance: "CM" })}
                            />
                            CM
                          </label>
                        </div>
                        <input
                          placeholder="Alamat lokasi"
                          value={docMeta.alamat}
                          onChange={(e) => setDocMeta({ alamat: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="No. Tiket Complaint"
                          value={docMeta.noTiketComplaint}
                          onChange={(e) =>
                            setDocMeta({ noTiketComplaint: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="No. Tiket Maintenance"
                          value={docMeta.noTiketMaintenance}
                          onChange={(e) =>
                            setDocMeta({ noTiketMaintenance: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="No. HP pembawa/penerima"
                          value={docMeta.noHpTeknisi}
                          onChange={(e) =>
                            setDocMeta({ noHpTeknisi: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="Nama PIC"
                          value={docMeta.namaPic}
                          onChange={(e) => setDocMeta({ namaPic: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="No. HP PIC"
                          value={docMeta.noHpPic}
                          onChange={(e) => setDocMeta({ noHpPic: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="Sumber masalah"
                          value={docMeta.sumberMasalah}
                          onChange={(e) =>
                            setDocMeta({ sumberMasalah: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <input
                          placeholder="Tindakan"
                          value={docMeta.tindakan}
                          onChange={(e) => setDocMeta({ tindakan: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <textarea
                          placeholder="Catatan ringkasan"
                          value={docMeta.catatanRingkasan}
                          onChange={(e) =>
                            setDocMeta({ catatanRingkasan: e.target.value })
                          }
                          rows={2}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <p className="font-semibold text-gray-600">Jenis layanan</p>
                        <div className="max-h-28 overflow-y-auto space-y-1">
                          {LAYANAN_BA_CHECKLIST.map((l) => (
                            <label key={l} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={(docMeta.layananTerpilih || []).includes(l)}
                                onChange={() => toggleLayanan(l)}
                              />
                              <span className="text-[11px]">{l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || items.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white py-3.5 rounded-xl font-bold disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Proses & Simpan ({items.length})
            </button>
          </div>
        </div>

        <datalist id="lokasi-datalist">
          {lokasiOptions.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      {/* Manual modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-telkomsat-black">Input ID / SN / Tag Manual</h3>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Ketik ID, Serial Number, atau Tagging..."
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none"
                autoFocus
              />
              {manualSearching ? (
                <p className="text-xs text-telkomsat-gray animate-pulse">Mencari item...</p>
              ) : manualSuggestions.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border rounded-xl divide-y text-xs">
                  {manualSuggestions.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => handleAddItem(sug.id)}
                      className="w-full p-2.5 text-left hover:bg-red-50 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-black">{sug.namaPerangkat}</p>
                        <p className="text-gray-500">SN: {sug.serialNumber || "-"} | Tag: {sug.tagging || "-"}</p>
                      </div>
                      <span className="text-telkomsat-red font-semibold">Pilih ➔</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="px-4 py-2 text-sm text-gray-600 font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleManualAdd(manualId)}
                disabled={!manualId.trim()}
                className="px-5 py-2 bg-telkomsat-red text-white text-sm rounded-xl font-bold disabled:opacity-50"
              >
                Tambah Item
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
