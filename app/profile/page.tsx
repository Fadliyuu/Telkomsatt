"use client";

import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import UserAvatar from "@/components/UserAvatar";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { auth } from "@/lib/firebase/config";
import { deleteImage, uploadImage } from "@/lib/utils/cloudinary";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { Camera, ImageUp, KeyRound, Loader2, Save, Trash2, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";

type PendingProfilePhoto = {
  file: File;
  previewUrl: string;
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoEditorRef = useRef<HTMLDivElement>(null);
  const photoDragRef = useRef({
    dragging: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    pinchDistance: 0,
  });
  const [profile, setProfile] = useState({
    nama: "",
    nomorHP: "",
    alamat: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingProfilePhoto | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoOffsetX, setPhotoOffsetX] = useState(0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const clampZoom = (value: number) => clamp(value, 1, 3);
  const clampOffset = (value: number) => clamp(value, -50, 50);

  useEffect(() => {
    if (!user) return;
    setProfile({
      nama: user.nama || "",
      nomorHP: user.nomorHP || "",
      alamat: user.alamat || "",
    });
  }, [user]);

  useEffect(() => {
    return () => {
      if (pendingPhoto?.previewUrl) {
        URL.revokeObjectURL(pendingPhoto.previewUrl);
      }
    };
  }, [pendingPhoto]);

  const updateProfile = async (payload: Record<string, unknown>) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sesi login tidak valid");

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Gagal memperbarui profil");
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!profile.nama.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        nama: profile.nama.trim(),
        nomorHP: profile.nomorHP.trim(),
        alamat: profile.alamat.trim(),
      };
      await updateProfile(payload);
      setUser({ ...user, ...payload, updatedAt: new Date() });
      toast.success("Profil berhasil diperbarui");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal memperbarui profil";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (pendingPhoto?.previewUrl) URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto({
      file,
      previewUrl: URL.createObjectURL(file),
    });
    setPhotoZoom(1);
    setPhotoOffsetX(0);
    setPhotoOffsetY(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closePhotoEditor = () => {
    if (pendingPhoto?.previewUrl) URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto(null);
    setPhotoZoom(1);
    setPhotoOffsetX(0);
    setPhotoOffsetY(0);
    photoDragRef.current = {
      dragging: false,
      pointerId: -1,
      lastX: 0,
      lastY: 0,
      pinchDistance: 0,
    };
  };

  const handlePhotoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && event.isPrimary === false) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    photoDragRef.current = {
      ...photoDragRef.current,
      dragging: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  };

  const handlePhotoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = photoDragRef.current;
    if (!dragState.dragging || dragState.pointerId !== event.pointerId) return;

    const bounds = photoEditorRef.current?.getBoundingClientRect();
    const size = bounds?.width || 1;
    const deltaX = ((event.clientX - dragState.lastX) / size) * 100;
    const deltaY = ((event.clientY - dragState.lastY) / size) * 100;

    setPhotoOffsetX((value) => clampOffset(value + deltaX));
    setPhotoOffsetY((value) => clampOffset(value + deltaY));

    photoDragRef.current.lastX = event.clientX;
    photoDragRef.current.lastY = event.clientY;
  };

  const stopPhotoDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (photoDragRef.current.pointerId === event.pointerId) {
      photoDragRef.current.dragging = false;
      photoDragRef.current.pointerId = -1;
    }
  };

  const handlePhotoWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;
    setPhotoZoom((value) => clampZoom(Number((value + zoomDelta).toFixed(2))));
  };

  const getTouchDistance = (touches: React.TouchList) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  const handlePhotoTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      photoDragRef.current.dragging = false;
      photoDragRef.current.pinchDistance = getTouchDistance(event.touches);
    }
  };

  const handlePhotoTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;

    const distance = getTouchDistance(event.touches);
    const previousDistance = photoDragRef.current.pinchDistance || distance;
    const delta = (distance - previousDistance) / 180;

    setPhotoZoom((value) => clampZoom(Number((value + delta).toFixed(2))));
    photoDragRef.current.pinchDistance = distance;
  };

  const createEditedProfilePhoto = async () => {
    if (!pendingPhoto) throw new Error("Pilih foto terlebih dahulu");

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca gambar"));
      img.src = pendingPhoto.previewUrl;
    });

    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak mendukung edit gambar");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);

    const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const scale = baseScale * photoZoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (size - width) / 2 + (photoOffsetX / 100) * (size / 2);
    const y = (size - height) / 2 + (photoOffsetY / 100) * (size / 2);

    context.drawImage(image, x, y, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Gagal memproses gambar"));
        },
        "image/jpeg",
        0.9
      );
    });

    return new File([blob], "foto-profil.jpg", { type: "image/jpeg" });
  };

  const handleConfirmPhotoUpload = async () => {
    if (!user || !pendingPhoto) return;

    setUploadingPhoto(true);
    try {
      const previousPublicId = user.fotoProfilPublicId;
      const editedFile = await createEditedProfilePhoto();
      const result = await uploadImage(editedFile, "inventaris-sparepart/profile");
      const payload = {
        fotoProfilUrl: result.url,
        fotoProfilPublicId: result.publicId,
      };

      await updateProfile(payload);
      setUser({
        ...user,
        fotoProfilUrl: result.url,
        fotoProfilPublicId: result.publicId,
        updatedAt: new Date(),
      });

      if (previousPublicId && previousPublicId !== result.publicId) {
        await deleteImage(previousPublicId).catch(() => undefined);
      }

      toast.success("Foto profil berhasil diperbarui");
      closePhotoEditor();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah foto profil";
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user || !user.fotoProfilUrl) return;

    setUploadingPhoto(true);
    try {
      const previousPublicId = user.fotoProfilPublicId;
      await updateProfile({
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
      toast.success("Foto profil dihapus");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal menghapus foto profil";
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) {
      toast.error("Sesi login tidak valid");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password berhasil diganti");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengganti password";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in text-white">
        <div className="border-b border-white/10 pb-5">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Profil Pengguna</h1>
          <p className="text-sm text-gray-400">Kelola data diri, foto profil, dan keamanan akun Anda.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <form onSubmit={handleProfileSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <UserRound className="h-5 w-5 text-telkomsat-red" />
              <h2 className="text-lg font-bold text-white">Data Profil</h2>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
              <UserAvatar name={user?.nama} src={user?.fotoProfilUrl} size="xl" />
              <div className="flex-1">
                <p className="font-bold text-white">Foto Profil</p>
                <p className="mt-1 text-xs text-gray-400">
                  Pilih foto, lalu atur crop dan zoom sebelum upload.
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
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:scale-105 transition-all disabled:opacity-50"
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
                      className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1.5 block font-bold text-gray-300 uppercase">Nama Lengkap</label>
                <input
                  value={profile.nama}
                  onChange={(e) => setProfile({ ...profile, nama: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 text-white px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-bold text-gray-300 uppercase">Nomor HP / WhatsApp</label>
                <input
                  value={profile.nomorHP}
                  onChange={(e) => setProfile({ ...profile, nomorHP: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 text-white px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-bold text-gray-300 uppercase">Alamat Domisili / Tugas</label>
                <textarea
                  value={profile.alamat}
                  rows={4}
                  onChange={(e) => setProfile({ ...profile, alamat: e.target.value })}
                  className="w-full resize-none rounded-xl border border-white/15 bg-white/5 text-white px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-2.5 font-bold text-xs text-white shadow-lg shadow-red-600/30 hover:scale-105 transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingProfile ? "Menyimpan..." : "Simpan Profil"}
            </button>
          </form>

          <form onSubmit={handlePasswordSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <KeyRound className="h-5 w-5 text-telkomsat-red" />
              <h2 className="text-lg font-bold text-white">Ganti Password Sesi</h2>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1.5 block font-bold text-gray-300 uppercase">Password Lama</label>
                <input
                  type="password"
                  placeholder="Masukkan password saat ini"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 text-white px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-bold text-gray-300 uppercase">Password Baru</label>
                <input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 text-white px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-bold text-gray-300 uppercase">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  placeholder="Ulangi password baru"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 text-white px-4 py-3 outline-none focus:border-telkomsat-red focus:ring-2 focus:ring-telkomsat-red/20 placeholder-gray-400"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-2.5 font-bold text-xs text-white shadow-lg shadow-red-600/30 hover:scale-105 transition-all disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {savingPassword ? "Mengganti..." : "Ganti Password"}
            </button>
          </form>
        </div>

        {pendingPhoto && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-white shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between border-b border-telkomsat-gray-lighter px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-telkomsat-black">
                    Atur Foto Profil
                  </h2>
                  <p className="text-sm text-telkomsat-gray">
                    Hasil upload akan dipotong menjadi kotak.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePhotoEditor}
                  disabled={uploadingPhoto}
                  className="rounded-lg p-2 text-telkomsat-gray transition hover:bg-telkomsat-gray-lighter"
                  aria-label="Tutup editor foto"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div
                  ref={photoEditorRef}
                  className="mx-auto aspect-square w-full max-w-xs cursor-grab touch-none select-none overflow-hidden rounded-full border-4 border-white bg-telkomsat-gray-lighter shadow-inner ring-1 ring-telkomsat-gray-lighter active:cursor-grabbing"
                  onPointerDown={handlePhotoPointerDown}
                  onPointerMove={handlePhotoPointerMove}
                  onPointerUp={stopPhotoDrag}
                  onPointerCancel={stopPhotoDrag}
                  onWheel={handlePhotoWheel}
                  onTouchStart={handlePhotoTouchStart}
                  onTouchMove={handlePhotoTouchMove}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingPhoto.previewUrl}
                    alt="Preview foto profil"
                    draggable={false}
                    className="h-full w-full pointer-events-none object-cover"
                    style={{
                      transform: `translate(${photoOffsetX}%, ${photoOffsetY}%) scale(${photoZoom})`,
                    }}
                  />
                </div>
                <p className="text-center text-xs text-telkomsat-gray">
                  Drag foto untuk menggeser, scroll untuk zoom, atau pinch dua jari di layar sentuh.
                </p>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-telkomsat-black">
                      Zoom
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={photoZoom}
                      onChange={(e) => setPhotoZoom(Number(e.target.value))}
                      className="w-full accent-telkomsat-red"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-telkomsat-black">
                      Geser horizontal
                    </span>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={photoOffsetX}
                      onChange={(e) => setPhotoOffsetX(Number(e.target.value))}
                      className="w-full accent-telkomsat-red"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-telkomsat-black">
                      Geser vertikal
                    </span>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={photoOffsetY}
                      onChange={(e) => setPhotoOffsetY(Number(e.target.value))}
                      className="w-full accent-telkomsat-red"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-telkomsat-gray-lighter px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closePhotoEditor}
                  disabled={uploadingPhoto}
                  className="rounded-xl border border-telkomsat-gray-lighter px-4 py-2.5 font-semibold text-telkomsat-black hover:bg-telkomsat-gray-lighter disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhotoUpload}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-telkomsat-red px-5 py-2.5 font-semibold text-white hover:bg-telkomsat-red-dark disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="h-4 w-4" />
                  )}
                  {uploadingPhoto ? "Mengunggah..." : "Simpan Foto"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
