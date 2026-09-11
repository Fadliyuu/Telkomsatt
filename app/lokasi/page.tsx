"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  createLokasi,
  deleteLokasi,
  getLokasiList,
  updateLokasi,
} from "@/lib/firebase/lokasi";
import { Lokasi, LokasiType } from "@/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import toast from "react-hot-toast";
import { MapPin, Plus, Trash2, Pencil, X, Save } from "lucide-react";

const TIPE_OPTIONS: LokasiType[] = [
  "Gudang",
  "Site",
  "Customer",
  "Workshop",
  "Lainnya",
];

const emptyForm = {
  namaLokasi: "",
  tipe: "Gudang" as LokasiType,
  alamat: "",
  keterangan: "",
};

export default function LokasiPage() {
  const { user } = useAuthStore();
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getLokasiList();
      setLokasiList(data);
    } catch {
      toast.error("Gagal memuat data lokasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: Lokasi) => {
    setForm({
      namaLokasi: item.namaLokasi,
      tipe: item.tipe,
      alamat: item.alamat ?? "",
      keterangan: item.keterangan ?? "",
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.namaLokasi.trim()) {
      toast.error("Nama lokasi wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const actor = { name: user?.nama, role: user?.role };
      const payload = {
        namaLokasi: form.namaLokasi.trim(),
        tipe: form.tipe,
        alamat: form.alamat.trim() || undefined,
        keterangan: form.keterangan.trim() || undefined,
      };

      if (editingId) {
        await updateLokasi(editingId, payload, actor);
        toast.success("Lokasi berhasil diperbarui");
      } else {
        await createLokasi({ ...payload, actor });
        toast.success("Lokasi baru ditambahkan");
      }

      resetForm();
      await loadData();
    } catch {
      toast.error("Gagal menyimpan lokasi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Lokasi) => {
    if (!confirm(`Hapus lokasi "${item.namaLokasi}"?`)) return;
    try {
      await deleteLokasi(item.id, {
        name: user?.nama,
        role: user?.role,
      });
      toast.success("Lokasi dihapus");
      await loadData();
    } catch {
      toast.error("Gagal menghapus lokasi");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in text-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-telkomsat-red/20 border border-telkomsat-red/30 rounded-xl">
                <MapPin className="w-6 h-6 text-telkomsat-red" />
              </div>
              <span>Master Lokasi</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Kelola lokasi gudang, site, customer, dan workshop untuk pergerakan barang.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Lokasi</span>
          </button>
        </div>

        {/* Modal / Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-6 space-y-4 text-white"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingId ? "Edit Lokasi" : "Tambah Lokasi Baru"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-300 uppercase mb-1.5">
                  Nama Lokasi *
                </label>
                <input
                  value={form.namaLokasi}
                  onChange={(e) =>
                    setForm({ ...form, namaLokasi: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-white/15 rounded-xl bg-white/5 text-white placeholder-gray-400 focus:ring-2 focus:ring-telkomsat-red outline-none"
                  placeholder="Contoh: Gudang Regional 6"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-300 uppercase mb-1.5">Tipe</label>
                <select
                  value={form.tipe}
                  onChange={(e) =>
                    setForm({ ...form, tipe: e.target.value as LokasiType })
                  }
                  className="w-full px-4 py-2.5 border border-white/15 rounded-xl bg-[#161922] text-white focus:ring-2 focus:ring-telkomsat-red outline-none"
                >
                  {TIPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-gray-300 uppercase mb-1.5">Alamat</label>
                <input
                  value={form.alamat}
                  onChange={(e) =>
                    setForm({ ...form, alamat: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-white/15 rounded-xl bg-white/5 text-white placeholder-gray-400 focus:ring-2 focus:ring-telkomsat-red outline-none"
                  placeholder="Alamat lengkap lokasi..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-gray-300 uppercase mb-1.5">
                  Keterangan
                </label>
                <textarea
                  value={form.keterangan}
                  onChange={(e) =>
                    setForm({ ...form, keterangan: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 border border-white/15 rounded-xl bg-white/5 text-white placeholder-gray-400 focus:ring-2 focus:ring-telkomsat-red outline-none"
                  placeholder="Catatan tambahan..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-xs font-bold text-gray-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white font-bold text-xs shadow-lg shadow-red-600/30 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        )}

        {/* Table Container */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 font-medium">
              Memuat data lokasi...
            </div>
          ) : lokasiList.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              Belum ada lokasi. Tambahkan lokasi pertama untuk dipakai di transaksi scan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-white/10 text-xs font-bold text-gray-300 uppercase border-b border-white/10">
                  <tr>
                    <th className="p-4">Nama Lokasi</th>
                    <th className="p-4">Tipe</th>
                    <th className="p-4">Alamat</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lokasiList.map((item) => (
                    <tr key={item.id} className="hover:bg-white/10 transition-colors">
                      <td className="p-4 font-bold text-white">{item.namaLokasi}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-telkomsat-red/20 text-telkomsat-red text-xs font-bold border border-telkomsat-red/30">
                          {item.tipe}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-300">
                        {item.alamat || "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
