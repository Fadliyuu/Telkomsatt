"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  title = "Terjadi kesalahan",
  message,
  onRetry,
  retryLabel = "Coba lagi",
}: ErrorStateProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-telkomsat-gray-lighter p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-telkomsat-red">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-telkomsat-black">{title}</h2>
      <p className="mt-2 text-sm text-telkomsat-gray">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-telkomsat-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-telkomsat-red-dark"
        >
          <RefreshCcw className="h-4 w-4" />
          <span>{retryLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
