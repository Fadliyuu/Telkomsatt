"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TelkomsatButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "glass" | "subtle";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
}

export default function TelkomsatButton({
  variant = "primary",
  size = "md",
  children,
  icon,
  loading = false,
  className,
  disabled,
  ...props
}: TelkomsatButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 transform active-press hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white hover:shadow-xl shadow-lg shadow-telkomsat-red/20",
    secondary: "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-xl shadow-lg shadow-green-600/20",
    outline: "border-2 border-telkomsat-red text-telkomsat-red hover:bg-telkomsat-red/10",
    danger: "bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-xl shadow-lg shadow-red-600/20",
    glass: "glass-strong border border-white/40 text-telkomsat-black hover:bg-white/90 shadow-md",
    subtle: "bg-telkomsat-gray-lighter/80 text-telkomsat-black hover:bg-telkomsat-gray-lighter shadow-sm",
  };

  const sizeClasses = {
    sm: "px-3.5 py-2 text-xs sm:text-sm",
    md: "px-5 py-2.5 text-sm sm:text-base",
    lg: "px-6 py-3 text-base sm:text-lg",
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          <span>Memproses...</span>
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}

