"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SparepartItemGroup, getStatusBadgeClass } from "@/lib/utils/sparepartGroups";
import { SparepartItem } from "@/types";
import { formatDate, generateQRCodeUrl } from "@/lib/utils";
import {
  X,
  QrCode,
  Edit,
  Trash2,
  MapPin,
  Hash,
  Tag,
  ExternalLink,
  Calendar,
} from "lucide-react";
import Link from "next/link";

interface SparepartGroupDetailModalProps {
  group: SparepartItemGroup | null;
  onClose: () => void;
  onDeleteItem: (id: string, nama: string) => void;
  readOnly?: boolean;
}

function KondisiCell({ item }: { item: SparepartItem }) {
  const parts: string[] = [];
  if (item.cariFisik) parts.push(`Cari fisik: ${item.cariFisik}`);
  if (item.keterangan) parts.push(item.keterangan);

  if (parts.length === 0) {
    return <span className="text-gray-500">—</span>;
  }

  return (
    <span className="text-sm text-gray-300 line-clamp-2" title={parts.join(" · ")}>
      {parts.join(" · ")}
    </span>
  );
}

export default function SparepartGroupDetailModal({
  group,
  onClose,
  onDeleteItem,
  readOnly = false,
}: SparepartGroupDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!group || !mounted) return null;

  const formatLokasi = (lokasi?: string) => {
    if (!lokasi) return "—";
    if (lokasi.toLowerCase().includes("regional 6")) {
      return "Base (Regional 6)";
    }
    return lokasi;
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] p-3 lg:p-4 animate-fade-in flex items-center justify-center">
      <div
        className="bg-[#161922] text-white border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-detail-title"
      >
        <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 flex-shrink-0 bg-white/5">
          <div>
            <h2
              id="group-detail-title"
              className="text-2xl font-extrabold text-white tracking-tight"
            >
              {group.namaPerangkat}
            </h2>
            <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
              <span
                className={`px-3 py-1 text-xs font-bold rounded-lg border ${getStatusBadgeClass(group.status)}`}
              >
                {group.status}
              </span>
              {group.kategori && (
                <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/10 text-gray-200 border border-white/10">
                  {group.kategori}
                </span>
              )}
              <span className="text-sm text-gray-300">
                <strong className="text-white font-bold">{group.jumlah}</strong> unit · Lokasi:{" "}
                <span className="text-gray-200 font-semibold">{formatLokasi(group.lokasiDisplay)}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex-shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead className="bg-white/10 sticky top-0 z-10 border-b border-white/10 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-300">
                  Serial Number
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-300">
                  Tagging
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-300">
                  Lokasi
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-300">
                  Tanggal Masuk
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-300">
                  Status
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-300">
                  Kondisi
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-gray-300">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {group.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-sm font-bold text-white">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{item.serialNumber || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{item.tagging || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{formatLokasi(item.lokasiSaatIni)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{item.createdAt ? formatDate(item.createdAt) : "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusBadgeClass(
                        item.status || "Tersedia"
                      )}`}
                    >
                      {item.status || "Tersedia"}
                    </span>
                    {item.perluVerifikasi && (
                      <span className="ml-1.5 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-md">
                        Verifikasi
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 max-w-[200px]">
                    <KondisiCell item={item} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/item/${item.id}`}
                        className="p-2 text-telkomsat-red hover:bg-telkomsat-red/20 rounded-xl transition-colors"
                        title="Lihat QR & detail"
                      >
                        <QrCode className="w-4 h-4" />
                      </Link>
                      <a
                        href={generateQRCodeUrl(item.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-xl transition-colors"
                        title="Buka URL QR"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {!readOnly && (
                        <>
                          <Link
                            href={`/spareparts/${item.id}/edit`}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors"
                            title="Edit item"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteItem(
                                item.id,
                                item.namaPerangkat || item.serialNumber || "Item"
                              )
                            }
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                            title="Hapus item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl font-bold text-sm text-white transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
