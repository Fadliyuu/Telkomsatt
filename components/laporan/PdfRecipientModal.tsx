"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { FileSignature, Save, UserRound, X } from "lucide-react";

const STORAGE_KEY = "telkomsat.pdf-recipient";

export interface PdfRecipient {
  name: string;
  position: string;
}

interface PdfRecipientModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (recipient: PdfRecipient) => void;
}

export default function PdfRecipientModal({
  open,
  onClose,
  onConfirm,
}: PdfRecipientModalProps) {
  const [recipient, setRecipient] = useState<PdfRecipient>({
    name: "",
    position: "",
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<PdfRecipient>;
      setRecipient({
        name: parsed.name?.trim() || "",
        position: parsed.position?.trim() || "",
      });
    } catch {
      // Preferensi tanda tangan tidak memengaruhi proses cetak.
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      name: recipient.name.trim(),
      position: recipient.position.trim(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // PDF tetap dapat dibuat jika penyimpanan browser tidak tersedia.
    }
    onConfirm(data);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-recipient-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-black/30 animate-scale-in"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark px-6 py-6 text-white">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 right-14 h-24 w-24 rounded-full border border-white/15" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/15 p-3 shadow-lg">
                <FileSignature className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                  Sebelum cetak
                </p>
                <h2
                  id="pdf-recipient-title"
                  className="mt-1 text-xl font-extrabold"
                >
                  Data tanda tangan PDF
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal"
              className="relative rounded-xl border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm leading-6 text-telkomsat-gray">
            Isi pihak yang menerima atau menyetujui laporan. Data ini akan
            tampil pada kolom{" "}
            <span className="font-semibold text-telkomsat-black">
              Diajukan untuk
            </span>{" "}
            di PDF.
          </p>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-800">
            <div className="flex items-center gap-2 font-bold">
              <Save className="h-4 w-4" /> Diingat di perangkat ini
            </div>
            <p className="mt-1 text-blue-700">
              Isian terakhir akan tersedia otomatis pada cetakan berikutnya dan
              tetap dapat Anda ubah.
            </p>
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-telkomsat-black">
              <UserRound className="h-4 w-4 text-telkomsat-red" /> Diajukan
              untuk
            </label>
            <input
              autoFocus
              value={recipient.name}
              onChange={(event) =>
                setRecipient({ ...recipient, name: event.target.value })
              }
              placeholder="Nama penerima / atasan"
              className="w-full rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 px-4 py-3 text-sm outline-none transition focus:border-telkomsat-red focus:bg-white focus:ring-4 focus:ring-telkomsat-red/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-telkomsat-black">
              Jabatan / Unit
            </label>
            <input
              value={recipient.position}
              onChange={(event) =>
                setRecipient({ ...recipient, position: event.target.value })
              }
              placeholder="Contoh: Manager Operasional"
              className="w-full rounded-xl border border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 px-4 py-3 text-sm outline-none transition focus:border-telkomsat-red focus:bg-white focus:ring-4 focus:ring-telkomsat-red/10"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-telkomsat-gray-lighter bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-telkomsat-gray transition hover:bg-telkomsat-gray-lighter"
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <FileSignature className="h-4 w-4" /> Buat &amp; Unduh PDF
          </button>
        </div>
      </form>
    </div>
  );
}
