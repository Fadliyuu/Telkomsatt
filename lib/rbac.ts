import { UserRole } from "@/types";

export type AppPermission =
  | "dashboard"
  | "laporan"
  | "approval_permintaan"
  | "validasi_pekerjaan"
  | "kelola_sparepart"
  | "stok"
  | "qr"
  | "barang_masuk_keluar"
  | "laporan_pengadaan"
  | "kebutuhan_sparepart"
  | "scan_qr"
  | "upload_foto_sn_tagging"
  | "update_status_pekerjaan"
  | "user_management"
  | "aktivitas";

export const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  admin: ["dashboard", "user_management", "aktivitas"],
  admin_gudang: [
    "dashboard",
    "kelola_sparepart",
    "stok",
    "qr",
    "barang_masuk_keluar",
    "approval_permintaan",
    "laporan",
    "scan_qr",
    "aktivitas",
  ],
  teknisi: ["dashboard", "scan_qr"],
  supervisor: ["dashboard", "laporan", "aktivitas"],
  // Legacy roles (disabled)
  direktur: ["dashboard", "laporan", "aktivitas"],
  manager: ["dashboard", "laporan", "aktivitas"],
  admin_keuangan: ["dashboard", "laporan", "aktivitas"],
};

const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  admin: [
    "/dashboard",
    "/users",
    "/aktivitas",
    "/profile",
    "/notifikasi",
  ],
  admin_gudang: [
    "/dashboard",
    "/spareparts",
    "/item",
    "/scan/gudang",
    "/lokasi",
    "/laporan",
    "/aktivitas",
    "/profile",
    "/notifikasi",
    "/transaksi",
    "/spareparts/verifikasi",
    "/spareparts/tambah",
    "/spareparts/export-import",
  ],
  teknisi: [
    "/dashboard",
    "/spareparts",
    "/scan",
    "/item",
    "/transaksi/keranjang",
    "/transaksi",
    "/teknisi",
    "/profile",
    "/notifikasi",
  ],
  supervisor: [
    "/dashboard",
    "/laporan",
    "/aktivitas",
    "/profile",
    "/notifikasi",
    "/spareparts",
    "/item",
    "/transaksi",
  ],
  // Legacy roles fallback
  direktur: ["/dashboard", "/laporan", "/aktivitas", "/profile", "/notifikasi"],
  manager: ["/dashboard", "/laporan", "/aktivitas", "/profile", "/notifikasi"],
  admin_keuangan: ["/dashboard", "/laporan", "/aktivitas", "/profile", "/notifikasi"],
};

export const DEFAULT_ROLE_PATH: Record<UserRole, string> = {
  admin: "/dashboard",
  admin_gudang: "/dashboard",
  teknisi: "/dashboard",
  supervisor: "/dashboard",
  direktur: "/dashboard",
  manager: "/dashboard",
  admin_keuangan: "/dashboard",
};

/** Path khusus Admin Gudang di bawah /spareparts */
const SPAREPARTS_GUDANG_ONLY = [
  "/spareparts/tambah",
  "/spareparts/export-import",
  "/spareparts/import-foto",
  "/spareparts/verifikasi",
];

export function isSparepartsAdminOnlyPath(pathname: string): boolean {
  return SPAREPARTS_GUDANG_ONLY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname === "/transaksi/keranjang" || pathname.startsWith("/transaksi/keranjang/")) {
    return role === "teknisi";
  }
  // 1. Path khusus user management (Admin Sistem)
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return role === "admin";
  }

  // 2. Scan teknisi
  if (pathname === "/scan" || pathname.startsWith("/scan/teknisi")) {
    return role === "teknisi";
  }

  // 3. Scan gudang & Verifikasi -> Khusus Admin Gudang
  if (pathname === "/scan/gudang" || pathname.startsWith("/scan/gudang/")) {
    return role === "admin_gudang";
  }

  if (pathname === "/spareparts/verifikasi" || pathname.startsWith("/spareparts/verifikasi/")) {
    return role === "admin_gudang";
  }

  // 4. Spareparts edit / tambah / import -> Khusus Admin Gudang
  if (role !== "admin_gudang" && isSparepartsAdminOnlyPath(pathname)) {
    return false;
  }
  if (role !== "admin_gudang" && pathname.match(/^\/spareparts\/[^/]+\/edit$/)) {
    return false;
  }

  const allowedPaths = ROLE_ALLOWED_PATHS[role] ?? [];

  return allowedPaths.some((allowedPath) => {
    return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
  });
}

export function canUsePermission(role: UserRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getDefaultPath(role: UserRole): string {
  return DEFAULT_ROLE_PATH[role] ?? "/login";
}

/** Resolve internal navigation without sending a role to an unavailable page. */
export function getAccessiblePath(role: UserRole, path?: string | null): string | undefined {
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) return undefined;
  try {
    const url = new URL(path, "https://app.local");
    if (url.origin !== "https://app.local") return undefined;
    const pathname = decodeURIComponent(url.pathname);
    if (canAccessPath(role, pathname)) return `${url.pathname}${url.search}${url.hash}`;
    if (role === "supervisor" && pathname === "/spareparts/verifikasi") {
      return "/transaksi?status=pending";
    }
  } catch {
    return undefined;
  }
  return undefined;
}
