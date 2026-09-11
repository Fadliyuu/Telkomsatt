"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalBrand from "@/components/PortalBrand";
import {
  QrCode,
  Package,
  FileText,
  Shield,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Truck,
  ScanLine,
  Building2,
  ChevronRight,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Users,
  Activity,
  ArrowUpRight,
} from "lucide-react";

const features = [
  {
    icon: QrCode,
    badge: "Teknologi QR",
    title: "Presisi & Multi-Scan QR",
    description:
      "Identifikasi cepat unit fisik sparepart via Serial Number & Tagging dengan scanner kamera internal tanpa alat tambahan.",
  },
  {
    icon: ClipboardCheck,
    badge: "Approval Atomik",
    title: "Verifikasi Admin Gudang",
    description:
      "Stok & lokasi barang tidak dapat berubah tanpa persetujuan Admin Gudang melalui transaksi atomik anti race-condition.",
  },
  {
    icon: FileText,
    badge: "Administrasi Resmi",
    title: "Surat Jalan & Berita Acara",
    description:
      "Generasi dokumen otomatis PDF Surat Jalan dan Berita Acara Maintenance (PM/CM) lengkap dengan nomor seri resmi.",
  },
  {
    icon: BarChart3,
    badge: "Monitoring",
    title: "Laporan Real-Time & Audit",
    description:
      "Pantau statistik pergerakan barang masuk/keluar, posisi unit fisik di lokasi/site, dan log aktivitas pengguna secara akurat.",
  },
  {
    icon: Layers,
    badge: "Keamanan Stok",
    title: "Item Reservation Lock",
    description:
      "Mencegah dua teknisi mengajukan unit barang fisik yang sama secara bersamaan dengan sistem kunci reservasi Firestore.",
  },
  {
    icon: Shield,
    badge: "Strict RBAC",
    title: "Tanggung Jawab 4 Role",
    description:
      "Pemisahan hak akses tegas antara Admin Sistem, Admin Gudang, Teknisi, dan Supervisor sesuai wewenang masing-masing.",
  },
];

const roles = [
  {
    role: "Admin Gudang",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
    desc: "Memegang kendali penuh verifikasi transaksi, kelola master sparepart, multi-scan gudang, pencetakan QR Code, Surat Jalan, & BA.",
  },
  {
    role: "Teknisi",
    color: "from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-400",
    desc: "Memindai QR Code barang di lapangan, melengkapi Surat Perintah Tugas (SPT), dan membuat keranjang pengajuan transaksi.",
  },
  {
    role: "Supervisor",
    color: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30 text-indigo-400",
    desc: "Memantau dashboard utama, laporan pergerakan barang, dan audit trail secara read-only tanpa kewenangan persetujuan.",
  },
  {
    role: "Admin Sistem",
    color: "from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-400",
    desc: "Mengelola akun pengguna, status keaktifan, reset kata sandi, dan keamanan sistem tanpa mencampuri transaksi inventaris.",
  },
];

const steps = [
  {
    num: "01",
    title: "Scan & Masukkan Keranjang",
    text: "Teknisi memindai QR Code barang fisik di lapangan dan memasukkannya ke keranjang pengajuan.",
  },
  {
    num: "02",
    title: "Lengkapi SPT & Tujuan",
    text: "Teknisi mengisi Nomor SPT (Surat Perintah Tugas) dan lokasi tujuan pengiriman sebelum mengajukan.",
  },
  {
    num: "03",
    title: "Verifikasi Admin Gudang",
    text: "Pengajuan berstatus Pending dan dikunci (Item Lock). Admin Gudang menyetujui atau menolak dengan alasan.",
  },
  {
    num: "04",
    title: "Eksekusi Atomik & PDF",
    text: "Stok dan lokasi barang fisik ter-update secara otomatis, disertai unduhan dokumen resmi Surat Jalan & BA.",
  },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white selection:bg-telkomsat-red selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Dynamic Ambient Lights */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-telkomsat-red/15 blur-[140px] animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="absolute -bottom-40 right-1/3 w-[550px] h-[550px] rounded-full bg-orange-600/10 blur-[140px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0f12]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-transform duration-300 hover:scale-[1.02]">
            <PortalBrand size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#fitur" className="hover:text-telkomsat-red transition-colors">
              Fitur Unggulan
            </a>
            <a href="#alur" className="hover:text-telkomsat-red transition-colors">
              Alur Kerja
            </a>
            <a href="#role" className="hover:text-telkomsat-red transition-colors">
              Kewenangan Role
            </a>
          </nav>

          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="relative inline-flex items-center gap-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-red-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              <span>Masuk Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-12 pb-20 lg:pt-20 lg:pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div
            className={`grid lg:grid-cols-12 gap-12 items-center transition-all duration-1000 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-telkomsat-red bg-telkomsat-red/10 border border-telkomsat-red/20 rounded-full px-4 py-2 backdrop-blur-md">
                <Building2 className="w-4 h-4" />
                <span>Telkomsat Regional 6 · Gudang Digital</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight">
                Sistem Inventaris <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-telkomsat-red via-red-400 to-orange-400">
                  Sparepart QR Code
                </span>
              </h1>

              <p className="text-lg text-gray-300 leading-relaxed max-w-2xl font-normal">
                Platform manajemen inventaris fisik tingkat regional dengan sistem
                pemindaian QR Code, transaksi berverifikasi Admin Gudang, serta pencetakan otomatis
                Surat Jalan dan Berita Acara Maintenance.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white font-bold text-base px-8 py-4 rounded-xl hover:shadow-2xl hover:shadow-red-600/40 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <ScanLine className="w-5 h-5" />
                  <span>Buka Portal Login</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <a
                  href="#fitur"
                  className="inline-flex items-center justify-center gap-2 border border-white/15 bg-white/5 backdrop-blur-md text-white font-semibold text-base px-8 py-4 rounded-xl hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                >
                  <span>Pelajari Fitur</span>
                </a>
              </div>

              {/* Trust Features */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/10 text-gray-400 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Verifikasi Gudang</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Item Reservasi Lock</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Dokumen Resmi PDF</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Mockup / Hero Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-2xl p-6 lg:p-8 shadow-2xl shadow-black/80 space-y-6">
                {/* Header Mockup */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-telkomsat-red/20 border border-telkomsat-red/30 rounded-2xl">
                      <QrCode className="w-6 h-6 text-telkomsat-red" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">QR Code Scanner</h3>
                      <p className="text-xs text-gray-400">Regional 6 Inventory Control</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
                    Live System
                  </span>
                </div>

                {/* Mock Card Items */}
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">ODF 24 Core Rackmount</p>
                        <p className="text-xs text-gray-400 font-mono">SN: TEL-ODF-2026-081</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                      Pindah Lokasi
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">Nomor SPT Wajib</p>
                        <p className="text-xs text-gray-400 font-mono">SPT/2026/08/001</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                      Tervalidasi
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-500/20 rounded-xl text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">Approval Admin Gudang</p>
                        <p className="text-xs text-gray-400">Verifikasi Atomik Firestore</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
                      Disetujui
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-xs text-gray-400">
                    Akses aman berbasis Peran Pengguna (RBAC)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="relative z-10 py-24 bg-[#11141a] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-telkomsat-red bg-telkomsat-red/10 border border-telkomsat-red/20 px-4 py-1.5 rounded-full">
              Arsitektur Sistem
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Fitur Utama Inventaris Digital
            </h2>
            <p className="text-gray-400 text-base">
              Dirancang khusus untuk mendukung operasional lapangan dan akuntabilitas gudang Telkomsat Regional 6.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-telkomsat-red/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <f.icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-telkomsat-red transition-colors">
                    {f.title}
                  </h3>

                  <p className="text-sm text-gray-400 leading-relaxed font-normal">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Process Steps */}
      <section id="alur" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full">
              Tahapan Transaksi
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Alur Kerja Pengajuan & Approval
            </h2>
            <p className="text-gray-400 text-base">
              Proses pertanggungjawaban barang dari scan lapangan hingga persetujuan verifikator.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div
                key={s.num}
                className="relative p-8 rounded-3xl border border-white/10 bg-white/5 space-y-4"
              >
                <span className="text-5xl font-black text-telkomsat-red/20 absolute top-4 right-6">
                  {s.num}
                </span>
                <h3 className="text-lg font-bold text-white pr-8">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-normal">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section id="role" className="relative z-10 py-24 bg-[#08090c] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full">
              Kewenangan Pengguna
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Struktur Akses 4 Role
            </h2>
            <p className="text-gray-400 text-base">
              Setiap pengguna beroperasi sesuai kewenangan tegas tanpa tumpang tindih fungsi.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((r) => (
              <div
                key={r.role}
                className={`p-6 rounded-3xl border bg-gradient-to-b ${r.color} backdrop-blur-md space-y-3`}
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <h3 className="font-bold text-lg text-white">{r.role}</h3>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed font-normal">
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative rounded-3xl border border-telkomsat-red/30 bg-gradient-to-r from-telkomsat-red/20 via-red-950/40 to-black p-10 lg:p-16 text-center space-y-8 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-telkomsat-red/20 rounded-full blur-3xl pointer-events-none" />

            <h2 className="text-3xl sm:text-4xl font-black text-white max-w-2xl mx-auto">
              Siap Mengakses Sistem Inventaris Telkomsat Regional 6?
            </h2>

            <p className="text-gray-300 max-w-xl mx-auto text-base">
              Gunakan kredensial akun resmi Anda untuk mengelola inventaris, memindai QR Code, dan meninjau dokumen transaksi.
            </p>

            <div>
              <Link
                href="/login"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white font-bold text-lg px-10 py-4 rounded-xl hover:shadow-2xl hover:shadow-red-600/50 transition-all duration-300 transform hover:-translate-y-1"
              >
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#08090c] py-12 text-sm text-gray-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <PortalBrand size="sm" />
            <div className="border-l border-white/10 pl-4">
              <p className="font-bold text-white">Telkomsat Regional 6</p>
              <p className="text-xs text-gray-400">Sistem Inventaris Sparepart QR Code</p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs font-semibold">
            <a href="#fitur" className="hover:text-telkomsat-red transition-colors">
              Fitur
            </a>
            <a href="#alur" className="hover:text-telkomsat-red transition-colors">
              Alur Kerja
            </a>
            <a href="#role" className="hover:text-telkomsat-red transition-colors">
              Role Access
            </a>
            <Link href="/login" className="text-telkomsat-red hover:underline font-bold">
              Portal Login ➔
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t border-white/5 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Telkomsat Regional 6. Hak cipta dilindungi undang-undang.
        </div>
      </footer>
    </div>
  );
}
