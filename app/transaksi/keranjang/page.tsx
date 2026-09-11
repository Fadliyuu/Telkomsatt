"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store/useCartStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { getSparepartById } from "@/lib/firebase/spareparts";
import { getSparepartItemById } from "@/lib/firebase/sparepartItems";
import { submitCartApprovalRequest } from "@/lib/firebase/transactions";
import { getLokasiList } from "@/lib/firebase/lokasi";
import { getDefaultPath } from "@/lib/rbac";
import toast from "react-hot-toast";
import {
  ShoppingCart,
  Trash2,
  ArrowLeft,
  Send,
  MapPin,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";

interface CartItemData {
  id: string;
  nama: string;
  kode?: string;
  tagging?: string;
  kategori?: string;
  lokasi?: string;
  serialNumber?: string;
  actionType: "MOVE" | "DAMAGE" | "FOUND" | "DISMANTLE";
  cartItemId: string;
  isItem: boolean; // true if from sparepart_items, false if from spareparts
}

export default function KeranjangPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, namaTeknisi, removeItem, clearCart, initSession } =
    useCartStore();

  const [cartItems, setCartItems] = useState<CartItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [destination, setDestination] = useState("");
  const [nomorSpt, setNomorSpt] = useState("");
  const [note, setNote] = useState("");
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [lokasiOptions, setLokasiOptions] = useState<string[]>([]);
  const hasOutOrMove = items.some(
    (item) => item.jenisAksi === "OUT" || item.jenisAksi === "MOVE"
  );

  useEffect(() => {
    getLokasiList()
      .then((list) => setLokasiOptions(list.map((l) => l.namaLokasi)))
      .catch(() => {});
  }, []);

  const loadCartItems = useCallback(async () => {
    try {
      setLoading(true);
      const itemsData = await Promise.all(
        items.map(async (item) => {
          // Try sparepart_items first (more common for scanning)
          try {
            const sparepartItem = await getSparepartItemById(item.idSparepart);
            if (sparepartItem) {
              return {
                id: sparepartItem.id,
                nama: sparepartItem.namaPerangkat,
                kode: sparepartItem.tagging || undefined,
                tagging: sparepartItem.tagging || undefined,
                kategori: undefined,
                lokasi: sparepartItem.lokasiSaatIni || "Gudang",
                serialNumber: sparepartItem.serialNumber || undefined,
                actionType: item.jenisAksi,
                cartItemId: item.id,
                isItem: true,
              } as CartItemData;
            }
          } catch (e) {
            // Not found in sparepart_items
          }

          // Try spareparts collection
          try {
            const sparepart = await getSparepartById(item.idSparepart);
            if (sparepart) {
              return {
                id: sparepart.id,
                nama: sparepart.namaSpare,
                kode: sparepart.kodeSpare,
                kategori: sparepart.kategori,
                lokasi: sparepart.lokasiDefault,
                serialNumber: undefined,
                actionType: item.jenisAksi,
                cartItemId: item.id,
                isItem: false,
              } as CartItemData;
            }
          } catch (e) {
            // Not found in spareparts
          }

          // If not found anywhere, return null
          console.warn(`Item not found: ${item.idSparepart}`);
          return null;
        })
      );

      const validItems = itemsData.filter((item) => item !== null) as CartItemData[];
      setCartItems(validItems);
      
      if (validItems.length === 0 && items.length > 0) {
        toast.error("Tidak ada item valid di keranjang");
      }
    } catch (error: unknown) {
      toast.error("Gagal memuat data keranjang");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (user && user.role !== "teknisi") {
      router.replace(
        user.role === "admin_gudang"
          ? "/scan/gudang"
          : getDefaultPath(user.role)
      );
      return;
    }

    if (items.length === 0) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    if (!namaTeknisi) {
      if (user?.role === "teknisi") {
        initSession(user.nama, "karyawan");
      } else {
        toast.error("Sesi tidak valid. Silakan mulai lagi.");
        router.push("/scan");
        return;
      }
    }

    loadCartItems();
  }, [items, namaTeknisi, user, router, initSession, loadCartItems]);

  const handleRemove = (cartItemId: string) => {
    removeItem(cartItemId);
    setCartItems(prev => prev.filter((item) => item.cartItemId !== cartItemId));
    toast.success("Barang dihapus dari keranjang", { icon: "🗑️" });
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Anda harus login untuk mengajukan transaksi");
      router.push("/login");
      return;
    }

    if (!destination.trim()) {
      toast.error("Lokasi tujuan wajib diisi");
      return;
    }

    if (hasOutOrMove && !nomorSpt.trim()) {
      toast.error("Nomor SPT wajib diisi untuk transaksi Barang Keluar (OUT) atau Pemindahan (MOVE)");
      return;
    }

    if (items.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    setSubmitting(true);

    try {
      const carrierName = user.nama;
      const transactionMeta = {
        requestedByUid: user.id,
        requestedByName: user.nama,
        requestedByRole: user.role,
        carriedByName: carrierName,
        carriedByRole: user.role,
        nomorSpt: nomorSpt.trim(),
      };

      await submitCartApprovalRequest(
        items,
        carrierName,
        destination.trim(),
        note.trim(),
        fotoUrls.length > 0 ? fotoUrls : undefined,
        transactionMeta
      );

      toast.success("Pengajuan berhasil dikirim. Menunggu verifikasi Admin Gudang.", {
        icon: "✅",
        duration: 3500,
      });
      clearCart();
      router.push("/teknisi/riwayat");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengirim pengajuan";
      toast.error(message);
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 animated-gradient-bg" />
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin"></div>
          <p className="text-telkomsat-gray font-semibold">Memuat keranjang...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 animated-gradient-bg" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-64 h-64 rounded-full opacity-15"
            style={{
              background: 'linear-gradient(135deg, #E31E24 0%, #ff6b6b 100%)',
              top: '10%',
              right: '10%',
              animation: 'float 10s ease-in-out infinite',
              filter: 'blur(40px)',
            }}
          />
        </div>
        <div className="relative z-10 text-center animate-bounce-in">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/80 backdrop-blur-sm rounded-3xl mb-6 shadow-lg">
            <ShoppingCart className="w-12 h-12 text-telkomsat-gray" />
          </div>
          <p className="text-telkomsat-black font-bold text-xl mb-2">Keranjang kosong</p>
          <p className="text-telkomsat-gray mb-6">Belum ada item yang ditambahkan</p>
          <Link 
            href="/scan" 
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Kembali ke Scan</span>
          </Link>
        </div>
      </div>
    );
  }

  const moveItems = cartItems.filter((item) => item.actionType === "MOVE");
  const damageItems = cartItems.filter((item) => item.actionType === "DAMAGE");
  const foundItems = cartItems.filter((item) => item.actionType === "FOUND");
  const dismantleItems = cartItems.filter((item) => item.actionType === "DISMANTLE");

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 animated-gradient-bg" />
      
      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-72 h-72 rounded-full opacity-15"
          style={{
            background: 'linear-gradient(135deg, #E31E24 0%, #ff6b6b 100%)',
            top: '-8%',
            right: '-5%',
            animation: 'float 12s ease-in-out infinite',
            filter: 'blur(50px)',
          }}
        />
        <div 
          className="absolute w-56 h-56 rounded-full opacity-20"
          style={{
            background: 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
            bottom: '5%',
            left: '-5%',
            animation: 'floatReverse 15s ease-in-out infinite',
            filter: 'blur(40px)',
          }}
        />
      </div>
      
      <div className="relative z-10 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <Link
            href="/scan"
            className="inline-flex items-center text-telkomsat-red hover:text-telkomsat-red-dark mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Kembali ke Scan
          </Link>
          <h1 className="text-3xl font-bold text-telkomsat-black mb-2">Keranjang Permintaan</h1>
          <div className="flex items-center space-x-2">
            <p className="text-telkomsat-gray">Teknisi:</p>
            <p className="text-telkomsat-black font-semibold">
              {namaTeknisi || user?.nama || "-"}
            </p>
            <span className="px-3 py-1 bg-telkomsat-red/10 text-telkomsat-red rounded-full text-sm font-semibold">
              {cartItems.length} Item
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-6 mb-6">
          {/* Move Items */}
          {moveItems.length > 0 && (
            <div 
              className="bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-6 animate-slide-in-left hover-lift"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-telkomsat-black">
                  Barang yang Dibawa <span className="text-telkomsat-red">({moveItems.length})</span>
                </h2>
              </div>
              <div className="space-y-3">
                {moveItems.map((item, index) => (
                  <div
                    key={item.cartItemId}
                    className="flex items-center justify-between p-4 border border-telkomsat-gray-lighter rounded-xl hover:bg-telkomsat-gray-lighter/50 transition-all duration-300 hover-lift"
                    style={{ 
                      animation: `fadeIn 0.3s ease-out ${index * 0.1}s forwards` 
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-telkomsat-black">{item.nama}</p>
                      <p className="text-sm text-telkomsat-gray mt-1">
                        {item.kode && <span>{item.kode}</span>}
                        {item.kode && item.kategori && <span> • </span>}
                        {item.kategori && <span>{item.kategori}</span>}
                        {item.serialNumber && <span className="font-mono"> • SN: {item.serialNumber}</span>}
                      </p>
                      <p className="text-sm text-telkomsat-gray mt-1">
                        📍 Lokasi: {item.lokasi || "Gudang"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(item.cartItemId)}
                      className="ml-4 p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Damage Items */}
          {damageItems.length > 0 && (
            <div 
              className="bg-white rounded-xl shadow-lg border border-red-200 p-6 animate-slide-in-right hover-lift"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-telkomsat-black">
                  Barang Rusak <span className="text-red-600">({damageItems.length})</span>
                </h2>
              </div>
              <div className="space-y-3">
                {damageItems.map((item, index) => (
                  <div
                    key={item.cartItemId}
                    className="flex items-center justify-between p-4 border border-red-200 bg-red-50/50 rounded-xl hover:bg-red-100/50 transition-all duration-300 hover-lift"
                    style={{ 
                      animation: `fadeIn 0.3s ease-out ${index * 0.1}s forwards` 
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-telkomsat-black">{item.nama}</p>
                      <p className="text-sm text-telkomsat-gray mt-1">
                        {item.kode && <span>{item.kode}</span>}
                        {item.kode && item.kategori && <span> • </span>}
                        {item.kategori && <span>{item.kategori}</span>}
                        {item.serialNumber && <span className="font-mono"> • SN: {item.serialNumber}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(item.cartItemId)}
                      className="ml-4 p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Found Items */}
          {foundItems.length > 0 && (
            <div 
              className="bg-white rounded-xl shadow-lg border border-green-200 p-6 animate-slide-in-right hover-lift"
              style={{ animationDelay: "0.25s" }}
            >
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-telkomsat-black">
                  Barang Ditemukan <span className="text-green-600">({foundItems.length})</span>
                </h2>
              </div>
              <div className="space-y-3">
                {foundItems.map((item, index) => {
                  const foundItem = items.find(i => i.id === item.cartItemId);
                  return (
                    <div
                      key={item.cartItemId}
                      className="flex items-center justify-between p-5 border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50/50 rounded-xl hover:from-green-100 hover:to-emerald-100/50 transition-all duration-300 hover-lift shadow-sm"
                      style={{ 
                        animation: `fadeIn 0.3s ease-out ${index * 0.1}s forwards` 
                      }}
                    >
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="p-2.5 bg-green-100 rounded-xl flex-shrink-0">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-telkomsat-black text-base">{item.nama}</p>
                          <div className="mt-2 space-y-1">
                            {item.kode && (
                              <p className="text-sm text-telkomsat-gray">
                                <span className="font-medium">Kode:</span> {item.kode}
                                {item.kategori && <span className="text-telkomsat-gray"> • {item.kategori}</span>}
                              </p>
                            )}
                            {item.serialNumber && (
                              <p className="text-sm text-telkomsat-gray font-mono">
                                <span className="font-medium">SN:</span> {item.serialNumber}
                              </p>
                            )}
                            {foundItem?.lokasiDitemukan && (
                              <div className="mt-2 pt-2 border-t border-green-200">
                                <p className="text-sm text-green-700 font-semibold flex items-center space-x-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>Ditemukan di: <span className="text-green-800">{foundItem.lokasiDitemukan}</span></span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(item.cartItemId)}
                        className="ml-4 p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 flex-shrink-0"
                        title="Hapus dari keranjang"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dismantle Items */}
          {dismantleItems.length > 0 && (
            <div
              className="bg-white rounded-xl shadow-lg border border-orange-200 p-6 animate-slide-in-right hover-lift"
              style={{ animationDelay: "0.28s" }}
            >
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-telkomsat-black">
                  Barang Dismantle <span className="text-orange-600">({dismantleItems.length})</span>
                </h2>
              </div>
              <div className="space-y-3">
                {dismantleItems.map((item, index) => {
                  const cartItem = items.find((i) => i.id === item.cartItemId);
                  return (
                    <div
                      key={item.cartItemId}
                      className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50/50 rounded-xl hover:bg-orange-100/50 transition-all duration-300 hover-lift"
                      style={{
                        animation: `fadeIn 0.3s ease-out ${index * 0.1}s forwards`,
                      }}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-telkomsat-black">{item.nama}</p>
                        <p className="text-sm text-telkomsat-gray mt-1">
                          {item.kode && <span>Tagging: {item.kode}</span>}
                          {item.serialNumber && <span className="font-mono"> - SN: {item.serialNumber}</span>}
                        </p>
                        <p className="text-sm text-orange-700 mt-1">
                          Kondisi: {cartItem?.kondisiDismantle || "Tidak Diketahui"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(item.cartItemId)}
                        className="ml-4 p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Submission Form */}
        <div 
          className="bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-6 animate-scale-in"
          style={{ animationDelay: "0.3s" }}
        >
          <h2 className="text-xl font-bold text-telkomsat-black mb-2">Detail Permintaan Approval</h2>
          <p className="text-sm text-telkomsat-gray mb-5">
            Barang belum keluar dari gudang sampai Admin Gudang menyetujui permintaan ini.
          </p>

          <div className="space-y-5">
            <div>
              <label htmlFor="nomor-spt" className="block text-sm font-semibold text-telkomsat-black mb-2">
                Nomor SPT{" "}
                {hasOutOrMove ? (
                  <span className="text-telkomsat-red">*</span>
                ) : (
                  <span>(Opsional)</span>
                )}
              </label>
              <input
                id="nomor-spt"
                type="text"
                value={nomorSpt}
                onChange={(e) => setNomorSpt(e.target.value)}
                required={hasOutOrMove}
                aria-describedby="nomor-spt-help"
                disabled={submitting}
                placeholder="Masukkan nomor SPT"
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              />
              <p id="nomor-spt-help" className="text-xs text-telkomsat-gray mt-1">
                Nomor SPT wajib diisi untuk transaksi Barang Keluar (OUT) atau Pemindahan (MOVE).
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                <MapPin className="w-4 h-4 inline mr-1 text-telkomsat-red" />
                Lokasi Tujuan / Lokasi Kerusakan{" "}
                <span className="text-telkomsat-red">*</span>
              </label>
              <input
                type="text"
                list="lokasi-keranjang-list"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                placeholder="Pilih atau ketik lokasi (Site, Customer, Workshop, dll)"
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              />
              <datalist id="lokasi-keranjang-list">
                {lokasiOptions.map((nama) => (
                  <option key={nama} value={nama} />
                ))}
              </datalist>
              {lokasiOptions.length === 0 && (
                <p className="text-xs text-telkomsat-gray mt-1">
                  Tip: admin dapat menambah master lokasi di menu Master Lokasi setelah login.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                Keterangan (Opsional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Contoh: Dipakai untuk perbaikan antena di site X"
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white resize-none"
              />
            </div>

            <div>
              <ImageUpload
                value={fotoUrls}
                onChange={setFotoUrls}
                maxImages={10}
                folder="transaksi-guest"
                label="Foto Kondisi Barang (Opsional)"
                disabled={submitting}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !destination.trim()}
              className="w-full bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white py-3.5 px-4 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold flex items-center justify-center space-x-2"
            >
              <Send className="w-5 h-5" />
              <span>{submitting ? "Mengirim..." : "Ajukan Approval"}</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
