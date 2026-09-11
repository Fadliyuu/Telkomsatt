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
    return <span className="text-telkomsat-gray">—</span>;
  }

  return (
    <span className="text-sm text-telkomsat-gray line-clamp-2" title={parts.join(" · ")}>
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

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] p-3 lg:p-4 animate-fade-in flex items-center justify-center">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-detail-title"
      >
        <div className="p-6 border-b border-telkomsat-gray-lighter flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <h2
              id="group-detail-title"
              className="text-2xl font-bold text-telkomsat-black"
            >
              {group.namaPerangkat}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(group.status)}`}
              >
                {group.status}
              </span>
              {group.kategori && (
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-telkomsat-gray-lighter text-telkomsat-black">
                  {group.kategori}
                </span>
              )}
              <span className="text-sm text-telkomsat-gray">
                {group.jumlah} unit · Lokasi: {group.lokasiDisplay}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors flex-shrink-0"
            aria-label="Tutup"
          >
            <X className="w-6 h-6 text-telkomsat-gray" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-telkomsat-gray-lighter/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Serial Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Tagging
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Lokasi
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Tanggal Masuk
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Kondisi
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-telkomsat-gray-lighter">
              {group.items.map((item) => (
                <tr key={item.id} className="hover:bg-telkomsat-gray-lighter/40">
                  <td className="px-4 py-3 font-mono text-sm text-telkomsat-black">
                    <div className="flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-telkomsat-gray flex-shrink-0" />
                      {item.serialNumber || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-telkomsat-gray">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.tagging || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-telkomsat-gray">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.lokasiSaatIni || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-telkomsat-gray whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.createdAt ? formatDate(item.createdAt) : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
                        item.status || "Tersedia"
                      )}`}
                    >
                      {item.status || "Tersedia"}
                    </span>
                    {item.perluVerifikasi && (
                      <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                        Verifikasi
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <KondisiCell item={item} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/item/${item.id}`}
                        className="p-2 text-telkomsat-red hover:bg-telkomsat-red/10 rounded-lg transition-colors"
                        title="Lihat QR & detail"
                      >
                        <QrCode className="w-4 h-4" />
                      </Link>
                      <a
                        href={generateQRCodeUrl(item.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Buka URL QR"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {!readOnly && (
                        <>
                          <Link
                            href={`/spareparts/${item.id}/edit`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        <div className="p-4 border-t border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border-2 border-telkomsat-gray-lighter rounded-xl font-semibold hover:bg-white transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
