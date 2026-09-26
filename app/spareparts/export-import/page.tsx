"use client";

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  exportToExcel,
  importFromExcel,
  downloadExcelTemplate,
} from "@/lib/utils/excel";
import {
  EXCEL_COLUMNS,
  ITEM_STATUS_VALUES,
  CARI_FISIK_VALUES,
} from "@/lib/constants/sparepartItem";
import toast from "react-hot-toast";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Camera,
  Info,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

type ImportResult = {
  success: number;
  failed: number;
  errors: string[];
  summary: {
    itemsCreated: number;
    itemsUpdated: number;
    skipped?: number;
  };
};

const COLUMN_GUIDE: {
  kolom: string;
  wajib: string;
  keterangan: string;
}[] = [
  {
    kolom: EXCEL_COLUMNS.NO,
    wajib: "Tidak",
    keterangan: "Nomor urut (otomatis saat export)",
  },
  {
    kolom: EXCEL_COLUMNS.NAMA,
    wajib: "Ya",
    keterangan: "Nama produk/jenis perangkat (satu nama untuk banyak unit fisik)",
  },
  {
    kolom: EXCEL_COLUMNS.SN,
    wajib: "Salah satu*",
    keterangan: "Serial Number unik per unit",
  },
  {
    kolom: EXCEL_COLUMNS.TAG,
    wajib: "Salah satu*",
    keterangan: "Tagging/label — wajib jika SN kosong",
  },
  {
    kolom: EXCEL_COLUMNS.CARI_FISIK,
    wajib: "Tidak",
    keterangan: `Default: Sesuai (${CARI_FISIK_VALUES.join(", ")})`,
  },
  {
    kolom: EXCEL_COLUMNS.STATUS,
    wajib: "Tidak",
    keterangan: `Status stok — default Tersedia (${ITEM_STATUS_VALUES.join(", ")})`,
  },
  {
    kolom: EXCEL_COLUMNS.LOKASI,
    wajib: "Tidak",
    keterangan: "Posisi fisik barang (Gudang, Site, Customer, dll.) — default Gudang",
  },
  {
    kolom: EXCEL_COLUMNS.KATEGORI,
    wajib: "Tidak",
    keterangan: "Kategori perangkat (RF, Power, Network, dll.)",
  },
  {
    kolom: EXCEL_COLUMNS.KETERANGAN,
    wajib: "Tidak",
    keterangan: "Catatan tambahan",
  },
  {
    kolom: EXCEL_COLUMNS.TANGGAL,
    wajib: "Tidak",
    keterangan: "Diisi otomatis saat export",
  },
];

export default function ExportImportPage() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportToExcel();
      toast.success("Export berhasil! File sedang diunduh.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal export ke Excel";
      toast.error(message);
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();
    const validExtensions = [
      ".xlsx",
      ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const isValidType =
      validExtensions.includes(fileExtension) ||
      validExtensions.includes(file.type);

    if (!isValidType) {
      toast.error("File harus berformat Excel (.xlsx atau .xls)");
      e.target.value = "";
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);
      const result = await importFromExcel(file);
      setImportResult(result);

      if (result.failed === 0) {
        toast.success(`Import berhasil! ${result.success} baris diproses.`);
      } else {
        toast(
          `Import selesai: ${result.success} berhasil, ${result.failed} gagal.`
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal import dari Excel";
      toast.error(message);
      console.error(error);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const downloadTemplate = () => {
    try {
      downloadExcelTemplate();
      toast.success("Template berhasil diunduh!");
    } catch {
      toast.error("Gagal mengunduh template");
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-fade-in pb-8">
        {/* Header */}
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
                Export &amp; Import Inventaris
              </h1>
              <p className="text-lg text-telkomsat-gray">
                Unduh atau unggah data item fisik sparepart dalam format Excel
              </p>
            </div>
          </div>
          <Link
            href="/spareparts/import-foto"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
          >
            <Camera className="h-4 w-4" />
            Import dari Foto (OCR)
          </Link>
        </div>

        {/* Info banner */}
        <div className="flex gap-3 rounded-xl border border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/5 via-white to-transparent p-4 shadow-sm animate-slide-in-right anim-delay-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-telkomsat-red/10 text-telkomsat-red">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-sm text-telkomsat-gray">
            <p className="font-semibold text-telkomsat-black">
              Format kolom terpisah: Status Stok &amp; Lokasi
            </p>
            <p className="mt-1">
              Satu baris Excel = satu unit fisik. Nama perangkat boleh sama
              (mis. &quot;BUC 2 Watt&quot;); dibedakan dengan{" "}
              <strong>Serial Number</strong> atau <strong>Tag</strong>. File
              lama yang masih memakai kolom &quot;Status&quot; sebagai lokasi
              tetap didukung.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Export */}
          <section className="space-y-4 rounded-xl border border-telkomsat-gray-lighter bg-white p-6 shadow-lg transition-shadow hover:shadow-xl animate-scale-in anim-delay-100">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md">
                <Download className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-telkomsat-black">
                  Export ke Excel
                </h2>
                <p className="mt-1 text-sm text-telkomsat-gray">
                  Unduh semua item fisik dari database
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900">
              <p className="font-semibold">Kolom export</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-blue-800">
                <li>
                  {EXCEL_COLUMNS.NAMA}, {EXCEL_COLUMNS.SN}, {EXCEL_COLUMNS.TAG},{" "}
                  {EXCEL_COLUMNS.CARI_FISIK}
                </li>
                <li>
                  <strong>{EXCEL_COLUMNS.STATUS}</strong> — kondisi stok
                </li>
                <li>
                  <strong>{EXCEL_COLUMNS.LOKASI}</strong> — posisi fisik
                </li>
                <li>{EXCEL_COLUMNS.TANGGAL} — tanggal pembaruan terakhir</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-5 w-5" />
              )}
              {exporting ? "Mengekspor..." : "Export ke Excel"}
            </button>
          </section>

          {/* Import */}
          <section className="space-y-4 rounded-xl border border-telkomsat-gray-lighter bg-white p-6 shadow-lg transition-shadow hover:shadow-xl animate-scale-in anim-delay-150">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-telkomsat-black">
                  Import dari Excel
                </h2>
                <p className="mt-1 text-sm text-telkomsat-gray">
                  Tambah atau perbarui item dari file .xlsx / .xls
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Aturan import</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-emerald-800">
                <li>
                  Wajib: <strong>{EXCEL_COLUMNS.NAMA}</strong>
                </li>
                <li>
                  Wajib salah satu: <strong>{EXCEL_COLUMNS.SN}</strong> atau{" "}
                  <strong>{EXCEL_COLUMNS.TAG}</strong>
                </li>
                <li>SN/Tag yang sudah ada → baris di-<strong>update</strong></li>
                <li>SN/Tag baru → item <strong>baru</strong> dibuat</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-telkomsat-gray-lighter bg-white px-4 py-3 text-sm font-semibold text-telkomsat-black shadow-sm transition-all hover:bg-telkomsat-gray-lighter/50 hover:shadow"
              >
                <Download className="h-4 w-4 text-telkomsat-red" />
                Download template
              </button>
              <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
                {importing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                {importing ? "Mengimpor..." : "Pilih file Excel"}
              </label>
            </div>
          </section>
        </div>

        {/* Import result */}
        {importResult && (
          <section className="overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-white shadow-lg animate-scale-in">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/8 to-transparent px-5 py-4">
              <h2 className="text-lg font-bold text-telkomsat-black">
                Hasil import
              </h2>
              <Link
                href="/spareparts"
                className="inline-flex items-center gap-2 rounded-xl bg-telkomsat-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-telkomsat-red-dark"
              >
                <RefreshCw className="h-4 w-4" />
                Lihat Data Sparepart
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800">
                    Berhasil
                  </p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {importResult.success}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-800">Gagal</p>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {importResult.failed}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-sm font-semibold text-blue-800">
                  Item baru
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {importResult.summary.itemsCreated}
                </p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="mb-2 text-sm font-semibold text-violet-800">
                  Item diupdate
                </p>
                <p className="text-2xl font-bold text-violet-600">
                  {importResult.summary.itemsUpdated}
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mx-5 mb-5 max-h-64 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="mb-2 text-sm font-semibold text-red-800">
                  Detail error ({importResult.errors.length})
                </p>
                <ul className="space-y-1 text-sm text-red-700">
                  {importResult.errors.map((error, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="shrink-0">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Column reference */}
        <section className="rounded-xl border border-telkomsat-gray-lighter bg-white p-6 shadow-lg animate-scale-in anim-delay-200">
          <h2 className="mb-4 text-xl font-bold text-telkomsat-black">
            Referensi kolom Excel
          </h2>
          <p className="mb-4 text-sm text-telkomsat-gray">
            * Wajib salah satu antara {EXCEL_COLUMNS.SN} dan {EXCEL_COLUMNS.TAG}
          </p>
          <div className="overflow-x-auto rounded-xl border border-telkomsat-gray-lighter">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-telkomsat-red/5 to-transparent">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-telkomsat-black">
                    Kolom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-telkomsat-black">
                    Wajib
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-telkomsat-black">
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telkomsat-gray-lighter">
                {COLUMN_GUIDE.map((row) => (
                  <tr
                    key={row.kolom}
                    className="transition-colors hover:bg-telkomsat-gray-lighter/30"
                  >
                    <td className="px-4 py-3 font-semibold text-telkomsat-black">
                      {row.kolom}
                    </td>
                    <td className="px-4 py-3 text-telkomsat-gray">{row.wajib}</td>
                    <td className="px-4 py-3 text-telkomsat-gray">
                      {row.keterangan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
