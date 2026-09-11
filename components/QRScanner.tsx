"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void | boolean | Promise<void | boolean>;
  onClose?: () => void;
  keepOpen?: boolean; // If true, scanner will restart after scan instead of closing
}

function getCameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException
    ? error.name
    : error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const message = rawMessage.toLowerCase();

  if (!window.isSecureContext) {
    return "Kamera diblokir karena halaman tidak menggunakan koneksi aman. Buka melalui HTTPS atau localhost.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || message.includes("permission") || message.includes("denied")) {
    return "Izin kamera ditolak. Izinkan kamera pada pengaturan situs browser, lalu coba lagi.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || message.includes("not found")) {
    return "Kamera tidak ditemukan pada perangkat ini.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || message.includes("could not start video") || message.includes("not readable")) {
    return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi kamera atau video call, lalu coba lagi.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "Kamera tersedia, tetapi konfigurasi video tidak didukung perangkat ini.";
  }
  if (name === "SecurityError") {
    return "Browser memblokir akses kamera karena kebijakan keamanan.";
  }
  return "Kamera gagal dibuka. Periksa izin browser dan pastikan kamera tidak digunakan aplikasi lain.";
}

export default function QRScanner({ onScanSuccess, onClose, keepOpen = false }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  
  // Use refs to avoid closure issues
  const processingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const onScanSuccessRef = useRef(onScanSuccess);
  const keepOpenRef = useRef(keepOpen);
  const scanAttemptsRef = useRef(0);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Update refs when props change
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    keepOpenRef.current = keepOpen;
  }, [onScanSuccess, keepOpen]);

  // startScanner runs only on mount. It uses refs (onScanSuccessRef, keepOpenRef)
  // to read the latest prop values at scan time, so it does not need to re-run
  // when those props change — that would restart the camera mid-use.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const startScanner = async () => {
    try {
      setError(null);
      setIsScanning(false);
      scanAttemptsRef.current = 0;

      if (!window.isSecureContext) {
        throw new DOMException("Camera requires a secure context", "SecurityError");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Camera API is not available", "NotSupportedError");
      }
      
      // Clear previous scanner if exists
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (e) {
          // Ignore errors when clearing
          console.log("Clearing previous scanner:", e);
        }
      }

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      // Get available cameras
      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (err: unknown) {
        console.error("Error getting cameras:", err);
        throw new Error(getCameraErrorMessage(err));
      }

      if (devices.length === 0) {
        throw new Error("Tidak ada kamera yang tersedia");
      }

      // Use back camera if available, otherwise use first camera
      const backCamera = devices.find(
        (device) => 
          device.label.toLowerCase().includes("back") || 
          device.label.toLowerCase().includes("rear") ||
          device.label.toLowerCase().includes("environment")
      );
      const selectedCameraId = backCamera?.id || devices[0].id;
      setCameraId(selectedCameraId);

      // Calculate optimal QR box size based on viewport
      const viewportWidth = Math.min(window.innerWidth - 32, 600); // -32 for padding
      const qrBoxSize = Math.min(Math.floor(viewportWidth * 0.7), 350);

      // Start scanning with optimized settings - fix split screen issue
      await scanner.start(
        selectedCameraId,
        {
          fps: 20, // Optimal FPS for balance between performance and detection
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Dynamic QR box that adapts to viewport - prevent split screen
            const minEdgePercentage = 0.7; // 70% of the smaller dimension
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight) * minEdgePercentage;
            const qrboxSize = Math.min(minEdgeSize, qrBoxSize);
            return {
              width: qrboxSize,
              height: qrboxSize
            };
          },
          disableFlip: false, // Allow rotation detection
          rememberLastUsedCamera: true,
          // Hide UI elements that might cause split screen
          showTorchButtonIfSupported: false,
          showZoomSliderIfSupported: false,
        } as any,
        async (decodedText, decodedResult) => {
          // Success callback - directly handle scan
          scanAttemptsRef.current = 0; // Reset attempts on success
          await handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Error callback - this fires frequently during scanning
          scanAttemptsRef.current++;
          // Silently ignore scanning errors (these are normal during scanning)
          // Only log if it's a persistent issue
          if (scanAttemptsRef.current > 100 && scanAttemptsRef.current % 50 === 0) {
            console.log("Scanning in progress...", scanAttemptsRef.current, "attempts");
          }
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error("Error starting scanner:", err);
      const rawMessage = err instanceof Error ? err.message : "";
      const isFriendlyMessage = ["Kamera", "Izin", "Browser"].some((prefix) =>
        rawMessage.startsWith(prefix)
      );
      const errorMessage = isFriendlyMessage ? rawMessage : getCameraErrorMessage(err);
      setError(errorMessage);
      
      // More user-friendly error messages
      if (errorMessage.includes("ditolak") || errorMessage.includes("Izinkan")) {
        toast.error("Izin kamera diperlukan. Silakan aktifkan izin kamera di pengaturan browser.");
      } else if (errorMessage.includes("not found") || errorMessage.includes("not available")) {
        toast.error("Kamera tidak ditemukan. Pastikan kamera terhubung dan tidak digunakan aplikasi lain.");
      } else {
        toast.error(errorMessage);
      }
      
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      setIsScanning(false);
    }
  };

  const extractIdFromQR = (decodedText: string): string | null => {
    try {
      // Try to parse as URL first
      try {
        const url = new URL(decodedText);
        const pathParts = url.pathname.split("/").filter((p) => p);
        
        // Find 'scan' or 'item' and get the next part as ID
        const scanIndex = pathParts.indexOf("scan");
        const itemIndex = pathParts.indexOf("item");
        
        if (scanIndex >= 0 && scanIndex < pathParts.length - 1) {
          return pathParts[scanIndex + 1];
        } else if (itemIndex >= 0 && itemIndex < pathParts.length - 1) {
          return pathParts[itemIndex + 1];
        } else if (pathParts.length > 0) {
          // Last part might be the ID
          return pathParts[pathParts.length - 1];
        }
      } catch {
        // Not a valid URL, continue to direct ID check
      }

      // Check if it's a path-like string (starts with /)
      if (decodedText.startsWith("/")) {
        const pathParts = decodedText.split("/").filter((p) => p);
        const scanIndex = pathParts.indexOf("scan");
        const itemIndex = pathParts.indexOf("item");
        
        if (scanIndex >= 0 && scanIndex < pathParts.length - 1) {
          return pathParts[scanIndex + 1];
        } else if (itemIndex >= 0 && itemIndex < pathParts.length - 1) {
          return pathParts[itemIndex + 1];
        } else if (pathParts.length > 0) {
          return pathParts[pathParts.length - 1];
        }
      }

      // Treat as direct ID (Firebase document ID format)
      const trimmed = decodedText.trim();
      // Firebase IDs are typically 20-28 characters alphanumeric
      if (trimmed.length >= 10 && trimmed.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return trimmed;
      }

      return null;
    } catch (err) {
      console.error("Error extracting ID:", err);
      return null;
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    const now = Date.now();
    
    // Prevent duplicate rapid scans (within 800ms)
    if (processingRef.current) {
      return;
    }

    // Check if same code was scanned recently (within 1.2 seconds)
    if (decodedText === lastScannedCodeRef.current && (now - lastScanTimeRef.current) < 1200) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    lastScannedCodeRef.current = decodedText;
    lastScanTimeRef.current = now;

    try {
      // Extract ID from QR code
      const sparepartId = extractIdFromQR(decodedText);

      if (!sparepartId) {
        throw new Error("Format QR Code tidak dikenali. Pastikan QR Code dari aplikasi ini.");
      }

      // Validate ID format (Firebase document ID - typically 20-28 chars, but can vary)
      if (sparepartId.length < 1 || sparepartId.length > 128) {
        throw new Error("ID tidak valid");
      }

      // Call success callback using ref to get latest version.
      // Pages can return false when the QR is valid but the item action fails.
      const scanResult = await onScanSuccessRef.current(sparepartId);
      if (scanResult === false) {
        throw new Error("QR Code terbaca, tetapi item tidak berhasil diproses.");
      }
      setScanCount(prev => prev + 1);

      // Show success feedback with haptic feedback if available
      if (keepOpenRef.current) {
        toast.success("✓ QR Code terbaca!", { 
          duration: 1200, 
          icon: "📷",
          style: {
            background: "#10b981",
            color: "#fff",
          }
        });
        
        // Visual feedback - flash effect
        const readerElement = document.getElementById("qr-reader");
        if (readerElement) {
          readerElement.style.transition = "all 0.2s";
          readerElement.style.filter = "brightness(1.2)";
          setTimeout(() => {
            if (readerElement) {
              readerElement.style.filter = "brightness(1)";
            }
          }, 200);
        }
      } else {
        // Stop scanner if not in keepOpen mode
        await stopScanner();
        toast.success("QR Code berhasil dibaca!", { duration: 1500 });
      }

      // If keepOpen is true, allow scanning again after delay
      if (keepOpenRef.current) {
        setTimeout(() => {
          processingRef.current = false;
          setIsProcessing(false);
          // Clear last scanned code after delay to allow re-scanning same item
          setTimeout(() => {
            lastScannedCodeRef.current = null;
          }, 800);
        }, 800);
      } else {
        processingRef.current = false;
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      console.error("Error processing QR code:", err);
      const message = err instanceof Error ? err.message : "QR Code tidak valid";
      toast.error(message, {
        duration: 2000,
        icon: "⚠️"
      });
      processingRef.current = false;
      setIsProcessing(false);
      
      // Reset after error to allow retry
      setTimeout(() => {
        lastScannedCodeRef.current = null;
      }, 1500);
    }
  };

  const handleClose = async () => {
    await stopScanner();
    if (onClose) {
      onClose();
    }
  };

  const scannerDialog = (
    <div role="dialog" aria-modal="true" aria-label="Pemindai QR Code" className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0d0f12] text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-600/15 p-2.5"><Camera className="h-5 w-5 text-red-400" /></div>
          <div><h2 className="text-base font-bold text-white">Scan QR Code</h2><p className="mt-0.5 text-xs text-slate-400">{keepOpen ? "Pindai beberapa barang secara berurutan" : "Identifikasi barang dari label QR"}</p></div>
        </div>
        <button onClick={handleClose} aria-label="Tutup pemindai" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/15"><X className="h-5 w-5" /></button>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        {error ? <div role="alert" className="w-full max-w-sm rounded-2xl border border-red-400/20 bg-slate-900 p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h3 className="mb-2 text-lg font-semibold">Kamera belum bisa dibuka</h3>
          <p className="text-sm leading-relaxed text-slate-300">{error}</p>
          <button onClick={startScanner} className="mt-6 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold hover:bg-red-500">Coba lagi</button>
          {onClose && <button onClick={handleClose} className="mt-2 w-full rounded-xl px-4 py-3 text-sm text-slate-300">Kembali ke input manual</button>}
        </div> : <div className="flex h-full w-full max-w-lg min-h-0 flex-col justify-center">
          <div className="relative mx-auto w-full max-h-full overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl">
            <div id="qr-reader" className="w-full overflow-hidden" />
            {(!isScanning || isProcessing) && <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-red-400" />
              <p className="font-semibold">{isProcessing ? "Memeriksa barang…" : "Menyiapkan kamera…"}</p>
              <p className="text-xs text-slate-400">{isProcessing ? "Tahan sebentar sebelum memindai barang berikutnya" : "Izinkan akses kamera jika diminta"}</p>
            </div>}
          </div>
          <div role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-300">
            <span className={"h-2 w-2 rounded-full " + (isScanning ? "bg-emerald-400" : "bg-slate-500")} />
            {isProcessing ? "QR Code terdeteksi" : isScanning ? "Kamera aktif • posisikan QR di dalam kotak" : "Menghubungkan kamera"}
          </div>
        </div>}
      </main>
      <footer className="shrink-0 border-t border-white/10 bg-slate-900/60 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <div><p className="text-sm font-semibold">{keepOpen ? scanCount + " barang berhasil dipindai" : "Arahkan ke QR pada label barang"}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">Pastikan label terang, utuh, dan tidak memantulkan cahaya.</p></div>
          {keepOpen && <button onClick={handleClose} className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold hover:bg-red-500">Selesai</button>}
        </div>
      </footer>
      <style jsx global>{`
        #qr-reader { border: 0 !important; line-height: 0 !important; }
        #qr-reader video {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          aspect-ratio: auto !important;
          max-height: calc(100dvh - 200px) !important;
          object-fit: cover !important;
        }
        #qr-reader img { display: none !important; }
        #qr-reader__dashboard { display: none !important; }
        #qr-reader__header_message { display: none !important; }
        @media (orientation: landscape) and (max-height: 500px) {
          #qr-reader video { max-height: calc(100dvh - 140px) !important; }
        }
      `}</style>
    </div>
  );

  return portalTarget ? createPortal(scannerDialog, portalTarget) : null;
}
