"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ErrorState from "@/components/ErrorState";
import UserAvatar from "@/components/UserAvatar";
import { getUsers, deleteUser, toggleUserStatus } from "@/lib/firebase/users";
import { User, USER_ROLE_LABELS, USER_ROLE_COLORS, USER_ROLES, UserRole } from "@/types";
import toast from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Users,
  Shield,
  Briefcase,
  Wrench,
  ClipboardCheck,
  Warehouse,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null);
  const router = useRouter();
  const manageableRoles = USER_ROLES;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getUsers();
      setUsers(data);
    } catch (error: unknown) {
      setError("Gagal memuat data pengguna.");
      toast.error("Gagal memuat data pengguna");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    try {
      await deleteUser(id);
      toast.success("Pengguna berhasil dihapus");
      setDeleteTarget(null);
      loadUsers();
    } catch (error: unknown) {
      toast.error("Gagal menghapus pengguna");
      console.error(error);
    }
  };

  const handleToggleStatus = async (id: string, nama: string) => {
    try {
      await toggleUserStatus(id);
      toast.success(`Status ${nama} berhasil diubah`);
      loadUsers();
    } catch (error: unknown) {
      toast.error("Gagal mengubah status");
      console.error(error);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.divisi && user.divisi.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filterRole === "all" || user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case "direktur":
        return Shield;
      case "manager":
        return Briefcase;
      case "supervisor":
        return ClipboardCheck;
      case "admin_gudang":
        return Warehouse;
      case "admin_keuangan":
        return WalletCards;
      case "teknisi":
        return Wrench;
      default:
        return Users;
    }
  };

  const getRoleColor = (role?: string) =>
    USER_ROLE_COLORS[role as UserRole] || {
      bg: "bg-slate-100",
      text: "text-slate-700",
    };

  const getRoleLabel = (role?: string) =>
    USER_ROLE_LABELS[role as UserRole] ||
    (role
      ? role
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "Role tidak dikenal");

  const stats = {
    total: users.length,
    aktif: users.filter((u) => u.status === "aktif").length,
  };
  const roleStats = manageableRoles.map((role) => ({
    role,
    total: users.filter((u) => u.role === role).length,
    Icon: getRoleIcon(role),
  }));

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-in-left">
          <div>
            <h1 className="text-4xl font-bold text-telkomsat-black mb-2">
              Manajemen Pengguna
            </h1>
            <p className="text-telkomsat-gray text-lg">
              Kelola akun direktur, manager, supervisor, admin gudang, admin keuangan, dan teknisi
            </p>
          </div>
          <Link
            href="/users/tambah"
            className="group flex items-center space-x-2 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Pengguna</span>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-telkomsat-black">{stats.total}</p>
                <p className="text-xs text-telkomsat-gray">Total</p>
              </div>
            </div>
          </div>

          {roleStats.map(({ role, total, Icon }, index) => (
            <div
              key={role}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
              style={{ animationDelay: `${0.15 + index * 0.05}s` }}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark rounded-lg">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-telkomsat-black">{total}</p>
                  <p className="text-xs text-telkomsat-gray">{USER_ROLE_LABELS[role]}</p>
                </div>
              </div>
            </div>
          ))}

          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-telkomsat-gray-lighter hover-lift animate-scale-in"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-telkomsat-black">{stats.aktif}</p>
                <p className="text-xs text-telkomsat-gray">Aktif</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-telkomsat-gray-lighter animate-slide-in-right"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-telkomsat-gray w-5 h-5" />
              <input
                type="text"
                placeholder="Cari pengguna (nama, email, divisi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | "all")}
              className="px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white min-w-[180px]"
            >
              <option value="all">Semua Role</option>
              {manageableRoles.map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-12 text-center border border-telkomsat-gray-lighter">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-telkomsat-red border-t-transparent rounded-full animate-spin"></div>
              <p className="text-telkomsat-gray">Memuat data...</p>
            </div>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadUsers} />
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-12 text-center border border-telkomsat-gray-lighter animate-fade-in">
            <Users className="w-16 h-16 text-telkomsat-gray mx-auto mb-4 opacity-50" />
            <p className="text-telkomsat-black font-semibold text-lg">
              {searchQuery || filterRole !== "all"
                ? "Tidak ada pengguna yang ditemukan"
                : "Belum ada pengguna"}
            </p>
            {!searchQuery && filterRole === "all" && (
              <Link
                href="/users/tambah"
                className="inline-flex items-center space-x-2 mt-4 text-telkomsat-red hover:text-telkomsat-red-dark font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Tambah Pengguna Pertama</span>
              </Link>
            )}
          </div>
        ) : (
          <div
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-telkomsat-gray-lighter overflow-hidden animate-scale-in"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-telkomsat-red/5 to-transparent border-b border-telkomsat-gray-lighter">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-telkomsat-black uppercase tracking-wider">
                      Pengguna
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-telkomsat-black uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-telkomsat-black uppercase tracking-wider">
                      Divisi
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-telkomsat-black uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-telkomsat-black uppercase tracking-wider">
                      Bergabung
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-telkomsat-black uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-telkomsat-gray-lighter">
                  {filteredUsers.map((user, index) => {
                    const RoleIcon = getRoleIcon(user.role);
                    const roleColor = getRoleColor(user.role);

                    return (
                      <tr
                        key={user.id}
                        className="transition-all duration-200 hover:bg-telkomsat-gray-lighter/50"
                        style={{
                          animation: `fadeIn 0.3s ease-out ${index * 0.05}s forwards`,
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <UserAvatar name={user.nama} src={user.fotoProfilUrl} size="md" />
                            <div>
                              <p className="font-semibold text-telkomsat-black">
                                {user.nama}
                              </p>
                              <p className="text-sm text-telkomsat-gray">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${roleColor.bg} ${roleColor.text} border`}
                          >
                            <RoleIcon className="w-3.5 h-3.5" />
                            <span>{getRoleLabel(user.role)}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-telkomsat-gray">
                          {user.divisi || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(user.id, user.nama)}
                            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 ${
                              user.status === "aktif"
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : "bg-red-100 text-red-700 border border-red-200"
                            }`}
                          >
                            {user.status === "aktif" ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                            <span>{user.status === "aktif" ? "Aktif" : "Nonaktif"}</span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-telkomsat-gray">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/users/${user.id}/edit`}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300 hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => setDeleteTarget({ id: user.id, nama: user.nama })}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300 hover:scale-110"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-telkomsat-gray-lighter bg-white p-6 shadow-2xl">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-telkomsat-black">
                  Hapus Pengguna
                </h2>
                <p className="mt-2 text-sm text-telkomsat-gray">
                  Pengguna "{deleteTarget.nama}" akan dihapus dari Firebase Auth dan Firestore.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-telkomsat-gray-lighter px-4 py-2.5 font-semibold text-telkomsat-black hover:bg-telkomsat-gray-lighter"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteTarget.id, deleteTarget.nama)}
                  className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
