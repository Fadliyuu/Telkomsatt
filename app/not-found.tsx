import Link from "next/link";
import TelkomsatLogo from "@/components/TelkomsatLogo";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0d0f12] text-white px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-telkomsat-red/15 blur-[100px]" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center text-center">
        <TelkomsatLogo size="lg" variant="full" showTagline />
        <p className="mt-10 text-sm font-bold uppercase tracking-[0.2em] text-telkomsat-red">
          404
        </p>
        <h1 className="mt-3 text-4xl font-bold text-white">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 max-w-xl text-gray-400">
          Link yang dibuka tidak tersedia atau aksesnya sudah berubah.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-telkomsat-red px-5 py-3 font-semibold text-white hover:bg-telkomsat-red-dark"
          >
            <LayoutDashboard className="h-4 w-4" />
            Ke Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white backdrop-blur-xl hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Ke Login
          </Link>
        </div>
      </div>
    </main>
  );
}
