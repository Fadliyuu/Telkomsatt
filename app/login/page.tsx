"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PortalBrand from "@/components/PortalBrand";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LogIn,
  Mail,
  Lock,
  ShieldCheck,
  Building2,
  QrCode,
  PackageCheck,
  ClipboardCheck,
} from "lucide-react";
import { login, requestPasswordReset } from "@/lib/firebase/auth";
import { getAccessiblePath, getDefaultPath } from "@/lib/rbac";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAuthLoading } from "@/components/AuthProvider";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, user, clearUser } = useAuthStore();
  const authLoading = useAuthLoading();

  useEffect(() => {
    setMounted(true);
    if (authLoading) return;
    const nextPath = searchParams.get("next");
    if (user) {
      const defaultPath = getDefaultPath(user.role);
      const dest = getAccessiblePath(user.role, nextPath) || defaultPath;
      if (dest && dest !== "/login") {
        window.location.replace(dest);
      } else {
        clearUser();
      }
    }
  }, [user, authLoading, searchParams, clearUser]);

  useEffect(() => {
    if (searchParams.get("resetPassword") === "success") {
      toast.success("Password berhasil diubah. Silakan masuk dengan password baru.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userData = await login(email, password);
      setUser(userData);

      toast.success(`Selamat datang, ${userData.nama}!`);

      const nextPath = searchParams.get("next");
      const targetPath = getAccessiblePath(userData.role, nextPath) || getDefaultPath(userData.role);
      
      if (targetPath && targetPath !== "/login") {
        window.location.replace(targetPath);
      } else {
        toast.error("Role pengguna tidak memiliki hak akses halaman utama.");
        clearUser();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login gagal";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!email.trim()) {
      toast.error("Isi email terlebih dahulu");
      return;
    }

    setResetLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
      toast.success("Link reset password sudah dikirim ke email");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengirim reset password";
      toast.error(message);
    } finally {
      setResetLoading(false);
    }
  };

  const enterResetMode = () => {
    setResetMode(true);
    setResetSent(false);
  };

  const leaveResetMode = () => {
    setResetMode(false);
    setResetSent(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0c0f] text-white selection:bg-telkomsat-red selection:text-white font-sans antialiased flex items-center justify-center p-4">
      {/* Ambient Glowing Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full bg-telkomsat-red/20 blur-[130px] animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className="relative z-10 my-8 grid w-full max-w-6xl items-center gap-10 lg:grid-cols-12">
        <aside className={`hidden transition-all duration-700 lg:col-span-7 lg:block ${mounted ? "translate-x-0 opacity-100" : "-translate-x-5 opacity-0"}`}>
          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2 text-xs font-bold text-emerald-300">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              Sistem inventaris aktif
            </div>
            <h2 className="text-4xl font-black leading-[1.12] tracking-tight xl:text-5xl">
              Kendali inventaris fisik,
              <span className="mt-2 block bg-gradient-to-r from-[#f42f28] via-red-400 to-orange-400 bg-clip-text text-transparent">dalam satu portal.</span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-gray-400">Pantau unit sparepart, proses pengajuan, dan verifikasi perpindahan barang secara akurat untuk operasional Telkomsat Regional 6.</p>
            <div className="mt-9 grid grid-cols-3 gap-3">
              {[
                { icon: QrCode, label: "QR Tracking", text: "Identifikasi unit" },
                { icon: PackageCheck, label: "Stok Fisik", text: "Status real-time" },
                { icon: ClipboardCheck, label: "Verifikasi", text: "Alur terkontrol" },
              ].map((item) => (
                <div key={item.label} className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-telkomsat-red/30 hover:bg-white/[0.07]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-telkomsat-red/20 bg-telkomsat-red/10 text-telkomsat-red transition-colors group-hover:bg-telkomsat-red group-hover:text-white"><item.icon className="h-5 w-5" /></div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4 border-t border-white/10 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"><ShieldCheck className="h-5 w-5 text-emerald-400" /></div>
              <div><p className="text-sm font-semibold text-gray-200">Akses aman berbasis peran</p><p className="mt-0.5 text-xs text-gray-500">Admin Sistem · Admin Gudang · Teknisi · Supervisor</p></div>
            </div>
          </div>
        </aside>

        <div className="w-full max-w-md justify-self-center lg:col-span-5 lg:max-w-none">
        {/* Main Glass Card */}
        <div
          className="relative space-y-8 overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl animate-fade-in lg:p-10"
        >
          {/* Logo Showcase with White Glass Badge */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <PortalBrand size="lg" centered />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-telkomsat-red bg-telkomsat-red/10 border border-telkomsat-red/20 rounded-full px-3 py-1 mb-2">
                <Building2 className="w-3.5 h-3.5" />
                <span>Telkomsat Regional 6</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {resetMode ? "Reset Kata Sandi" : "Portal Inventaris QR Code"}
              </h1>
              <p className="text-xs text-gray-300 mt-1">
                {resetMode
                  ? "Masukkan email terdaftar untuk menerima petunjuk pemulihan akun."
                  : "Silakan masuk dengan akun resmi terverifikasi."}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={resetMode ? handlePasswordReset : handleLogin} className="space-y-5">
            {resetMode && resetSent && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                <p>
                  Link pemulihan password telah dikirim ke email Anda. Periksa folder Inbox atau Spam.
                </p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                Email Pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setResetSent(false);
                  }}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/15 rounded-xl focus:border-telkomsat-red focus:bg-white/15 outline-none transition-all text-sm text-white placeholder:text-gray-400 font-medium"
                  placeholder="user@telkomsat.com"
                />
              </div>
            </div>

            {/* Password Field */}
            {!resetMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={enterResetMode}
                    disabled={loading}
                    className="text-xs font-semibold text-telkomsat-red hover:underline disabled:opacity-50"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/15 rounded-xl focus:border-telkomsat-red focus:bg-white/15 outline-none transition-all text-sm text-white placeholder:text-gray-400 font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || resetLoading}
              className="w-full bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-lg hover:shadow-red-600/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {loading || resetLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{resetMode ? "Mengirim link..." : "Memproses..."}</span>
                </>
              ) : (
                <>
                  {resetMode ? (
                    <KeyRound className="w-4 h-4" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>{resetMode ? "Kirim Link Pemulihan" : "Masuk ke Sistem"}</span>
                </>
              )}
            </button>

            {resetMode && (
              <button
                type="button"
                onClick={leaveResetMode}
                className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Halaman Login</span>
              </button>
            )}
          </form>

          {/* Footer Card Navigation */}
          <div className="pt-4 border-t border-white/10 text-center space-y-3 text-xs text-gray-400">
            <p className="flex items-center justify-center gap-1.5 text-gray-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span>Akses Terenkripsi & Verifikasi Role</span>
            </p>
            <div>
              <Link href="/" className="text-telkomsat-red hover:underline font-bold">
                ← Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">
          © {new Date().getFullYear()} Telkomsat Regional 6. Hak Cipta Dilindungi.
        </p>
      </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
