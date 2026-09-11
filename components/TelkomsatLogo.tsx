"use client";

import Image from "next/image";

interface TelkomsatLogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  variant?: "full" | "icon" | "text";
  theme?: "light" | "dark"; // light = untuk background terang, dark = untuk background gelap/merah
}

export default function TelkomsatLogo({ 
  size = "md", 
  showTagline = false,
  variant = "full",
  theme = "light"
}: TelkomsatLogoProps) {
  const sizeClasses = {
    sm: "w-24",
    md: "w-32",
    lg: "w-40",
  };

  const imageSizeClasses = {
    sm: "w-24 h-auto max-h-12",
    md: "w-32 h-auto max-h-16",
    lg: "w-40 h-auto max-h-20",
  };

  const iconSizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  // Style untuk text dengan outline/shadow putih di dark theme
  const darkTextStyle = {
    textShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 3px rgba(255,255,255,1), 1px 1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(255,255,255,0.5)',
    WebkitTextStroke: '0.5px rgba(255,255,255,0.3)',
  };

  return (
    <div className={`flex items-center ${variant === "icon" ? "justify-center" : "justify-start"} ${sizeClasses[size]}`}>
      {variant === "icon" ? (
        // Icon only
        <div className="relative">
          <Image
            src="/logo/ODF.png?v=2"
            alt="Logo"
            width={80}
            height={80}
            className={iconSizeClasses[size]}
            style={{ objectFit: "contain" }}
          />
        </div>
      ) : variant === "text" ? (
        // Text only
        <div className="flex flex-col">
          <div className="flex items-center">
            {theme === "dark" ? (
              <>
                <span 
                  className={`text-white font-extrabold ${textSizeClasses[size]}`}
                  style={darkTextStyle}
                >
                  telkom
                </span>
                <span 
                  className={`text-[#E31E24] font-extrabold ${textSizeClasses[size]}`}
                  style={darkTextStyle}
                >
                  sat
                </span>
              </>
            ) : (
              <>
                <span className={`text-black font-bold ${textSizeClasses[size]}`}>telkom</span>
                <span className={`text-[#E31E24] font-bold ${textSizeClasses[size]}`}>sat</span>
              </>
            )}
          </div>
          {showTagline && (
            <span className={`text-xs ${theme === "dark" ? "text-white/80" : "text-gray-600"} mt-0.5`}>
              Discover New Horizons
            </span>
          )}
        </div>
      ) : (
        // Full logo with image
        <div className="flex items-center">
          <Image
            src="/logo/ODF.png?v=2"
            alt="Logo"
            width={200}
            height={80}
            className={imageSizeClasses[size]}
            style={{ objectFit: "contain", maxWidth: "100%" }}
          />
        </div>
      )}
    </div>
  );
}

