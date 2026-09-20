"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAuthLoading } from "@/components/AuthProvider";
import { logout } from "@/lib/firebase/auth";
import { canAccessPath, getDefaultPath } from "@/lib/rbac";
import { USER_ROLE_LABELS, User, UserRole } from "@/types";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  FileText,
  LogOut,
  FileSpreadsheet,
  ChevronRight,
  Users,
  ClipboardCheck,
  MapPin,
  QrCode,
  ShoppingCart,
  Settings,
  History,
  Activity,
  UserRound,
  Bell,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import UserAvatar from "@/components/UserAvatar";
import MobileBottomNav, { NavItem } from "@/components/layout/MobileBottomNav";
import PortalBrand from "@/components/PortalBrand";

interface AdminLayoutProps {
  children: React.ReactNode;
}

// ─── ProfileDropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full transition-all duration-300 ${
          open ? "scale-105 ring-4 ring-telkomsat-red/15" : "hover:scale-105"
        }`}
        aria-label="Menu profil"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={user.nama} src={user.fotoProfilUrl} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-[80] w-64 origin-top-right overflow-hidden rounded-xl border border-telkomsat-gray-lighter bg-white shadow-2xl animate-scale-in"
        >
          {/* User info header */}
          <div className="border-b border-telkomsat-gray-lighter px-4 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.nama} src={user.fotoProfilUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-telkomsat-black">{user.nama}</p>
                <p className="truncate text-xs text-telkomsat-gray">{user.email}</p>
              </div>
            </div>
            <span className="mt-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-telkomsat-red">
              {USER_ROLE_LABELS[user.role]}
            </span>
          </div>

          {/* Actions */}
          <div className="p-2">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-telkomsat-black transition hover:bg-telkomsat-gray-lighter/60"
            >
              <Settings className="h-4 w-4 text-telkomsat-red" />
              Setting Profil
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AdminLayout ─────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, clearUser } = useAuthStore();
  const authLoading = useAuthLoading();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Close mobile more drawer on route change (handled inside MobileBottomNav)
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // We show a loading spinner until auth is resolved to prevent FOUC.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (pathname && !canAccessPath(user.role, pathname)) {
      toast.error("Anda tidak memiliki akses ke halaman ini");
      router.push(getDefaultPath(user.role));
    }
  }, [user, router, pathname, authLoading]);

  const handleLogout = async () => {
    try {
      await logout();
      clearUser();
      toast.success("Logout berhasil");
      router.push("/login");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Logout gagal";
      toast.error(message);
    }
  };

  // ── Loading state — shown while auth state is being determined ──────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not authenticated or no path access — render nothing while redirect fires
  if (!user || !pathname || !canAccessPath(user.role, pathname)) {
    return null;
  }

  // ── Build nav items per role ────────────────────────────────────────────────
  const getNavItemsForRole = (role: UserRole): NavItem[] => {
    switch (role) {
      case "admin":
        return [
          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
          { href: "/users", icon: Users, label: "Pengguna", exact: false },
          { href: "/aktivitas", icon: Activity, label: "Aktivitas", exact: false },
          { href: "/profile", icon: UserRound, label: "Profil", exact: true },
        ];
      case "admin_gudang":
        return [
          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
          { href: "/spareparts", icon: Package, label: "Data Sparepart", exact: true },
          { href: "/spareparts/tambah", icon: Package, label: "Tambah Sparepart", exact: true },
          { href: "/scan/gudang", icon: QrCode, label: "QR Code", exact: true },
          { href: "/spareparts/verifikasi", icon: ClipboardCheck, label: "Verifikasi", exact: true },
          { href: "/transaksi", icon: History, label: "Daftar Transaksi", exact: true },
          { href: "/lokasi", icon: MapPin, label: "Lokasi", exact: false },
          { href: "/laporan", icon: FileText, label: "Laporan", exact: false },
          { href: "/profile", icon: UserRound, label: "Profil", exact: true },
        ];
      case "teknisi":
        return [
          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
          { href: "/scan", icon: QrCode, label: "Scan QR", exact: true },
          { href: "/transaksi/keranjang", icon: ShoppingCart, label: "Pengajuan Saya", exact: true },
          { href: "/transaksi", icon: History, label: "Daftar Transaksi", exact: true },
          { href: "/profile", icon: UserRound, label: "Profil", exact: true },
        ];
      case "supervisor":
        return [
          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
          { href: "/transaksi", icon: History, label: "Daftar Transaksi", exact: true },
          { href: "/laporan", icon: FileText, label: "Laporan", exact: false },
          { href: "/aktivitas", icon: Activity, label: "Aktivitas", exact: false },
          { href: "/profile", icon: UserRound, label: "Profil", exact: true },
        ];
      default:
        return [
          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
          { href: "/profile", icon: UserRound, label: "Profil", exact: true },
        ];
    }
  };

  const navItems = getNavItemsForRole(user.role);

  /** Returns true when the given nav item matches the current pathname. */
  const isNavActive = (item: NavItem): boolean => {
    if (!pathname) return false;
    if (item.exact) return pathname === item.href;
    if (item.excludePaths?.some((p) => pathname.startsWith(p))) return false;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <div className="portal-theme min-h-screen relative overflow-hidden bg-[#0d0f12] text-white selection:bg-telkomsat-red selection:text-white">
      {/* ── Animated Background ─────────────────────────────────────────── */}
      <div className="fixed inset-0 animated-gradient-bg -z-10" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div
          className="absolute w-96 h-96 rounded-full opacity-10"
          style={{
            background: "linear-gradient(135deg, #E31E24 0%, #ff6b6b 100%)",
            top: "-10%",
            right: "-10%",
            animation: "float 15s ease-in-out infinite",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute w-64 h-64 rounded-full opacity-15"
          style={{
            background: "linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)",
            bottom: "-5%",
            left: "20%",
            animation: "floatReverse 18s ease-in-out infinite",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* ── Desktop top-right controls ──────────────────────────────────── */}
      <div className="hidden lg:flex fixed top-5 right-6 z-50 items-center gap-3">
        <NotificationBell user={user} />
        <ProfileDropdown user={user} onLogout={handleLogout} />
      </div>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#101216]/95 px-4 py-3 flex items-center justify-between shadow-xl backdrop-blur-2xl">
        <PortalBrand size="sm" />
        <div className="flex items-center gap-2">
          <NotificationBell user={user} />
          <ProfileDropdown user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-72 border-r border-white/10 bg-[#101216]/95 shadow-[18px_0_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="flex flex-col h-full w-full">
          {/* Sidebar header */}
          <div className="relative border-b border-white/10 px-5 pb-5 pt-6">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#f42f28] via-[#e92329] to-[#606164]" />
            <PortalBrand />
            <div className="mt-4 flex items-center justify-between px-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Inventory Control</p>
                <p className="mt-1 text-xs font-medium text-gray-400">QR Sparepart Management</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <nav
            className="flex-1 overflow-y-auto px-4 py-5"
            aria-label="Sidebar navigation"
          >
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Menu Utama</p>
            <div className="space-y-1.5">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = isNavActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-xl px-3 py-3 transition-all duration-200 ${
                    isActive
                      ? "border border-telkomsat-red/25 bg-telkomsat-red/10 text-white shadow-[0_8px_24px_rgba(227,30,36,0.10)]"
                      : "border border-transparent text-gray-400 hover:border-white/5 hover:bg-white/[0.045] hover:text-white"
                  }${mounted ? " animate-slide-in-left" : ""}`}
                  style={mounted ? { animationDelay: `${index * 0.05}s` } : undefined}
                >
                  <div className="flex items-center space-x-3">
                    {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-telkomsat-red" />}
                    <div
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-telkomsat-red text-white shadow-md shadow-telkomsat-red/20"
                          : "bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-transform duration-300 ${
                          isActive ? "" : "group-hover:scale-110"
                        }`}
                      />
                    </div>
                    <span className="font-semibold text-sm">{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4 text-telkomsat-red" />}
                </Link>
              );
            })}
            </div>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
              <p className="text-xs font-semibold text-gray-300">Telkomsat Inventory</p>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Sistem inventaris sparepart berbasis QR Code</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom navigation ────────────────────────────────────── */}
      <MobileBottomNav navItems={navItems} isNavActive={isNavActive} />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="lg:pl-72 pt-16 lg:pt-0">
        <main className="min-h-screen p-4 pb-28 lg:p-8 lg:pt-20">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
