"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { getSparepartItemById, updateSparepartItem } from "@/lib/firebase/sparepartItems";
import { useAuthStore } from "@/lib/store/useAuthStore";
import NamaPerangkatAutocomplete from "@/components/NamaPerangkatAutocomplete";
import {
  ITEM_STATUS_VALUES,
  CARI_FISIK_VALUES,
  normalizeCariFisik,
  normalizeItemStatus,
  CariFisikValue,
  ItemStatusValue,
} from "@/lib/constants/sparepartItem";
import toast from "react-hot-toast";
import { ArrowLeft, Save, Package, Hash, Tag, MapPin, FileText } from "lucide-react";
import Link from "next/link";

export default function EditSparepartItemPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    namaPerangkat: "",
    serialNumber: "",
    tagging: "",
    cariFisik: "Sesuai" as CariFisikValue,
    lokasiSaatIni: "",
    status: "Tersedia" as ItemStatusValue,
    keterangan: "",
  });

  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSparepartItemById(id);
      if (!data) {
        toast.error("Item tidak ditemukan");
        router.push("/spareparts");
        return;
      }

      setFormData({
        namaPerangkat: data.namaPerangkat || "",
        serialNumber: data.serialNumber || "",
        tagging: data.tagging || "",
        cariFisik: normalizeCariFisik(data.cariFisik),
        lokasiSaatIni: data.lokasiSaatIni || "",
        status: normalizeItemStatus(data.status),
        keterangan: data.keterangan || "",
      });
    } catch (error: unknown) {
      toast.error("Gagal memuat data item");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) {
      loadItem();
    }
  }, [id, loadItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.namaPerangkat) {
        toast.error("Nama Perangkat wajib diisi");
        return;
      }

      await updateSparepartItem(id, formData, {
        actor: {
          name: user?.nama,
          role: user?.role,
        },
      });
      toast.success("Item berhasil diperbarui!");
      router.push(`/item/${id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal memperbarui item";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
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

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center space-x-4 animate-slide-in-left">
          <Link
            href="/spareparts"
            className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-telkomsat-black" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-telkomsat-black">Edit Item Sparepart</h1>
            <p className="text-telkomsat-gray mt-1">Perbarui data item</p>
          </div>
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter p-6 space-y-6 animate-scale-in"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nama Perangkat */}
            <div className="md:col-span-2">
              <label htmlFor="namaPerangkat" className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="w-4 h-4 inline mr-1" />
                Nama Perangkat <span className="text-red-500">*</span>
              </label>
              <NamaPerangkatAutocomplete
                id="namaPerangkat"
                value={formData.namaPerangkat}
                onChange={(v) => setFormData({ ...formData, namaPerangkat: v })}
                required
              />
            </div>

            {/* Serial Number */}
            <div>
              <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Serial Number
              </label>
              <input
                id="serialNumber"
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="Contoh: A07458A12"
                className="w-full px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all font-mono"
              />
            </div>

            {/* Tagging */}
            <div>
              <label htmlFor="tagging" className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Tagging
              </label>
              <input
                id="tagging"
                type="text"
                value={formData.tagging}
                onChange={(e) => setFormData({ ...formData, tagging: e.target.value })}
                placeholder="Contoh: TLSAT1339900026009"
                className="w-full px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all"
              />
            </div>

            {/* Lokasi Saat Ini */}
            <div>
              <label htmlFor="lokasiSaatIni" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Lokasi Saat Ini
              </label>
              <input
                id="lokasiSaatIni"
                type="text"
                value={formData.lokasiSaatIni}
                onChange={(e) => setFormData({ ...formData, lokasiSaatIni: e.target.value })}
                placeholder="Contoh: Gudang, Ruang Spare, Site A"
                className="w-full px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all"
              />
            </div>

            {/* Cari Fisik */}
            <div>
              <label htmlFor="cariFisik" className="block text-sm font-medium text-gray-700 mb-2">
                Cari Fisik
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
                className="w-full px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all"
              >
                {CARI_FISIK_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status Stok
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
                className="w-full px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all"
              >
                {ITEM_STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Keterangan */}
            <div className="md:col-span-2">
              <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Keterangan
              </label>
              <textarea
                id="keterangan"
                value={formData.keterangan}
                onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                rows={3}
                placeholder="Catatan tambahan tentang item ini..."
                className="w-full px-4 py-2.5 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-telkomsat-gray-lighter">
            <Link
              href="/spareparts"
              className="px-5 py-2.5 border-2 border-telkomsat-gray-lighter text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-all font-semibold"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-6 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
