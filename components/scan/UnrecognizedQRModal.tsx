"use client";

import React from "react";
import { AlertTriangle, X, PlusCircle, SkipForward, ShieldCheck, Clock } from "lucide-react";
import type { UserRole } from "@/types";

interface UnrecognizedQRModalProps {
  isOpen: boolean;
  scannedId: string;
  userRole?: UserRole;
  onDismiss: () => void;
  onAddNew: () => void;
}

/**
 * Pop-up yang muncul ketika QR code yang di-scan tidak dikenali di database.
 * Menampilkan opsi "Abaikan" atau "Tambahkan Sebagai Barang Baru".
 *
 * Pesan berbeda berdasarkan role:
 * - admin_gudang / admin: langsung aktif tanpa verifikasi
 * - Role lain: perlu validasi dari Admin Gudang
 */
export default function UnrecognizedQRModal({
  isOpen,
  scannedId,
  userRole,
  onDismiss,
  onAddNew,
}: UnrecognizedQRModalProps) {
  if (!isOpen) return null;

  const isAdmin = userRole === "admin_gudang" || userRole === "admin";
  const truncatedId =
    scannedId.length > 24
      ? `${scannedId.substring(0, 12)}...${scannedId.substring(scannedId.length - 8)}`
      : scannedId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl animate-scale-in w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-telkomsat-gray-lighter">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-telkomsat-black">
                  Data Tidak Dikenali
                </h2>
                <p className="text-telkomsat-gray mt-1 text-sm">
                  QR Code ini tidak terdaftar di sistem
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-telkomsat-gray" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* QR Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">ID yang di-scan:</p>
            <p className="text-sm font-mono font-bold text-telkomsat-black break-all">
              {truncatedId}
            </p>
          </div>

          {/* Role-based message */}
          {isAdmin ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Anda dapat langsung menambahkan item baru
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Sebagai Admin, item yang ditambahkan akan langsung aktif tanpa
                  memerlukan verifikasi tambahan.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Perlu verifikasi Admin Gudang
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Item yang ditambahkan akan berstatus{" "}
                  <span className="font-bold">Menunggu Verifikasi</span> dan
                  memerlukan persetujuan dari Admin Gudang sebelum aktif di
                  sistem.
                </p>
              </div>
            </div>
          )}

          {/* Question */}
          <p className="text-sm text-telkomsat-black text-center font-medium">
            Apa yang ingin Anda lakukan?
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 px-4 py-3 border-2 border-telkomsat-gray-light text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-colors font-semibold flex items-center justify-center space-x-2"
          >
            <SkipForward className="w-4 h-4" />
            <span>Abaikan</span>
          </button>
          <button
            type="button"
            onClick={onAddNew}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white rounded-xl hover:shadow-xl transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tambahkan Barang Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
}

