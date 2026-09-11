"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, QrCode } from "lucide-react";
import { getSparepartById } from "@/lib/firebase/spareparts";
import { getSparepartItemById } from "@/lib/firebase/sparepartItems";

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const openDetail = async () => {
      if (!id) return;

      const item = await getSparepartItemById(id);
      if (item) {
        router.replace(`/item/${id}`);
        return;
      }

      const sparepart = await getSparepartById(id);
      if (sparepart) {
        router.replace(`/spareparts/${id}`);
        return;
      }

      setNotFound(true);
    };

    openDetail();
  }, [id, router]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center max-w-md">
          <QrCode className="w-12 h-12 text-telkomsat-red mx-auto mb-4" />
          <h1 className="text-xl font-bold text-telkomsat-black">
            Data QR tidak ditemukan
          </h1>
          <p className="text-sm text-telkomsat-gray mt-2">
            Pastikan QR berasal dari data sparepart atau item yang masih tersedia
            di sistem.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/spareparts")}
            className="mt-5 bg-telkomsat-red text-white px-5 py-2.5 rounded-lg font-semibold"
          >
            Scan Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-telkomsat-red animate-spin mx-auto mb-4" />
        <p className="text-telkomsat-gray font-semibold">Membuka detail data...</p>
      </div>
    </div>
  );
}
