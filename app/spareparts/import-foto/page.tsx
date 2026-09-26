"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { useAuthStore } from "@/lib/store/useAuthStore";
import {
  Camera,
  Upload,
  ScanText,
  Plus,
  Trash2,
  FileSpreadsheet,
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ImageIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  createEmptyOcrRow,
  parseOcrTextToRows,
  validateOcrRow,
  normalizeOcrRow,
  OcrPreviewRow,
} from "@/lib/utils/ocrImport";
import { importNormalizedRows, exportRowsPreviewToExcel } from "@/lib/utils/excel";
import { recognizeInventoryImage } from "@/lib/utils/ocrRecognition";
import {
  ITEM_STATUS_VALUES,
  CARI_FISIK_VALUES,
  CariFisikValue,
} from "@/lib/constants/sparepartItem";

const OCR_COLUMNS: { key: keyof OcrPreviewRow; label: string }[] = [
  { key: "namaPerangkat", label: "Nama Perangkat *" },
  { key: "serialNumber", label: "Serial Number" },
  { key: "tagging", label: "Tagging" },
  { key: "kategori", label: "Kategori" },
  { key: "status", label: "Status Stok" },
  { key: "lokasiSaatIni", label: "Lokasi" },
  { key: "cariFisik", label: "Cari Fisik" },
  { key: "keterangan", label: "Keterangan" },
];

export default function ImportFotoPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);

  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<OcrPreviewRow[]>([]);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin_gudang") {
      toast.error("Hanya Admin Gudang yang dapat mengakses Import dari Foto");
      router.replace("/spareparts");
    }
  }, [user, router]);

  const stopCameraStream = () => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      ocrAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    if (!cameraModalOpen || !videoRef.current || !cameraStreamRef.current) return;
    const v = videoRef.current;
    v.srcObject = cameraStreamRef.current;
    void v.play().catch(() => {});
  }, [cameraModalOpen]);

  const applyPickedImageFile = (file: File) => {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRawText("");
    setRows([]);
    setOcrConfidence(null);
  };

  const openGalleryPicker = () => {
    const el = fileInputRef.current;
    if (!el) return;
    el.removeAttribute("capture");
    el.click();
  };

  /** Fallback: input file + capture (utama di perangkat mobile lama) */
  const openNativeCapturePicker = () => {
    const el = fileInputRef.current;
    if (!el) return;
    el.setAttribute("capture", "environment");
    el.click();
  };

  const openWebCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast(
        "Browser tidak mendukung akses kamera — membuka pemilih file (pilih gambar dari perangkat)."
      );
      openNativeCapturePicker();
      return;
    }

    setCameraStarting(true);
    stopCameraStream();

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch {
        stream = null;
      }
    }

    setCameraStarting(false);

    if (!stream) {
      toast.error("Kamera tidak bisa dibuka — izinkan akses kamera atau gunakan Pilih gambar.");
      openNativeCapturePicker();
      return;
    }

    cameraStreamRef.current = stream;
    setCameraModalOpen(true);
  };

  const closeCameraModal = () => {
    setCameraModalOpen(false);
    stopCameraStream();
  };

  const capturePhotoFromStream = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast.error("Tunggu sebentar hingga pratinjau kamera siap.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Gagal mengambil foto.");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Gagal membuat file gambar.");
          return;
        }
        const file = new File([blob], `foto-dokumen-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        applyPickedImageFile(file);
        closeCameraModal();
        toast.success("Foto berhasil diambil.");
      },
      "image/jpeg",
      0.92
    );
  };

  const runOcrOnFile = async (file: File) => {
    if (ocrAbortRef.current || importing) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast.error("Format harus JPG atau PNG");
      return;
    }

    setProcessing(true);
    setOcrProgress(0);
    setOcrStatus("Memuat mesin OCR...");
    setOcrConfidence(null);
    const controller = new AbortController();
    ocrAbortRef.current = controller;

    try {
      const { text, confidence } = await recognizeInventoryImage(file, {
        signal: controller.signal,
        onProgress: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setOcrProgress(Math.round(m.progress * 100));
            setOcrStatus(`Membaca teks... ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            setOcrStatus(m.status);
          }
        },
      });

      if (controller.signal.aborted) return;
      setRawText(text);
      setOcrConfidence(confidence);
      const parsed = parseOcrTextToRows(text);
      setRows(parsed);
      toast.success(
        parsed.length > 0
          ? `OCR selesai — ${parsed.length} baris terdeteksi. Silakan periksa tabel.`
          : "OCR selesai — tidak ada baris terdeteksi. Tambah manual atau perbaiki teks."
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      toast.error("OCR gagal. Periksa koneksi internet untuk memuat mesin/bahasa OCR, lalu coba lagi dengan JPG atau PNG yang jelas.");
    } finally {
      ocrAbortRef.current = null;
      if (!controller.signal.aborted) {
        setProcessing(false);
        setOcrProgress(0);
        setOcrStatus("");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      applyPickedImageFile(file);
    }
    e.target.value = "";
    fileInputRef.current?.removeAttribute("capture");
  };

  const handleProsesOcr = () => {
    if (!pendingFile) {
      toast.error("Pilih gambar terlebih dahulu");
      return;
    }
    runOcrOnFile(pendingFile);
  };

  const updateRow = (id: string, field: keyof OcrPreviewRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addManualRow = () => {
    setRows((prev) => [...prev, createEmptyOcrRow()]);
  };

  const reparseFromText = () => {
    const parsed = parseOcrTextToRows(rawText);
    setRows(parsed);
    toast.success(`${parsed.length} baris dari teks mentah`);
  };

  const handleExportPreview = () => {
    if (rows.length === 0) {
      toast.error("Tidak ada data preview");
      return;
    }
    try {
      exportRowsPreviewToExcel(rows.map(normalizeOcrRow));
      toast.success("Preview diekspor ke Excel");
    } catch {
      toast.error("Gagal export preview");
    }
  };

  const handleImport = async () => {
    if (processing || importing) return;
    if (rows.length === 0) {
      toast.error("Tidak ada baris untuk diimport");
      return;
    }

    const validationErrors: string[] = [];
    const normalized = rows.map((row, i) => {
      const n = normalizeOcrRow(row);
      const err = validateOcrRow(n, i + 1);
      if (err) validationErrors.push(err);
      return n;
    });

    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    if (
      !confirm(
        `Import ${normalized.length} item ke Data Sparepart?\n\nPastikan data sudah diperiksa.`
      )
    ) {
      return;
    }

    setImporting(true);
    try {
      const result = await importNormalizedRows(normalized, {
        skipDuplicates: false,
      });

      if (result.success > 0) {
        toast.success(
          `Berhasil: ${result.summary.itemsCreated} baru, ${result.summary.itemsUpdated} diperbarui`
        );
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} baris gagal`);
        console.error(result.errors);
      }
      if (result.success > 0) {
        router.push("/spareparts");
      }
    } catch (error) {
      toast.error("Gagal import");
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  if (user && user.role !== "admin_gudang") {
    return (
      <AdminLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-telkomsat-gray-lighter bg-white/80 px-10 py-12 shadow-lg backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-telkomsat-red" />
            <p className="text-telkomsat-gray">Memuat...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-fade-in pb-8">
        <div className="flex flex-col gap-4 animate-slide-in-left sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start space-x-4">
            <Link
              href="/spareparts"
              className="mt-1 rounded-xl p-2 text-telkomsat-black transition-colors hover:bg-telkomsat-gray-lighter"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="mb-2 text-4xl font-bold text-telkomsat-black">
                Import dari Foto
              </h1>
              <p className="text-lg text-telkomsat-gray">
                OCR dokumen inventaris — periksa tabel lalu simpan ke database
              </p>
            </div>
          </div>
          <Link
            href="/spareparts/export-import"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-telkomsat-gray-lighter bg-white/80 px-4 py-2.5 text-sm font-semibold text-telkomsat-black shadow-sm transition-all hover:border-telkomsat-red/40 hover:shadow-md"
          >
            <FileSpreadsheet className="h-4 w-4 text-telkomsat-red" />
            Export / Import Excel
          </Link>
        </div>

        <div className="flex gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-purple-50/80 p-4 shadow-sm animate-slide-in-right anim-delay-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-sm text-telkomsat-gray">
            <p className="font-semibold text-telkomsat-black">
              Tips penggunaan OCR
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <strong>Kamera</strong> membuka pratinjau langsung (PC &amp; HP).
                Di beberapa browser wajib HTTPS dan izin kamera.
              </li>
              <li>
                <strong>Pilih gambar</strong> membuka galeri/file tanpa memaksa
                kamera belakang.
              </li>
              <li>Foto terang dan teks fokus memperjelas hasil OCR.</li>
              <li>Mesin OCR memerlukan internet saat pertama dimuat. Teks cetak paling mudah dibaca; SN/tag tetap perlu diperiksa, terutama huruf O dan angka 0.</li>
              <li>Gunakan judul kolom yang jelas. Untuk koreksi teks, pisahkan kolom dengan tanda <strong>|</strong> atau tab; kolom kosong tetap diberi pemisah.</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-telkomsat-gray-lighter bg-white p-6 shadow-lg transition-shadow hover:shadow-xl animate-scale-in anim-delay-100">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark text-white shadow-md">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-telkomsat-black">
                  1. Upload / ambil foto
                </h2>
                <p className="mt-1 text-sm text-telkomsat-gray">
                  Format JPG atau PNG — dokumen atau daftar tertulis.
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openGalleryPicker}
                disabled={processing || importing}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-2.5 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                Pilih gambar
              </button>
              <button
                type="button"
                onClick={openWebCamera}
                disabled={processing || importing || cameraStarting}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-telkomsat-red bg-white px-5 py-2.5 font-semibold text-telkomsat-red transition-colors hover:bg-telkomsat-red/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cameraStarting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                Kamera
              </button>
              <button
                type="button"
                onClick={handleProsesOcr}
                disabled={processing || importing || !pendingFile}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-2.5 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ScanText className="h-5 w-5" />
                )}
                Proses OCR
              </button>
            </div>

            {processing && (
              <div className="space-y-2 rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/20 p-4">
                <div className="flex items-center gap-2 text-sm text-telkomsat-gray">
                  <Loader2 className="h-4 w-4 animate-spin text-telkomsat-red" />
                  {ocrStatus || "Memproses..."}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-telkomsat-gray-lighter">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}

            {previewUrl && (
              <div className="overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/20 shadow-inner">
                <Image
                  src={previewUrl}
                  alt="Preview dokumen"
                  width={900}
                  height={500}
                  unoptimized
                  className="max-h-56 w-full object-contain"
                />
              </div>
            )}

            {!previewUrl && !processing && (
              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/10 px-4 py-8 text-center text-sm text-telkomsat-gray">
                <Camera className="mb-2 h-8 w-8 text-telkomsat-gray-light" />
                Belum ada gambar — pilih file atau ambil dari kamera.
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-telkomsat-gray-lighter bg-white p-6 shadow-lg transition-shadow hover:shadow-xl animate-scale-in anim-delay-150">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 shadow-sm">
                <ScanText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-telkomsat-black">
                  2. Teks OCR mentah
                </h2>
                <p className="mt-1 text-sm text-telkomsat-gray">
                  Edit langsung di sini bila perlu, lalu parse ulang ke tabel.
                </p>
              </div>
            </div>

            <textarea
              value={rawText}
              disabled={processing || importing}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              className="input-glow w-full rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/20 px-4 py-3 font-mono text-sm text-telkomsat-black outline-none transition-all focus:border-telkomsat-red focus:bg-white focus:ring-2 focus:ring-telkomsat-red/20"
              placeholder="Hasil OCR akan muncul di sini..."
            />
            <button
              type="button"
              onClick={reparseFromText}
              disabled={processing || importing || !rawText.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ScanText className="h-4 w-4" />
              Parse ulang ke tabel
            </button>
            {ocrConfidence !== null && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Kepercayaan pembacaan teks: {Math.round(ocrConfidence)}%. Ini bukan jaminan ketepatan kolom atau SN/tag. Cocokkan tabel dengan foto sebelum import.
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-white shadow-lg animate-scale-in anim-delay-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/8 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-telkomsat-red/10 sm:flex">
                <FileSpreadsheet className="h-5 w-5 text-telkomsat-red" />
              </div>
              <h2 className="text-lg font-bold text-telkomsat-black">
                3. Preview & koreksi{" "}
                <span className="font-semibold text-telkomsat-red">
                  ({rows.length} baris)
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addManualRow}
                className="inline-flex items-center gap-1.5 rounded-xl border border-telkomsat-gray-lighter bg-white px-4 py-2 text-sm font-semibold text-telkomsat-black shadow-sm transition-all hover:bg-telkomsat-gray-lighter/50 hover:shadow"
              >
                <Plus className="h-4 w-4 text-telkomsat-red" />
                Tambah baris
              </button>
              <button
                type="button"
                onClick={handleExportPreview}
                disabled={rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-telkomsat-gray-lighter bg-white px-4 py-2 text-sm font-semibold text-telkomsat-black shadow-sm transition-all hover:bg-telkomsat-gray-lighter/50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export preview
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={processing || importing || rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Import ke sparepart
              </button>
            </div>
          </div>

          <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="rounded-full bg-telkomsat-gray-lighter/80 p-4">
                  <ScanText className="h-10 w-10 text-telkomsat-gray" />
                </div>
                <p className="max-w-md text-telkomsat-gray">
                  Upload foto lalu klik <strong>Proses OCR</strong>, atau tambah
                  baris manual untuk mengisi data tanpa gambar.
                </p>
              </div>
            ) : (
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/5 to-transparent backdrop-blur-sm">
                  <tr>
                    {OCR_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-telkomsat-black"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-telkomsat-gray-lighter bg-white">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-telkomsat-gray-lighter/40"
                    >
                      {OCR_COLUMNS.map((col) => (
                        <td key={col.key} className="px-3 py-2 align-middle">
                          {col.key === "status" ? (
                            <select
                              value={row.status}
                              onChange={(e) =>
                                updateRow(row.id, "status", e.target.value)
                              }
                              className="w-full rounded-lg border border-telkomsat-gray-lighter bg-white px-2 py-1.5 text-xs outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
                            >
                              {ITEM_STATUS_VALUES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : col.key === "cariFisik" ? (
                            <select
                              value={row.cariFisik}
                              onChange={(e) =>
                                updateRow(
                                  row.id,
                                  "cariFisik",
                                  e.target.value as CariFisikValue
                                )
                              }
                              className="w-full rounded-lg border border-telkomsat-gray-lighter bg-white px-2 py-1.5 text-xs outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
                            >
                              {CARI_FISIK_VALUES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={String(row[col.key] ?? "")}
                              onChange={(e) =>
                                updateRow(row.id, col.key, e.target.value)
                              }
                              className="min-w-[100px] w-full rounded-lg border border-telkomsat-gray-lighter bg-white px-2 py-1.5 text-xs outline-none transition-colors focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                          title="Hapus baris"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/20 px-4 py-3 text-xs text-telkomsat-gray">
          <strong className="text-telkomsat-black">Validasi:</strong> nama
          wajib; SN atau tagging wajib salah satu; status default Tersedia;
          lokasi default Gudang. Duplikat SN/tag akan memperbarui item yang sudah
          ada.
        </div>

        {cameraModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-telkomsat-gray-lighter bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/10 to-transparent px-4 py-3">
                <h3 className="font-bold text-telkomsat-black">Ambil foto</h3>
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="rounded-lg p-2 text-telkomsat-gray transition-colors hover:bg-telkomsat-gray-lighter hover:text-telkomsat-black"
                  aria-label="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="bg-black">
                <video
                  ref={videoRef}
                  className="aspect-video w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
              </div>
              <div className="flex flex-wrap gap-3 p-4">
                <button
                  type="button"
                  onClick={capturePhotoFromStream}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-4 py-3 font-semibold text-white shadow-md min-w-[140px]"
                >
                  <Camera className="h-5 w-5" />
                  Ambil foto
                </button>
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="rounded-xl border border-telkomsat-gray-lighter px-4 py-3 font-semibold text-telkomsat-black hover:bg-telkomsat-gray-lighter/50"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
