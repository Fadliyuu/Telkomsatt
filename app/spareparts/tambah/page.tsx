"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import NamaPerangkatAutocomplete from "@/components/NamaPerangkatAutocomplete";
import { createSparepartItem } from "@/lib/firebase/sparepartItems";
import { useAuthStore } from "@/lib/store/useAuthStore";
import {
  ITEM_STATUS_VALUES,
  CARI_FISIK_VALUES,
  DEFAULT_ITEM_STATUS,
  DEFAULT_CARI_FISIK,
  DEFAULT_LOKASI,
  CariFisikValue,
  ItemStatusValue,
} from "@/lib/constants/sparepartItem";
import toast from "react-hot-toast";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function TambahSparepartPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    namaPerangkat: "",
    serialNumber: "",
    tagging: "",
    cariFisik: DEFAULT_CARI_FISIK as CariFisikValue,
    lokasiSaatIni: DEFAULT_LOKASI,
    status: DEFAULT_ITEM_STATUS as ItemStatusValue,
    keterangan: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.namaPerangkat.trim()) {
        toast.error("Mohon isi Nama Perangkat");
        return;
      }

      const sn = formData.serialNumber.trim();
      const tag = formData.tagging.trim();
      if (!sn && !tag) {
        toast.error("Serial Number atau Tag wajib diisi salah satu");
        return;
      }

      const result = await createSparepartItem({
        namaPerangkat: formData.namaPerangkat.trim(),
        serialNumber: sn,
        tagging: tag || undefined,
        cariFisik: formData.cariFisik,
        lokasiSaatIni: formData.lokasiSaatIni.trim() || DEFAULT_LOKASI,
        status: formData.status,
        keterangan: formData.keterangan.trim() || undefined,
        carriedByName: user?.nama,
        carriedByRole: user?.role,
      });

      toast.success("Sparepart berhasil ditambahkan!");
      router.push(
        result.qrCodeDataUrl
          ? `/item/${result.itemId}?qr=${encodeURIComponent(result.qrCodeDataUrl)}`
          : `/item/${result.itemId}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal menambah sparepart";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-4 animate-slide-in-left">
          <Link
            href="/spareparts"
            className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-telkomsat-black" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-telkomsat-black mb-2">
              Tambah Sparepart
            </h1>
            <p className="text-telkomsat-gray text-lg">
              Tambah item fisik — pilih nama yang sudah ada atau ketik baru
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-8 space-y-6 animate-scale-in"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label
                htmlFor="namaPerangkat"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                Nama Perangkat <span className="text-telkomsat-red">*</span>
              </label>
              <NamaPerangkatAutocomplete
                id="namaPerangkat"
                value={formData.namaPerangkat}
                onChange={(v) => setFormData({ ...formData, namaPerangkat: v })}
                required
              />
            </div>

            <div>
              <label
                htmlFor="serialNumber"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                Serial Number
              </label>
              <input
                id="serialNumber"
                type="text"
                value={formData.serialNumber}
                onChange={(e) =>
                  setFormData({ ...formData, serialNumber: e.target.value })
                }
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="Wajib jika Tag kosong"
              />
            </div>

            <div>
              <label
                htmlFor="tagging"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                Tag / Label
              </label>
              <input
                id="tagging"
                type="text"
                value={formData.tagging}
                onChange={(e) =>
                  setFormData({ ...formData, tagging: e.target.value })
                }
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="Wajib jika SN kosong"
              />
            </div>

            <div>
              <label
                htmlFor="cariFisik"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                Cari Fisik <span className="text-telkomsat-red">*</span>
              </label>
              <select
                id="cariFisik"
                value={formData.cariFisik}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cariFisik: e.target.value as CariFisikValue,
                  })
                }
                required
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none bg-telkomsat-gray-lighter/30 focus:bg-white"
              >
                {CARI_FISIK_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                Status Stok <span className="text-telkomsat-red">*</span>
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as ItemStatusValue,
                  })
                }
                required
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none bg-telkomsat-gray-lighter/30 focus:bg-white"
              >
                {ITEM_STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="lokasiSaatIni"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                Lokasi Saat Ini
              </label>
              <input
                id="lokasiSaatIni"
                type="text"
                value={formData.lokasiSaatIni}
                onChange={(e) =>
                  setFormData({ ...formData, lokasiSaatIni: e.target.value })
                }
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder={`Default: ${DEFAULT_LOKASI}`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="keterangan"
              className="block text-sm font-semibold text-telkomsat-black mb-2"
            >
              Keterangan
            </label>
            <textarea
              id="keterangan"
              value={formData.keterangan}
              onChange={(e) =>
                setFormData({ ...formData, keterangan: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-telkomsat-gray-lighter">
            <Link
              href="/spareparts"
              className="px-5 py-2.5 border-2 border-telkomsat-gray-light rounded-xl font-semibold"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? "Menyimpan..." : "Simpan & Generate QR"}</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
