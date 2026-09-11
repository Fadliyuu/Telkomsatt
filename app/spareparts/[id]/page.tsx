"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { getSparepartById, restockSparepart } from "@/lib/firebase/spareparts";
import { getSparepartItems } from "@/lib/firebase/sparepartItems";
import { Sparepart, Transaksi, SparepartItem } from "@/types";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Download,
  Package,
  MapPin,
  TrendingUp,
  History,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { formatDate, generateQRCodeUrl } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import ImageUpload from "@/components/ImageUpload";
import { updateSparepartFoto } from "@/lib/firebase/spareparts";
import { useAuthStore } from "@/lib/store/useAuthStore";
import {
  getApprovedBy,
  getCarriedBy,
  getTransactionLocation,
} from "@/lib/utils/transactionDisplay";

export default function SparepartDetailPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const showQRFromQuery = !!searchParams.get("qr");

  const [sparepart, setSparepart] = useState<Sparepart | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [items, setItems] = useState<SparepartItem[]>([]);
  const [showQR, setShowQR] = useState(showQRFromQuery);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [restockAmount, setRestockAmount] = useState(0);
  const [showRestock, setShowRestock] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [updatingFoto, setUpdatingFoto] = useState(false);
  const isReadOnly = user?.role !== "admin_gudang";
  const qrUrl = generateQRCodeUrl(sparepart?.id || id);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getSparepartById(id);
      if (!data) {
        toast.error("Sparepart tidak ditemukan");
        router.push("/spareparts");
        return;
      }
      setSparepart(data);
      setFotoUrls(data.fotoUrl || []);

      // Load items with SN
      const itemsData = await getSparepartItems(id);
      setItems(itemsData);

      // Load transactions
      const transactionsSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TRANSAKSI),
          where("idSparepart", "==", id)
        )
      );
      const trans = transactionsSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as Transaksi;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setTransactions(trans);
    } catch (error: unknown) {
      toast.error("Gagal memuat data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async () => {
    if (restockAmount <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }

    try {
      await restockSparepart(id, restockAmount);
      toast.success(`Stok berhasil ditambah ${restockAmount}`);
      setRestockAmount(0);
      setShowRestock(false);
      loadData();
    } catch (error: unknown) {
      toast.error("Gagal restock");
      console.error(error);
    }
  };

  const downloadQR = async () => {
    if (!sparepart || generatingQR) return;
    setGeneratingQR(true);
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#1F2937", light: "#FFFFFF" },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `QR-${sparepart.kodeSpare || "sparepart"}.png`;
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
          <div className="text-gray-600">Memuat data...</div>
        </div>
      </AdminLayout>
    );
  }

  if (!sparepart) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            href="/spareparts"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{sparepart.namaSpare}</h1>
            <p className="text-gray-600 mt-1">Kode: {sparepart.kodeSpare}</p>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQR && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">QR Code - {sparepart.kodeSpare}</h2>
              <div className="flex justify-center mb-4">
                <QRCodeSVG value={qrUrl} size={256} level="H" includeMargin />
              </div>
              <p className="text-center text-xs text-gray-600 mb-4 break-all">{qrUrl}</p>
              <div className="flex space-x-4">
                <button
                  onClick={downloadQR}
                  disabled={generatingQR}
                  className="flex-1 flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                  <span>{generatingQR ? "Membuat QR..." : "Download PNG"}</span>
                </button>
                <button
                  onClick={() => setShowQR(false)}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Informasi Sparepart</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Kode Sparepart</p>
                  <p className="font-medium text-gray-900">{sparepart.kodeSpare}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Kategori</p>
                  <p className="font-medium text-gray-900">{sparepart.kategori}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lokasi Default</p>
                  <p className="font-medium text-gray-900 flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {sparepart.lokasiDefault}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Stok Total</p>
                  <p
                    className={`font-medium ${
                      sparepart.stokTotal < 5
                        ? "text-red-600"
                        : sparepart.stokTotal < 10
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {sparepart.stokTotal} unit
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Stok di Gudang</p>
                  <p className="font-medium text-gray-900">{sparepart.stokGudang} unit</p>
                </div>
              </div>
              {sparepart.deskripsi && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Deskripsi</p>
                  <p className="text-gray-900 mt-1">{sparepart.deskripsi}</p>
                </div>
              )}

              {/* Foto Sparepart */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Foto Sparepart</h3>
                  {updatingFoto && (
                    <span className="text-sm text-gray-600">Menyimpan...</span>
                  )}
                </div>
                <ImageUpload
                  value={fotoUrls}
                  onChange={async (urls) => {
                    if (isReadOnly) return;
                    setFotoUrls(urls);
                    try {
                      setUpdatingFoto(true);
                      await updateSparepartFoto(id, urls);
                      toast.success("Foto berhasil diperbarui");
                    } catch (error: unknown) {
                      toast.error("Gagal memperbarui foto");
                      console.error(error);
                    } finally {
                      setUpdatingFoto(false);
                    }
                  }}
                  maxImages={10}
                  folder="inventaris-sparepart"
                  label=""
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {/* Items dengan SN */}
            {items.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-bold">
                    Items dengan Serial Number ({items.length})
                  </h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-gray-200">
                          <th className="pb-3 text-sm font-medium text-gray-600">
                            Serial Number
                          </th>
                          <th className="pb-3 text-sm font-medium text-gray-600">
                            Tagging
                          </th>
                          <th className="pb-3 text-sm font-medium text-gray-600">
                            Lokasi
                          </th>
                          <th className="pb-3 text-sm font-medium text-gray-600">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 text-sm font-medium text-gray-900">
                              {item.serialNumber || "-"}
                            </td>
                            <td className="py-3 text-sm text-gray-900">
                              {item.tagging || "-"}
                            </td>
                            <td className="py-3 text-sm text-gray-900">
                              {item.lokasiSaatIni}
                            </td>
                            <td className="py-3 text-sm text-gray-900">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  item.status === "Tersedia"
                                    ? "bg-green-100 text-green-800"
                                    : item.status === "Digunakan"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.status === "Rusak"
                                    ? "bg-red-100 text-red-800"
                                    : item.status === "Hilang"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions History */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold">Riwayat Transaksi</h2>
                <History className="w-5 h-5 text-gray-600" />
              </div>
              <div className="p-6">
                {transactions.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">Belum ada transaksi</p>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((trans) => (
                      <div
                        key={trans.id}
                        className="border-b border-gray-100 pb-4 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {trans.namaItem || sparepart?.namaSpare || "-"}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              SN: {trans.serialNumber || "-"}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              Tagging: {trans.tagging || "-"}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Dibawa Oleh: {getCarriedBy(trans)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Disetujui Oleh: {getApprovedBy(trans)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDate(trans.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                trans.jenisTransaksi === "MOVE"
                                  ? "bg-blue-100 text-blue-800"
                                  : trans.jenisTransaksi === "DAMAGE"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {trans.jenisTransaksi}
                            </span>
                            <p className="text-sm text-gray-600 mt-1">
                              {getTransactionLocation(trans)}
                            </p>
                          </div>
                        </div>
                        {trans.keterangan && (
                          <p className="text-sm text-gray-600 mt-2">{trans.keterangan}</p>
                        )}
                        {trans.fotoUrl && trans.fotoUrl.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {trans.fotoUrl.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                <img
                                  src={url}
                                  alt={`Foto ${idx + 1}`}
                                  className="w-16 h-16 object-cover rounded border border-gray-300 hover:border-indigo-500 transition-colors"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold mb-4">Aksi</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowQR(true)}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  <Package className="w-5 h-5" />
                  <span>Lihat QR Code</span>
                </button>
                {!isReadOnly && (
                  <Link
                    href={`/spareparts/${id}/edit`}
                    className="w-full flex items-center justify-center space-x-2 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <span>Edit Sparepart</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Restock */}
            {!isReadOnly && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold mb-4">Restock Barang</h3>
              {!showRestock ? (
                <button
                  onClick={() => setShowRestock(true)}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-5 h-5" />
                  <span>Input Barang Masuk</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    type="number"
                    min="1"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(parseInt(e.target.value) || 0)}
                    placeholder="Jumlah"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleRestock}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => {
                        setShowRestock(false);
                        setRestockAmount(0);
                      }}
                      className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
