"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { getSparepartItemById } from "@/lib/firebase/sparepartItems";
import { getTransactions } from "@/lib/firebase/transactions";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { getJenisTransaksiLabel, SparepartItem, Transaksi } from "@/types";
import toast from "react-hot-toast";
import { Package, Download, QrCode, ArrowLeft, MapPin, Tag, Hash, Calendar, FileText, Loader2, Edit, Images } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { generateQRCodeUrl } from "@/lib/utils";

export default function ItemDetailPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const qrDataUrlFromQuery = searchParams.get("qr");

  const [item, setItem] = useState<SparepartItem | null>(null);
  const [latestPhotoTransaction, setLatestPhotoTransaction] = useState<Transaksi | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(!!qrDataUrlFromQuery);
  const [generatingQR, setGeneratingQR] = useState(false);
  const canEdit = user?.role === "admin_gudang";
  const qrUrl = generateQRCodeUrl(item?.id || id);

  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      const transactionFilters = user?.role === "teknisi"
        ? { requestedByUid: user.id }
        : { idSparepart: id };
      const [data, transactions] = await Promise.all([
        getSparepartItemById(id),
        getTransactions(transactionFilters, null),
      ]);
      if (!data) {
        toast.error("Item tidak ditemukan");
        router.push("/spareparts");
        return;
      }
      setItem(data);
      setLatestPhotoTransaction(
        transactions.find(
          (transaction) => transaction.idSparepart === id && (transaction.fotoUrl?.length || 0) > 0
        ) || null
      );
    } catch (error: unknown) {
      toast.error("Gagal memuat data item");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, router, user?.id, user?.role]);

  useEffect(() => {
    if (id) {
      loadItem();
    }
  }, [id, loadItem]);

  const downloadQR = async () => {
    if (!item || generatingQR) return;
    setGeneratingQR(true);
    try {
      // Always encode the same current URL shown in the preview. Old query
      // images and stored URLs may still contain localhost or a previous host.
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#1F2937", light: "#FFFFFF" },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `QR-${item.namaPerangkat || "item"}-${item.serialNumber || id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR Code berhasil didownload!");
    } catch (error) {
      console.error("Error generating QR:", error);
      toast.error("Gagal membuat QR Code. Silakan coba lagi.");
    } finally {
      setGeneratingQR(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin"></div>
            <p className="text-telkomsat-gray">Memuat data...</p>
          </div>

        </div>
      </AdminLayout>
    );
  }

  if (!item) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="w-16 h-16 text-telkomsat-gray mx-auto mb-4 opacity-50" />
            <p className="text-telkomsat-black font-semibold text-lg mb-4">Item tidak ditemukan</p>
            <Link
              href="/spareparts"
              className="text-telkomsat-red hover:text-telkomsat-red-dark font-medium"
            >
              ← Kembali ke Data Sparepart
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-in-left">
          <div className="flex items-center space-x-4">
            <Link
              href="/spareparts"
              className="p-2 hover:bg-telkomsat-gray-lighter rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-telkomsat-black" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-telkomsat-black">Detail Item</h1>
              <p className="text-telkomsat-gray mt-1">Informasi lengkap dan QR Code</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && (
              <Link
                href={`/spareparts/${id}/edit`}
                className="flex items-center space-x-2 border-2 border-telkomsat-red text-telkomsat-red px-5 py-2.5 rounded-xl hover:bg-telkomsat-red/10 transition-all duration-300 font-semibold"
              >
                <Edit className="w-5 h-5" />
                <span>Edit Item</span>
              </Link>
            )}
            <button
              onClick={() => setShowQR(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
            >
              <QrCode className="w-5 h-5" />
              <span>Lihat QR Code</span>
            </button>
          </div>
        </div>

        {/* QR Code Modal - Using SVG for instant rendering */}
        {showQR && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
              <h2 className="text-xl font-bold text-telkomsat-black mb-2 text-center">QR Code</h2>
              <p className="text-sm text-telkomsat-gray mb-6 text-center truncate">{item.namaPerangkat}</p>
              
              {/* QR Code SVG - Instant Render */}
              <div className="flex justify-center mb-6 p-4 bg-white rounded-xl border-2 border-telkomsat-gray-lighter" id="qr-canvas">
                <QRCodeSVG 
                  value={qrUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#1F2937"
                />
              </div>
              
              <p className="text-xs text-telkomsat-gray text-center mb-6 break-all">
                {qrUrl}
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={downloadQR}
                  disabled={generatingQR}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50"
                >
                  {generatingQR ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <span>{generatingQR ? "Generating..." : "Download PNG"}</span>
                </button>
                <button
                  onClick={() => setShowQR(false)}
                  className="flex-1 border-2 border-telkomsat-gray-lighter text-telkomsat-black px-4 py-3 rounded-xl hover:bg-telkomsat-gray-lighter transition-colors font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-6 animate-slide-in-left" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-telkomsat-black">{item.namaPerangkat}</h2>
                {item.serialNumber && (
                  <p className="text-telkomsat-gray mt-2 flex items-center">
                    <Hash className="w-4 h-4 mr-2" />
                    SN: <span className="font-mono ml-1">{item.serialNumber}</span>
                  </p>
                )}
                <p className="text-telkomsat-gray flex items-center mt-1">
                  <Tag className="w-4 h-4 mr-2" />
                  Tagging: {item.tagging || "-"}
                </p>
              </div>
              <div className="p-4 bg-telkomsat-red/10 rounded-xl">
                <Package className="w-10 h-10 text-telkomsat-red" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-telkomsat-gray-lighter/30 rounded-xl">
                <p className="text-sm text-telkomsat-gray mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1.5 text-sm font-semibold rounded-full ${
                    item.status === "Tersedia"
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : item.status === "Digunakan"
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : item.status === "Rusak"
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : item.status === "Hilang"
                      ? "bg-gray-100 text-gray-700 border border-gray-200"
                      : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                  }`}
                >
                  {item.status || "Tersedia"}
                </span>
              </div>
              <div className="p-4 bg-telkomsat-gray-lighter/30 rounded-xl">
                <p className="text-sm text-telkomsat-gray mb-1 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" /> Lokasi
                </p>
                <p className="font-semibold text-telkomsat-black">{item.lokasiSaatIni || "Gudang"}</p>
              </div>
              <div className="p-4 bg-telkomsat-gray-lighter/30 rounded-xl">
                <p className="text-sm text-telkomsat-gray mb-1">Cari Fisik</p>
                <p className="font-semibold text-telkomsat-black">{item.cariFisik || "Sesuai"}</p>
              </div>
              <div className="p-4 bg-telkomsat-gray-lighter/30 rounded-xl">
                <p className="text-sm text-telkomsat-gray mb-1 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" /> Dibuat
                </p>
                <p className="font-semibold text-telkomsat-black">
                  {new Date(item.createdAt).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {item.keterangan && (
              <div className="mt-6 pt-6 border-t border-telkomsat-gray-lighter">
                <p className="text-sm text-telkomsat-gray mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" /> Keterangan
                </p>
                <p className="text-telkomsat-black">{item.keterangan}</p>
              </div>
            )}
          </div>

          {/* QR Code Card */}
          <div className="bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-6 animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-lg font-bold text-telkomsat-black mb-4 flex items-center">
              <QrCode className="w-5 h-5 mr-2 text-telkomsat-red" />
              QR Code
            </h3>
            
            {/* QR Code Preview */}
            <div className="flex justify-center mb-4 p-4 bg-white rounded-xl border-2 border-telkomsat-gray-lighter">
              <QRCodeSVG 
                value={qrUrl}
                size={180}
                level="H"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#1F2937"
              />
            </div>
            
            <div className="space-y-3">
              <button
                onClick={downloadQR}
                disabled={generatingQR}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                <span>Download QR</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-telkomsat-black flex items-center gap-2">
                  <Images className="w-5 h-5 text-telkomsat-red" /> Foto Kondisi Terbaru
                </h3>
                <p className="text-sm text-telkomsat-gray mt-1">Foto terakhir yang diunggah melalui pengajuan atau transaksi item ini.</p>
              </div>
              {latestPhotoTransaction && (
                <Link href={`/transaksi/${latestPhotoTransaction.id}`} className="shrink-0 text-sm font-semibold text-telkomsat-red hover:underline">
                  Detail transaksi
                </Link>
              )}
            </div>
            {latestPhotoTransaction?.fotoUrl?.length ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {latestPhotoTransaction.fotoUrl.map((url, index) => (
                    <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-gray-100">
                      <Image src={url} alt={`Foto kondisi terbaru ${item.namaPerangkat} ${index + 1}`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition-transform duration-200 group-hover:scale-105" />
                    </a>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-telkomsat-gray">
                  <span>Diunggah oleh: <strong className="text-telkomsat-black">{latestPhotoTransaction.requestedByName || latestPhotoTransaction.namaTeknisi || "-"}</strong></span>
                  <span>{getJenisTransaksiLabel(latestPhotoTransaction.jenisTransaksi)}</span>
                  <span>{new Date(latestPhotoTransaction.createdAt).toLocaleString("id-ID")}</span>
                  <span className="capitalize">Status: {latestPhotoTransaction.statusTransaksi}</span>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-telkomsat-gray-lighter px-5 py-8 text-center text-sm text-telkomsat-gray">Belum ada foto kondisi yang diunggah melalui transaksi item ini.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
