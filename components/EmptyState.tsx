"use client";

import { ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import TelkomsatButton from "@/components/TelkomsatButton";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
}

export default function EmptyState({
  icon = <FolderOpen className="h-10 w-10 text-telkomsat-gray/60" />,
  title = "Tidak ada data",
  message = "Belum ada data yang tersedia untuk ditampilkan saat ini.",
  actionLabel,
  onAction,
  actionIcon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-telkomsat-gray-lighter/80 bg-white/60 p-8 text-center backdrop-blur-md shadow-sm transition-all duration-300 hover:border-telkomsat-red/30">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-telkomsat-red/5 p-3 text-telkomsat-red animate-scale-in">
        {icon}
      </div>
      <h3 className="text-base font-bold text-telkomsat-black">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-telkomsat-gray">{message}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <TelkomsatButton
            onClick={onAction}
            size="sm"
            variant="primary"
            icon={actionIcon}
          >
            {actionLabel}
          </TelkomsatButton>
        </div>
      )}
    </div>
  );
}
