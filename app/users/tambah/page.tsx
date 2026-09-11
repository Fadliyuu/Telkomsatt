"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { createUser } from "@/lib/firebase/users";
import { UserRole, USER_ROLE_LABELS, USER_ROLES } from "@/types";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Briefcase,
  Shield,
  Wrench,
  ClipboardCheck,
  Warehouse,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

export default function TambahUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    password: "",
    role: "teknisi" as UserRole,
    jabatan: "",
    nomorHP: "",
    alamat: "",
    divisi: "",
    tanggalMulai: "",
    tanggalSelesai: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.nama || !formData.email || !formData.password) {
        toast.error("Nama, Email, dan Password wajib diisi");
        return;
      }

      await createUser({
        nama: formData.nama,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        jabatan: formData.jabatan || undefined,
        nomorHP: formData.nomorHP || undefined,
        alamat: formData.alamat || undefined,
        divisi: formData.divisi || undefined,
        tanggalMulai: formData.tanggalMulai ? new Date(formData.tanggalMulai) : undefined,
        tanggalSelesai: formData.tanggalSelesai ? new Date(formData.tanggalSelesai) : undefined,
      });

      toast.success("Pengguna berhasil ditambahkan!");
      router.push("/users");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal menambah pengguna";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "direktur":
        return <Shield className="w-5 h-5" />;
      case "manager":
        return <Briefcase className="w-5 h-5" />;
      case "supervisor":
        return <ClipboardCheck className="w-5 h-5" />;
      case "admin_gudang":
        return <Warehouse className="w-5 h-5" />;
      case "admin_keuangan":
        return <WalletCards className="w-5 h-5" />;
      case "teknisi":
        return <Wrench className="w-5 h-5" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-4 animate-slide-in-left">
          <Link
            href="/users"
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-telkomsat-black" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-telkomsat-black mb-2">
              Tambah Pengguna
            </h1>
            <p className="text-telkomsat-gray text-lg">
              Tambah akun pengguna baru ke sistem
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-telkomsat-gray-lighter p-8 space-y-6 animate-scale-in"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-telkomsat-black mb-3">
              Role Pengguna <span className="text-telkomsat-red">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {USER_ROLES.filter((role) => role !== "direktur").map(
                (role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormData({ ...formData, role })}
                    className={`flex items-center justify-center space-x-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                      formData.role === role
                        ? "border-telkomsat-red bg-telkomsat-red/10 text-telkomsat-red"
                        : "border-telkomsat-gray-lighter bg-white hover:border-telkomsat-red/50 text-telkomsat-black"
                    }`}
                  >
                    {getRoleIcon(role)}
                    <span className="font-semibold">{USER_ROLE_LABELS[role]}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nama */}
            <div>
              <label
                htmlFor="nama"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <User className="w-4 h-4 inline mr-1" />
                Nama Lengkap <span className="text-telkomsat-red">*</span>
              </label>
              <input
                id="nama"
                type="text"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                required
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="Masukkan nama lengkap"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <Mail className="w-4 h-4 inline mr-1" />
                Email <span className="text-telkomsat-red">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="email@telkomsat.com"
              />
            </div>

            {/* Nomor HP */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <Lock className="w-4 h-4 inline mr-1" />
                Password <span className="text-telkomsat-red">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="Minimal 6 karakter"
              />
            </div>

            {/* Nomor HP */}
            <div>
              <label
                htmlFor="nomorHP"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <Phone className="w-4 h-4 inline mr-1" />
                Nomor HP
              </label>
              <input
                id="nomorHP"
                type="tel"
                value={formData.nomorHP}
                onChange={(e) => setFormData({ ...formData, nomorHP: e.target.value })}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Divisi */}
            <div>
              <label
                htmlFor="divisi"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <Briefcase className="w-4 h-4 inline mr-1" />
                Divisi / Departemen
              </label>
              <input
                id="divisi"
                type="text"
                value={formData.divisi}
                onChange={(e) => setFormData({ ...formData, divisi: e.target.value })}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="Contoh: IT, Teknik, dll"
              />
            </div>

            <div>
              <label
                htmlFor="jabatan"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <Briefcase className="w-4 h-4 inline mr-1" />
                Jabatan
              </label>
              <input
                id="jabatan"
                type="text"
                value={formData.jabatan}
                onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
                placeholder="Contoh: Supervisor Field"
              />
            </div>

            {/* Alamat */}
            <div className="md:col-span-2">
              <label
                htmlFor="alamat"
                className="block text-sm font-semibold text-telkomsat-black mb-2"
              >
                <MapPin className="w-4 h-4 inline mr-1" />
                Alamat
              </label>
              <textarea
                id="alamat"
                value={formData.alamat}
                onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white resize-none"
                placeholder="Alamat lengkap"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-telkomsat-gray-lighter">
            <Link
              href="/users"
              className="px-5 py-2.5 border-2 border-telkomsat-gray-light text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-all duration-300 font-semibold"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-6 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold btn-shine"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Simpan Pengguna</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}


