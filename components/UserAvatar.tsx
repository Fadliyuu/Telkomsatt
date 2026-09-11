"use client";

import { UserRound } from "lucide-react";
import Image from "next/image";
import { getCloudinaryUrl } from "@/lib/utils/cloudinary";

type UserAvatarProps = {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "navLg" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  navLg: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

const imageSizes = {
  sm: 64,
  md: 96,
  navLg: 112,
  lg: 160,
  xl: 240,
};

export default function UserAvatar({
  name,
  src,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase();
  const optimizedSrc = src
    ? getCloudinaryUrl(src, {
        width: imageSizes[size],
        height: imageSizes[size],
        quality: "auto",
        format: "auto",
      })
    : "";

  return (
    <div
      className={`${sizeClasses[size]} overflow-hidden rounded-full bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark flex shrink-0 items-center justify-center font-bold text-white shadow-md ${className}`}
    >
      {optimizedSrc ? (
        <Image
          src={optimizedSrc}
          alt={name ? `Foto profil ${name}` : "Foto profil"}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="h-full w-full object-cover"
        />
      ) : initial ? (
        initial
      ) : (
        <UserRound className="h-1/2 w-1/2" />
      )}
    </div>
  );
}
