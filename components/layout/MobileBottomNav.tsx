"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MoreHorizontal, X } from "lucide-react";

export interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact: boolean;
  excludePaths?: string[];
}

interface MobileBottomNavProps {
  navItems: NavItem[];
  isNavActive: (item: NavItem) => boolean;
}

/**
 * Mobile bottom navigation bar.
 *
 * Renders up to 4 primary nav items in a bottom bar. If more items exist,
 * a "More" button opens a drawer overlay with the remaining items.
 */
export default function MobileBottomNav({ navItems, isNavActive }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const useDrawer = navItems.length > 5;
  const visibleItems = useDrawer ? navItems.slice(0, 4) : navItems;
  const extraItems = useDrawer ? navItems.slice(4) : [];
  const isExtraActive = extraItems.some((item) => isNavActive(item));

  return (
    <>
      {/* ── Drawer overlay for extra items ──────────────────────────────── */}
      {useDrawer && moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />

          {/* Drawer panel */}
          <div className="fixed bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4rem))] left-3 right-3 z-50 origin-bottom rounded-3xl border border-white/15 bg-[#11141c]/95 p-4 shadow-2xl backdrop-blur-2xl animate-slide-up text-white">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                Menu Lainnya
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 max-h-[60vh] overflow-y-auto p-1">
              {extraItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center transition-all duration-300 active-press ${
                      isActive
                        ? "bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark text-white shadow-lg shadow-telkomsat-red/30 font-bold"
                        : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white font-semibold"
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isActive ? "bg-white/20" : "bg-white/10 text-white"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] leading-tight line-clamp-2">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0d0f14]/90 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl lg:hidden text-white"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[10px] font-bold transition-all duration-300 active-press ${
                  isActive
                    ? "bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark text-white shadow-lg shadow-telkomsat-red/30"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "scale-110" : ""} transition-transform`} />
                <span className="max-w-full truncate leading-none text-center">{item.label}</span>
              </Link>
            );
          })}

          {useDrawer && (
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-label="Menu Lainnya"
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[10px] font-bold transition-all duration-300 active-press ${
                moreOpen || isExtraActive
                  ? "bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark text-white shadow-lg shadow-telkomsat-red/30"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <MoreHorizontal
                className={`h-5 w-5 ${moreOpen || isExtraActive ? "scale-110" : ""} transition-transform`}
              />
              <span className="max-w-full truncate leading-none text-center">Lainnya</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
