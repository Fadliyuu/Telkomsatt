"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import UserAvatar from "@/components/UserAvatar";
import { getUserById, setUserPassword, updateUser } from "@/lib/firebase/users";
import { deleteImage, uploadImage } from "@/lib/utils/cloudinary";
import { User, UserRole, USER_ROLE_LABELS, USER_ROLES } from "@/types";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  Trash2,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Shield,
  Wrench,
  ClipboardCheck,
  Warehouse,
  WalletCards,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const manageableRoles = USER_ROLES;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    role: "teknisi" as UserRole,
    nomorHP: "",
    alamat: "",
    divisi: "",
    tanggalMulai: "",
    tanggalSelesai: "",
  });

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const userData = await getUserById(userId);
      if (!userData) {
        toast.error("Pengguna tidak ditemukan");
        router.push("/users");
        return;
      }
      setUser(userData);
      setFormData({
        nama: userData.nama,
        email: userData.email,
        role: userData.role,
        nomorHP: userData.nomorHP || "",
        alamat: userData.alamat || "",
        divisi: userData.divisi || "",
        tanggalMulai: userData.tanggalMulai
          ? new Date(userData.tanggalMulai).toISOString().split("T")[0]
          : "",
        tanggalSelesai: userData.tanggalSelesai
          ? new Date(userData.tanggalSelesai).toISOString().split("T")[0]
          : "",
      });
    } catch (error: unknown) {
      toast.error("Gagal memuat data pengguna");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.nama || !formData.email) {
        toast.error("Nama dan Email wajib diisi");
        return;
      }

      await updateUser(userId, {
        nama: formData.nama,
        email: formData.email,
        role: formData.role,
        nomorHP: formData.nomorHP || "",
        alamat: formData.alamat || "",
        divisi: formData.divisi || "",
        tanggalMulai: formData.tanggalMulai ? new Date(formData.tanggalMulai) : undefined,
        tanggalSelesai: formData.tanggalSelesai ? new Date(formData.tanggalSelesai) : undefined,
      });

      toast.success("Pengguna berhasil diupdate!");
      router.push("/users");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengupdate pengguna";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!user || !file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      const previousPublicId = user.fotoProfilPublicId;
      const result = await uploadImage(file, "inventaris-sparepart/profile");
      await updateUser(user.id, {
        fotoProfilUrl: result.url,
        fotoProfilPublicId: result.publicId,
      });
      setUser({
        ...user,
        fotoProfilUrl: result.url,
        fotoProfilPublicId: result.publicId,
        updatedAt: new Date(),
      });

      if (previousPublicId && previousPublicId !== result.publicId) {
        await deleteImage(previousPublicId).catch(() => undefined);
      }

      toast.success("Foto profil pengguna diperbarui");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah foto";
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!user || !user.fotoProfilUrl) return;

    setUploadingPhoto(true);
    try {
      const previousPublicId = user.fotoProfilPublicId;
      await updateUser(user.id, {
        fotoProfilUrl: "",
        fotoProfilPublicId: "",
      });
      setUser({
        ...user,
        fotoProfilUrl: "",
        fotoProfilPublicId: "",
        updatedAt: new Date(),
      });
      if (previousPublicId) {
        await deleteImage(previousPublicId).catch(() => undefined);
      }
      toast.success("Foto profil pengguna dihapus");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal menghapus foto";
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const changeUserPassword = async (password: string, isDefaultReset = false) => {
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    if (!isDefaultReset && password !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }

    setPasswordSaving(true);
    try {
      await setUserPassword(userId, password);
      setNewPassword("");
      setConfirmPassword("");
      toast.success(isDefaultReset ? 'Password berhasil direset menjadi "password"' : "Password pengguna berhasil diganti");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Gagal mengganti password pengguna");
    } finally {
      setPasswordSaving(false);
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
        <div className="flex items-center space-x-4 animate-slide-in-left">
          <Link
            href="/users"
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-telkomsat-black" />
          </Link>
          <div>
            <div className="flex items-center gap-4">
              <UserAvatar name={user?.nama} src={user?.fotoProfilUrl} size="lg" />
              <div>
                <h1 className="text-4xl font-bold text-telkomsat-black mb-2">
                  Edit Pengguna
                </h1>
                <p className="text-telkomsat-gray text-lg">
                  {user?.nama} - {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-telkomsat-gray-lighter p-8 space-y-6 animate-scale-in anim-delay-100"
        >
          <div className="flex flex-col gap-4 rounded-xl border border-telkomsat-gray-lighter bg-white p-4 sm:flex-row sm:items-center">
            <UserAvatar name={user?.nama} src={user?.fotoProfilUrl} size="xl" />
            <div className="flex-1">
              <p className="font-bold text-telkomsat-black">Foto Profil</p>
              <p className="mt-1 text-sm text-telkomsat-gray">
                Foto ini akan tampil di daftar user, sidebar user, dan notifikasi.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-2 rounded-xl bg-telkomsat-red px-4 py-2 text-sm font-semibold text-white hover:bg-telkomsat-red-dark disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {uploadingPhoto ? "Mengunggah..." : "Upload Foto"}
                </button>
                {user?.fotoProfilUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-telkomsat-black mb-3">
              Role Pengguna <span className="text-telkomsat-red">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {manageableRoles.map(
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
                <UserIcon className="w-4 h-4 inline mr-1" />
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
              disabled={saving}
              className="flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-6 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold btn-shine"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-xl animate-scale-in anim-delay-150">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-md">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-telkomsat-red/15 p-2.5 text-telkomsat-red"><KeyRound className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-bold text-white">Kelola Password</h2>
                  <p className="text-xs text-gray-400">Perubahan akan mencabut sesi aktif pengguna.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Reset password ${user?.nama || "pengguna"} menjadi \"password\"? Sesi aktif pengguna akan dicabut.`)) {
                    changeUserPassword("password", true);
                  }
                }}
                disabled={passwordSaving}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50"
              >
                <RotateCcw className={`h-4 w-4 ${passwordSaving ? "animate-spin" : ""}`} />
                Reset ke password default
              </button>
              <p className="mt-2 text-[11px] text-gray-500">Password default: <code className="rounded bg-white/10 px-1.5 py-0.5 text-gray-300">password</code></p>
            </div>

            <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-user-password" className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Password Baru</label>
                <input id="new-user-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} placeholder="Minimal 6 karakter" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-telkomsat-red" />
              </div>
              <div>
                <label htmlFor="confirm-user-password" className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Konfirmasi</label>
                <input id="confirm-user-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} placeholder="Ulangi password" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-telkomsat-red" />
              </div>
              <button type="button" onClick={() => changeUserPassword(newPassword)} disabled={passwordSaving || !newPassword || !confirmPassword} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
                {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Ganti Password Pengguna
              </button>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
