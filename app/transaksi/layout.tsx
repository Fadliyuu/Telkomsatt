import AdminLayout from "@/components/AdminLayout";
import { Suspense } from "react";

export default function TransaksiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminLayout>
      <Suspense fallback={<p className="text-gray-400">Memuat halaman transaksi...</p>}>
        {children}
      </Suspense>
    </AdminLayout>
  );
}
