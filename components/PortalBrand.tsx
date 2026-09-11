"use client";

import Image from "next/image";

type PortalBrandSize = "sm" | "md" | "lg";

interface PortalBrandProps {
  size?: PortalBrandSize;
  subtitle?: string;
  centered?: boolean;
}

const styles: Record<PortalBrandSize, { mark: string; icon: string; wordmark: string; subtitle: string }> = {
  sm: { mark: "h-10 w-10 rounded-xl", icon: "h-7 w-7", wordmark: "text-xl", subtitle: "text-[8px]" },
  md: { mark: "h-12 w-12 rounded-2xl", icon: "h-8 w-8", wordmark: "text-[27px]", subtitle: "text-[9px]" },
  lg: { mark: "h-14 w-14 rounded-2xl", icon: "h-10 w-10", wordmark: "text-[32px]", subtitle: "text-[10px]" },
};

export default function PortalBrand({
  size = "md",
  subtitle = "Regional 6 Inventory",
  centered = false,
}: PortalBrandProps) {
  const style = styles[size];

  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${centered ? "justify-center" : ""}`}
      aria-label={`Telkomsat ${subtitle}`}
    >
      <div className={`${style.mark} flex shrink-0 items-center justify-center border border-telkomsat-red/25 bg-gradient-to-br from-telkomsat-red/20 to-white/[0.04] shadow-[0_8px_24px_rgba(227,30,36,0.16)]`}>
        <Image src="/logo/ODF.png?v=2" alt="" width={40} height={40} className={`${style.icon} object-contain`} priority />
      </div>
      <div className="min-w-0 leading-none text-left">
        <div className={`${style.wordmark} whitespace-nowrap font-black tracking-[-0.055em]`}>
          <span className="text-white">telkom</span>
          <span className="text-[#f42f28]">sat</span>
        </div>
        <p className={`${style.subtitle} mt-1.5 truncate font-bold uppercase tracking-[0.16em] text-gray-500`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
