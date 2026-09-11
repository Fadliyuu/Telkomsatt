import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/AuthProvider";
import PushSetup from "@/components/PushSetup";

export const metadata: Metadata = {
  title: "Inventaris Sparepart QR - Telkomsat Regional 6",
  description: "Sistem Inventarisasi Sparepart dengan QR Code",
  icons: {
    icon: "/logo/ODF.png?v=2",
    apple: "/logo/ODF.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#0d0f12] text-white antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
          <PushSetup />
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
