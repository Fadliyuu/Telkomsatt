"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrCode, ShoppingCart, LogIn, Package, Camera, X, Trash2, AlertTriangle, CheckCircle, ArrowRight, Loader2, PlusCircle, Plus, Image as ImageIcon, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { useCartStore } from "@/lib/store/useCartStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import QRScanner from "@/components/QRScanner";
import UnrecognizedQRModal from "@/components/scan/UnrecognizedQRModal";
import { getSparepartById } from "@/lib/firebase/spareparts";
import {
  getSparepartItemById,
  createSparepartItem,
  resolveSparepartItemIdentifier,
  searchSparepartItemSuggestions,
} from "@/lib/firebase/sparepartItems";
import { getDefaultPath } from "@/lib/rbac";
import type { SparepartItem } from "@/types";
import type { Sparepart } from "@/types";
import toast from "react-hot-toast";

interface ScannedItem {
  id: string;
  nama: string;
  serialNumber?: string;
  actionType: "MOVE" | "DAMAGE" | "FOUND" | "DISMANTLE";
  cartItemId: string;
  lokasiDitemukan?: string;
  kondisiDismantle?: "Rusak" | "Bagus";
}

interface QuickAddItemData {
  id: string; // unique id for list management
  namaPerangkat: string;
  serialNumber: string;
  tagging: string;
  fotoUrls: string[];
}

interface QuickAddFormData {
  lokasiTujuan: string;
  items: QuickAddItemData[];
}

interface FoundItemData {
  id: string;
  nama: string;
  lokasiSaatIni: string;
}

function getFoundItemLocation(item: SparepartItem | Sparepart): string {
  return "lokasiDefault" in item
    ? item.lokasiDefault || "Gudang"
    : item.lokasiSaatIni || "Gudang";
}

export default function ScanHomePage() {
  const router = useRouter();
  const { items, addItem, removeItem, namaTeknisi, sessionToken, initSession, clearCart, clearSession } = useCartStore();
  const { user } = useAuthStore();
  const [showScanner, setShowScanner] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [showTechForm, setShowTechForm] = useState(false);
  const [techName, setTechName] = useState("");
  const [techType, setTechType] = useState<"freelance" | "karyawan" | "vendor">("karyawan");
  const [defaultAction, setDefaultAction] = useState<"MOVE" | "DAMAGE" | "FOUND" | "DISMANTLE">("MOVE");
  const [showDismantleForm, setShowDismantleForm] = useState(false);
  const [dismantleItemId, setDismantleItemId] = useState<string | null>(null);
  const [kondisiDismantle, setKondisiDismantle] = useState<"Rusak" | "Bagus">("Bagus");
  
  // State untuk konfirmasi lokasi barang ditemukan
  const [showFoundConfirm, setShowFoundConfirm] = useState(false);
  const [foundItemData, setFoundItemData] = useState<FoundItemData | null>(null);
  const [foundLokasi, setFoundLokasi] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualItemId, setManualItemId] = useState("");
  const [manualSuggestions, setManualSuggestions] = useState<SparepartItem[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  
  // Quick Add states - multi-item support
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState<QuickAddFormData>({
    lokasiTujuan: "",
    items: [{ id: "1", namaPerangkat: "", serialNumber: "", tagging: "", fotoUrls: [] }],
  });
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["1"]); // Track which items are expanded

  // Unrecognized QR modal states
  const [showUnrecognizedModal, setShowUnrecognizedModal] = useState(false);
  const [unrecognizedScannedId, setUnrecognizedScannedId] = useState<string>("");

  // Generate unique ID for new quick add items
  const generateQuickAddId = () => `qa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (user && user.role !== "teknisi") {
      router.replace(
        user.role === "admin_gudang"
          ? "/scan/gudang"
          : getDefaultPath(user.role)
      );
      return;
    }

    if (!sessionToken && !namaTeknisi) {
      if (user?.role === "teknisi") {
        initSession(user.nama, "karyawan");
      } else if (!user) {
        setShowTechForm(true);
      } else {
        setShowTechForm(true);
      }
    }
  }, [user, sessionToken, namaTeknisi, initSession, router]);

  // Sync scanned items with cart
  useEffect(() => {
    syncScannedItems();
  }, [items]);

  useEffect(() => {
    if (!showManualInput || manualItemId.trim().length < 2) {
      setManualSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setManualSearching(true);
      try {
        const rows = await searchSparepartItemSuggestions(manualItemId, 8);
        if (!cancelled) setManualSuggestions(rows);
      } catch {
        if (!cancelled) setManualSuggestions([]);
      } finally {
        if (!cancelled) setManualSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [manualItemId, showManualInput]);

  const syncScannedItems = useCallback(async () => {
    if (items.length === 0) {
      setScannedItems([]);
      return;
    }

    try {
      const itemsData = await Promise.all(
        items.map(async (item) => {
          // Try sparepart_items first
          try {
            const itemData = await getSparepartItemById(item.idSparepart);
            if (itemData) {
              return {
                id: itemData.id,
                nama: itemData.namaPerangkat,
                serialNumber: itemData.serialNumber || undefined,
                actionType: item.jenisAksi,
                cartItemId: item.id,
                lokasiDitemukan: item.lokasiDitemukan,
                kondisiDismantle: item.kondisiDismantle,
              } as ScannedItem;
            }
          } catch (e) {
            console.log("Not found in sparepart_items");
          }

          // Try spareparts collection
          try {
            const sparepartData = await getSparepartById(item.idSparepart);
            if (sparepartData) {
              return {
                id: sparepartData.id,
                nama: sparepartData.namaSpare,
                serialNumber: undefined,
                actionType: item.jenisAksi,
                cartItemId: item.id,
              } as ScannedItem;
            }
          } catch (e) {
            console.log("Not found in spareparts");
          }

          // Return placeholder if not found
          return {
            id: item.idSparepart,
            nama: `Item ${item.idSparepart.substring(0, 8)}...`,
            serialNumber: undefined,
            actionType: item.jenisAksi,
            cartItemId: item.id,
          } as ScannedItem;
        })
      );

      setScannedItems(itemsData);
    } catch (error) {
      console.error("Error syncing scanned items:", error);
    }
  }, [items]);

  const handleManualInput = () => {
    // Check session first
    if (!sessionToken && !namaTeknisi) {
      setShowManualInput(false); // Ensure manual input is closed
      setShowScanner(false); // Ensure scanner is closed
      setShowTechForm(true);
      toast.error("Silakan isi nama teknisi terlebih dahulu");
      return;
    }
    // Close scanner and tech form, then show manual input
    setShowScanner(false);
    setShowTechForm(false);
    setShowManualInput(true);
  };

  const handleManualInputSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manualItemId.trim()) {
      toast.error("ID item wajib diisi");
      return;
    }
    
    const item = await resolveSparepartItemIdentifier(manualItemId.trim());
    if (!item) {
      toast.error("Item tidak ditemukan dari ID, SN, atau tagging");
      return;
    }

    const added = await handleAddItem(item.id);
    if (added) {
      setManualItemId("");
      setManualSuggestions([]);
      setShowManualInput(false);
    }
  };

  const handleTechFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!techName.trim()) {
      toast.error("Nama teknisi wajib diisi");
      return;
    }
    initSession(techName, techType);
    setShowTechForm(false);
    setShowManualInput(false); // Close manual input if open
    setShowScanner(false); // Close scanner if open
    toast.success(`Selamat datang, ${techName}!`, { icon: "👋" });
  };

  const handleAddItem = async (itemId: string) => {
    console.log("handleAddItem called with:", itemId);
    console.log("Current session:", { sessionToken, namaTeknisi });
    console.log("Current items:", items);
    
    // Prevent duplicate rapid scans
    if (isProcessing) {
      console.log("Already processing, skipping");
      return false;
    }
    
    if (itemId === lastScannedId) {
      console.log("Same item scanned recently, skipping");
      toast("Item sudah di-scan baru-baru ini", { icon: "ℹ️", duration: 1000 });
      return false;
    }

    // Check session first
    if (!sessionToken && !namaTeknisi) {
      console.log("No session, showing tech form");
      setShowTechForm(true);
      toast.error("Silakan isi nama teknisi terlebih dahulu");
      return false;
    }

    // Check if already in cart
    const exists = items.find(
      (item) => item.idSparepart === itemId
    );

    if (exists) {
      console.log("Item already in cart");
      toast.error("Item sudah ada di keranjang!", { icon: "⚠️" });
      return false;
    }

    setIsProcessing(true);
    setLastScannedId(itemId);

    try {
      console.log("Verifying item in database...");
      
      // Verify item exists in database
      let itemData: SparepartItem | Sparepart | null = null;
      let itemName = "";

      // Try sparepart_items first
      try {
        const sparepartItem = await getSparepartItemById(itemId);
        if (sparepartItem) {
          itemData = sparepartItem;
          itemName = sparepartItem.namaPerangkat;
          console.log("Found in sparepart_items:", itemName);
        }
      } catch (e) {
        console.log("Not in sparepart_items");
      }

      // Try spareparts collection if not found
      if (!itemData) {
        try {
          const sparepartData = await getSparepartById(itemId);
          if (sparepartData) {
            itemData = sparepartData;
            itemName = sparepartData.namaSpare;
            console.log("Found in spareparts:", itemName);
          }
        } catch (e) {
          console.log("Not in spareparts");
        }
      }

      // Handle FOUND action differently
      if (defaultAction === "FOUND") {
        if (!itemData) {
          // Barang belum ada, tampilkan modal konfirmasi
          console.log("Item not found, showing unrecognized QR modal");
          setUnrecognizedScannedId(itemId);
          setShowUnrecognizedModal(true);
          return false;
        } else {
          // Barang sudah ada, tampilkan modal konfirmasi lokasi
          console.log("Item found, showing location confirmation");
          const lokasiSaatIni = getFoundItemLocation(itemData);
          setFoundItemData({
            id: itemId,
            nama: itemName,
            lokasiSaatIni,
          });
          setFoundLokasi(lokasiSaatIni);
          setShowFoundConfirm(true);
          setIsProcessing(false);
          return false; // Don't add to cart yet, wait for confirmation
        }
      }

      if (!itemData) {
        console.log("Item not found in any collection, showing unrecognized QR modal");
        // Tampilkan modal konfirmasi dulu sebelum Quick Add
        setUnrecognizedScannedId(itemId);
        setShowUnrecognizedModal(true);
        return false;
      }

      // Handle DISMANTLE - show form first
      if (defaultAction === "DISMANTLE") {
        setDismantleItemId(itemId);
        setShowDismantleForm(true);
        setIsProcessing(false);
        return false; // Don't add to cart yet, wait for condition selection
      }

      // Add to cart for MOVE, DAMAGE, or FOUND
      console.log("Adding to cart:", itemId, defaultAction);
      addItem(itemId, defaultAction);
      
      const actionLabel = defaultAction === "MOVE" ? "Bawa" : defaultAction === "DAMAGE" ? "Rusak" : "Ditemukan";
      toast.success(
        `✓ Item ditambahkan! ${itemName} (${actionLabel})`,
        { 
          duration: 2500,
          icon: defaultAction === "MOVE" ? "📦" : defaultAction === "DAMAGE" ? "⚠️" : "✅"
        }
      );

      console.log("Item added successfully");
      return true;
    } catch (error: unknown) {
      console.error("Error adding item:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Gagal menambahkan item: " + message);
      return false;
    } finally {
      setIsProcessing(false);
      // Clear last scanned ID after delay to allow same item to be scanned again
      setTimeout(() => setLastScannedId(null), 2000);
    }
  };

  const handleScanSuccess = async (itemId: string) => {
    await handleAddItem(itemId);
  };

  const handleRemoveItem = (cartItemId: string) => {
    removeItem(cartItemId);
    toast.success("Item dihapus dari keranjang", { icon: "🗑️" });
  };

  // Handle konfirmasi lokasi barang ditemukan
  const handleConfirmFound = () => {
    if (!foundItemData) return;
    
    if (!foundLokasi.trim()) {
      toast.error("Lokasi ditemukan wajib diisi");
      return;
    }

    // Add to cart with FOUND action and location
    addItem(foundItemData.id, "FOUND", foundLokasi.trim());
    
    toast.success(
      `✅ Barang Ditemukan! ${foundItemData.nama} - Lokasi: ${foundLokasi}`,
      { 
        duration: 4000,
        icon: "✅",
        style: {
          background: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: "12px",
        }
      }
    );

    // Close modal
    setShowFoundConfirm(false);
    setFoundItemData(null);
    setFoundLokasi("");
  };

  // Handle konfirmasi dismantle
  const handleConfirmDismantle = () => {
    if (!dismantleItemId) return;

    // Check if already in cart
    const exists = items.find(
      (item) => item.idSparepart === dismantleItemId && item.jenisAksi === "DISMANTLE"
    );

    if (exists) {
      toast.error("Item sudah ada di keranjang");
      setShowDismantleForm(false);
      setDismantleItemId(null);
      return;
    }

    // Add to cart with DISMANTLE action and condition
    addItem(dismantleItemId, "DISMANTLE", undefined, kondisiDismantle);
    
    toast.success(
      `🔧 Barang Dismantle! Kondisi: ${kondisiDismantle}`,
      { 
        duration: 3000,
        icon: "🔧",
        style: {
          background: "#fff7ed",
          border: "1px solid #fdba74",
          borderRadius: "12px",
        }
      }
    );

    // Close modal
    setShowDismantleForm(false);
    setDismantleItemId(null);
    setKondisiDismantle("Bagus");
  };

  // Quick Add handler - untuk menambahkan multiple items yang belum terdata
  const handleQuickAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate lokasi tujuan
    if (!quickAddData.lokasiTujuan.trim()) {
      toast.error("Lokasi tujuan wajib diisi");
      return;
    }

    // Validate at least one item with nama perangkat
    const validItems = quickAddData.items.filter(item => item.namaPerangkat.trim());
    if (validItems.length === 0) {
      toast.error("Minimal satu item dengan nama perangkat harus diisi");
      return;
    }

    setQuickAddLoading(true);

    try {
      let successCount = 0;
      let failedCount = 0;

      // Process all items
      for (const item of validItems) {
        try {
          // Jika action FOUND, set status Tersedia, jika tidak set Outstanding
          const isFound = defaultAction === "FOUND";
          await createSparepartItem({
            namaPerangkat: item.namaPerangkat.trim(),
            serialNumber: item.serialNumber.trim() || "",
            tagging: item.tagging.trim() || undefined,
            cariFisik: isFound ? "Sesuai" : "Outstanding",
            lokasiSaatIni: quickAddData.lokasiTujuan.trim(),
            status: isFound ? "Tersedia" : "Digunakan",
            keterangan: isFound 
              ? `Barang ditemukan oleh teknisi: ${namaTeknisi}. Lokasi ditemukan: ${quickAddData.lokasiTujuan}`
              : `Ditambahkan oleh teknisi: ${namaTeknisi}. Lokasi tujuan: ${quickAddData.lokasiTujuan}`,
            ditambahkanOleh: namaTeknisi || "Unknown",
            jenisTeknisi: techType,
            carriedByName: namaTeknisi || user?.nama || "Teknisi",
            carriedByRole: user?.role,
            requestedByUid: user?.id,
            requestedAction: defaultAction,
            requestedLocation: quickAddData.lokasiTujuan.trim(),
            requestNote: `Diajukan teknisi dari quick add untuk aksi ${defaultAction}`,
            requestFotoUrl: item.fotoUrls.length > 0 ? item.fotoUrls : undefined,
            perluVerifikasi: true,
            fotoUrl: item.fotoUrls.length > 0 ? item.fotoUrls : undefined,
          });
          successCount++;
        } catch (itemError: unknown) {
          console.error(`Error adding item ${item.namaPerangkat}:`, itemError);
          failedCount++;
        }
      }

      if (successCount > 0) {
        const failMsg = failedCount > 0 ? ` (${failedCount} gagal)` : "";
        toast.success(
          `✓ ${successCount} item berhasil ditambahkan!${failMsg} Item akan diverifikasi oleh Admin`,
          { 
            duration: 4000,
            icon: "📦"
          }
        );
      }

      if (failedCount > 0 && successCount === 0) {
        toast.error("Gagal menambahkan semua item");
      }

      // Reset form dan tutup modal
      setQuickAddData({
        lokasiTujuan: "",
        items: [{ id: generateQuickAddId(), namaPerangkat: "", serialNumber: "", tagging: "", fotoUrls: [] }],
      });
      setExpandedItems(["1"]);
      setShowQuickAdd(false);

    } catch (error: unknown) {
      console.error("Error quick add items:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Gagal menambahkan item: " + message);
    } finally {
      setQuickAddLoading(false);
    }
  };

  // Quick Add item management functions
  const addQuickAddItem = () => {
    const newId = generateQuickAddId();
    setQuickAddData(prev => ({
      ...prev,
      items: [...prev.items, { id: newId, namaPerangkat: "", serialNumber: "", tagging: "", fotoUrls: [] }]
    }));
    setExpandedItems(prev => [...prev, newId]);
  };

  const removeQuickAddItem = (itemId: string) => {
    if (quickAddData.items.length <= 1) {
      toast.error("Minimal satu item harus ada");
      return;
    }
    setQuickAddData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
    setExpandedItems(prev => prev.filter(id => id !== itemId));
  };

  const updateQuickAddItem = (itemId: string, field: string, value: string | string[]) => {
    setQuickAddData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }));
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleStartScan = () => {
    if (!window.isSecureContext) {
      toast.error("Kamera memerlukan HTTPS. Gunakan HTTPS atau buka aplikasi melalui localhost.");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Browser tidak mendukung akses kamera");
      return;
    }
    
    // Check session first
    if (!sessionToken && !namaTeknisi) {
      setShowManualInput(false); // Ensure manual input is closed
      setShowScanner(false); // Ensure scanner is closed
      setShowTechForm(true);
      return;
    }
    
    // Close other modals and open scanner
    setShowTechForm(false);
    setShowManualInput(false);
    setShowScanner(true);
  };

  return (
    <>
      {/* Unrecognized QR Modal */}
      <UnrecognizedQRModal
        isOpen={showUnrecognizedModal}
        scannedId={unrecognizedScannedId}
        userRole={user?.role}
        onDismiss={() => {
          setShowUnrecognizedModal(false);
          setUnrecognizedScannedId("");
        }}
        onAddNew={() => {
          setShowUnrecognizedModal(false);
          setUnrecognizedScannedId("");
          setShowQuickAdd(true);
        }}
      />

      {/* Tech Form Modal */}
      {showTechForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-telkomsat-red/10 rounded-2xl mb-4">
                <LogIn className="w-8 h-8 text-telkomsat-red" />
              </div>
              <h2 className="text-2xl font-bold text-telkomsat-black">Identitas Teknisi</h2>
              <p className="text-telkomsat-gray mt-2">Masukkan nama Anda untuk melanjutkan</p>
            </div>
            <form onSubmit={handleTechFormSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                  Nama Teknisi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all"
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                  Jenis Teknisi
                </label>
                <select
                  value={techType}
                  onChange={(e) =>
                    setTechType(e.target.value as "freelance" | "karyawan" | "vendor")
                  }
                  className="w-full px-4 py-3 border-2 border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all"
                >
                  <option value="karyawan">Karyawan</option>
                  <option value="freelance">Freelance</option>
                  <option value="vendor">Vendor</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white py-3.5 px-4 rounded-xl hover:shadow-xl transition-all duration-300 font-semibold transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Lanjutkan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manual Input Modal */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-telkomsat-red/10 rounded-2xl mb-4">
                <QrCode className="w-8 h-8 text-telkomsat-red" />
              </div>
              <h2 className="text-2xl font-bold text-telkomsat-black">Input ID / SN / Tagging</h2>
              <p className="text-telkomsat-gray mt-2">Cari item berdasarkan ID, serial number, atau tagging</p>
            </div>
            <form onSubmit={handleManualInputSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                  ID / SN / Tagging <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualItemId}
                  onChange={(e) => setManualItemId(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all font-mono"
                  placeholder="Ketik ID, SN, atau tagging..."
                />
                <p className="text-xs text-telkomsat-gray mt-2">
                  Ketik minimal 2 karakter untuk menampilkan pilihan item.
                </p>
                {(manualSuggestions.length > 0 || manualSearching) && (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-telkomsat-gray-lighter bg-white shadow-lg">
                    {manualSearching && (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-telkomsat-gray">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mencari data...
                      </div>
                    )}
                    {manualSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={async () => {
                          const added = await handleAddItem(item.id);
                          if (added) {
                            setManualItemId("");
                            setManualSuggestions([]);
                            setShowManualInput(false);
                          }
                        }}
                        className="block w-full border-b border-telkomsat-gray-lighter px-3 py-2 text-left last:border-b-0 hover:bg-telkomsat-gray-lighter/50"
                      >
                        <p className="text-sm font-semibold text-telkomsat-black">
                          {item.namaPerangkat}
                        </p>
                        <p className="font-mono text-xs text-telkomsat-gray">
                          ID: {item.id}
                        </p>
                        <p className="font-mono text-xs text-telkomsat-gray">
                          SN: {item.serialNumber || "-"} · Tagging: {item.tagging || "-"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isProcessing || !manualItemId.trim()}
                  className="flex-1 bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white py-3 px-4 rounded-xl hover:shadow-xl transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Tambah ke Keranjang</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualInput(false);
                    setManualItemId("");
                  }}
                  className="px-6 py-3 border-2 border-telkomsat-gray-lighter text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-all font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Modal - Multi-Item Support */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl animate-scale-in w-full max-w-2xl my-4 max-h-[90vh] flex flex-col">
            {/* Header - Fixed - Warna sesuai aksi */}
            <div className="p-6 border-b border-telkomsat-gray-lighter flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${
                    defaultAction === "DAMAGE" ? "bg-red-100" : 
                    defaultAction === "FOUND" ? "bg-green-100" : 
                    "bg-blue-100"
                  }`}>
                    {defaultAction === "DAMAGE" ? (
                      <AlertTriangle className="w-7 h-7 text-red-600" />
                    ) : defaultAction === "FOUND" ? (
                      <CheckCircle className="w-7 h-7 text-green-600" />
                    ) : (
                      <Package className="w-7 h-7 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-telkomsat-black">
                      {defaultAction === "DAMAGE" ? "Laporkan Barang Rusak" : 
                       defaultAction === "FOUND" ? "Tambah Barang Ditemukan" :
                       "Tambah & Bawa Item"}
                    </h2>
                    <p className="text-telkomsat-gray mt-1">
                      {defaultAction === "DAMAGE" 
                        ? "Tambahkan item rusak yang belum terdata untuk dilaporkan"
                        : defaultAction === "FOUND"
                        ? "Tambahkan barang yang ditemukan dengan status Tersedia"
                        : "Tambahkan satu atau lebih perangkat yang belum terdata untuk dibawa"
                      }
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAdd(false);
                    setQuickAddData({
                      lokasiTujuan: "",
                      items: [{ id: generateQuickAddId(), namaPerangkat: "", serialNumber: "", tagging: "", fotoUrls: [] }],
                    });
                    setExpandedItems(["1"]);
                  }}
                  className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-telkomsat-gray" />
                </button>
              </div>
              {/* Info badge sesuai aksi */}
              <div className={`mt-4 px-3 py-2 rounded-lg ${
                defaultAction === "DAMAGE" 
                  ? "bg-red-50 border border-red-200" 
                  : defaultAction === "FOUND"
                  ? "bg-green-50 border border-green-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}>
                <p className={`text-xs ${
                  defaultAction === "DAMAGE" ? "text-red-700" : 
                  defaultAction === "FOUND" ? "text-green-700" :
                  "text-yellow-700"
                }`}>
                  {defaultAction === "DAMAGE" 
                    ? "⚠️ Item akan ditandai sebagai RUSAK dan perlu diverifikasi oleh Admin"
                    : defaultAction === "FOUND"
                    ? "✅ Item akan ditambahkan dengan status Tersedia dan langsung tersedia"
                    : "📦 Item akan ditandai sebagai \"Outstanding\" dan perlu diverifikasi oleh Admin"
                  }
                </p>
              </div>
            </div>

            {/* Form - Scrollable */}
            <form onSubmit={handleQuickAddSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Lokasi - Berlaku untuk semua item */}
                <div className={`rounded-xl p-4 ${
                  defaultAction === "DAMAGE" 
                    ? "bg-red-50 border border-red-200" 
                    : "bg-blue-50 border border-blue-200"
                }`}>
                  <label className={`block text-sm font-semibold mb-2 ${
                    defaultAction === "DAMAGE" ? "text-red-800" : "text-blue-800"
                  }`}>
                    {defaultAction === "DAMAGE" 
                      ? "📍 Lokasi Barang Rusak Ditemukan (Berlaku untuk semua item)"
                      : "📍 Lokasi Tujuan (Berlaku untuk semua item)"
                    } <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={quickAddData.lokasiTujuan}
                    onChange={(e) => setQuickAddData({ ...quickAddData, lokasiTujuan: e.target.value })}
                    required
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 outline-none transition-all bg-white ${
                      defaultAction === "DAMAGE"
                        ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                        : "border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                    placeholder={defaultAction === "DAMAGE" 
                      ? "Contoh: Gudang, Site ABC, Workshop"
                      : "Contoh: Site ABC, Customer XYZ, Workshop"
                    }
                  />
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-telkomsat-black">
                      Daftar Perangkat ({quickAddData.items.length} item)
                    </h3>
                    <button
                      type="button"
                      onClick={addQuickAddItem}
                      className="flex items-center space-x-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Item</span>
                    </button>
                  </div>

                  {quickAddData.items.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="border-2 border-telkomsat-gray-lighter rounded-xl overflow-hidden transition-all"
                    >
                      {/* Item Header - Collapsible */}
                      <div 
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          expandedItems.includes(item.id) ? "bg-orange-50" : "bg-telkomsat-gray-lighter/30 hover:bg-telkomsat-gray-lighter/50"
                        }`}
                        onClick={() => toggleItemExpanded(item.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <span className="font-medium text-telkomsat-black">
                            {item.namaPerangkat || `Item ${index + 1}`}
                          </span>
                          {item.serialNumber && (
                            <span className="text-xs text-telkomsat-gray font-mono bg-telkomsat-gray-lighter px-2 py-1 rounded">
                              SN: {item.serialNumber}
                            </span>
                          )}
                          {item.fotoUrls.length > 0 && (
                            <span className="text-xs text-green-600 flex items-center space-x-1">
                              <ImageIcon className="w-3 h-3" />
                              <span>{item.fotoUrls.length} foto</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {quickAddData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeQuickAddItem(item.id);
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {expandedItems.includes(item.id) ? (
                            <ChevronUp className="w-5 h-5 text-telkomsat-gray" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-telkomsat-gray" />
                          )}
                        </div>
                      </div>

                      {/* Item Details - Expandable */}
                      {expandedItems.includes(item.id) && (
                        <div className="p-4 space-y-4 border-t border-telkomsat-gray-lighter">
                          <div>
                            <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                              Nama Perangkat <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={item.namaPerangkat}
                              onChange={(e) => updateQuickAddItem(item.id, "namaPerangkat", e.target.value)}
                              className="w-full px-4 py-3 border-2 border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                              placeholder="Contoh: BUC 2 WATT FULL C-BAND"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                                Serial Number (Opsional)
                              </label>
                              <input
                                type="text"
                                value={item.serialNumber}
                                onChange={(e) => updateQuickAddItem(item.id, "serialNumber", e.target.value)}
                                className="w-full px-4 py-3 border-2 border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all font-mono"
                                placeholder="Contoh: A07458A12"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                                Tagging (Opsional)
                              </label>
                              <input
                                type="text"
                                value={item.tagging}
                                onChange={(e) => updateQuickAddItem(item.id, "tagging", e.target.value)}
                                className="w-full px-4 py-3 border-2 border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                placeholder="Contoh: TLSAT1339900026009"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                              <div className="flex items-center space-x-2">
                                <Camera className="w-4 h-4" />
                                <span>Foto SN & Tagging Perangkat (Opsional)</span>
                              </div>
                            </label>
                            <ImageUpload
                              images={item.fotoUrls}
                              onImagesChange={(urls) => updateQuickAddItem(item.id, "fotoUrls", urls)}
                              maxImages={3}
                              label=""
                              compact={true}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add More Items Button */}
                  <button
                    type="button"
                    onClick={addQuickAddItem}
                    className="w-full py-3 border-2 border-dashed border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50 transition-colors font-medium flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Tambah Item Lainnya</span>
                  </button>
                </div>
              </div>

              {/* Footer - Fixed */}
              <div className="p-6 border-t border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 flex-shrink-0">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    type="submit"
                    disabled={quickAddLoading || !quickAddData.lokasiTujuan.trim() || quickAddData.items.every(i => !i.namaPerangkat.trim())}
                    className={`flex-1 text-white py-3.5 px-4 rounded-xl hover:shadow-xl transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                      defaultAction === "DAMAGE"
                        ? "bg-gradient-to-r from-red-500 to-red-600"
                        : "bg-gradient-to-r from-blue-500 to-blue-600"
                    }`}
                  >
                    {quickAddLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Menyimpan {quickAddData.items.filter(i => i.namaPerangkat.trim()).length} item...</span>
                      </>
                    ) : (
                      <>
                        {defaultAction === "DAMAGE" ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <Package className="w-5 h-5" />
                        )}
                        <span>
                          {defaultAction === "DAMAGE"
                            ? `Laporkan ${quickAddData.items.filter(i => i.namaPerangkat.trim()).length} Item Rusak`
                            : `Tambah ${quickAddData.items.filter(i => i.namaPerangkat.trim()).length} Item & Bawa`
                          }
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickAddData({
                        lokasiTujuan: "",
                        items: [{ id: generateQuickAddId(), namaPerangkat: "", serialNumber: "", tagging: "", fotoUrls: [] }],
                      });
                      setExpandedItems(["1"]);
                    }}
                    className="px-6 py-3.5 border-2 border-telkomsat-gray-lighter text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-all font-semibold"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
          keepOpen={true}
        />
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex items-center space-x-4">
            <Loader2 className="w-8 h-8 text-telkomsat-red animate-spin" />
            <span className="text-telkomsat-black font-semibold">Memproses...</span>
          </div>
        </div>
      )}

      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Floating Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-64 h-64 rounded-full opacity-10"
            style={{
              background: 'linear-gradient(135deg, #E31E24 0%, #ff6b6b 100%)',
              top: '-5%',
              right: '-5%',
              filter: 'blur(40px)',
            }}
          />
          <div 
            className="absolute w-48 h-48 rounded-full opacity-15"
            style={{
              background: 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
              bottom: '10%',
              left: '-3%',
              filter: 'blur(30px)',
            }}
          />
        </div>
        
        <div className="relative z-10 p-4">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 mt-6 animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-telkomsat-red to-telkomsat-red-dark rounded-2xl mb-4 shadow-lg">
                <QrCode className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-telkomsat-black mb-2">
                Multi-Scan QR Code Sparepart
              </h1>
              <p className="text-telkomsat-gray text-base">Telkomsat Regional 6 - Scan banyak perangkat sekaligus</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Controls */}
              <div className="lg:col-span-1 space-y-4">
                <div 
                  className="bg-white rounded-xl shadow-lg p-6 border border-telkomsat-gray-lighter animate-slide-in-left"
                  style={{ animationDelay: "0.1s" }}
                >
                  <h2 className="text-lg font-bold text-telkomsat-black mb-4">Kontrol Scan</h2>
                  
                  {/* Default Action */}
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-telkomsat-black mb-3">
                      Default Aksi:
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setDefaultAction("MOVE")}
                        className={`px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                          defaultAction === "MOVE"
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                            : "bg-telkomsat-gray-lighter text-telkomsat-black hover:bg-telkomsat-gray-light"
                        }`}
                      >
                        📦 Bawa
                      </button>
                      <button
                        onClick={() => setDefaultAction("DAMAGE")}
                        className={`px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                          defaultAction === "DAMAGE"
                            ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg"
                            : "bg-telkomsat-gray-lighter text-telkomsat-black hover:bg-telkomsat-gray-light"
                        }`}
                      >
                        ⚠️ Rusak
                      </button>
                      <button
                        onClick={() => setDefaultAction("DISMANTLE")}
                        className={`px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                          defaultAction === "DISMANTLE"
                            ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg"
                            : "bg-telkomsat-gray-lighter text-telkomsat-black hover:bg-telkomsat-gray-light"
                        }`}
                      >
                        🔧 Dismantle
                      </button>
                      <button
                        onClick={() => setDefaultAction("FOUND")}
                        className={`px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                          defaultAction === "FOUND"
                            ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg"
                            : "bg-telkomsat-gray-lighter text-telkomsat-black hover:bg-telkomsat-gray-light"
                        }`}
                      >
                        ✅ Ditemukan
                      </button>
                    </div>
                    {defaultAction === "FOUND" && (
                      <p className="text-xs text-telkomsat-gray mt-2">
                        Konfirmasi lokasi jika barang sudah ada, atau tambahkan jika baru
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={handleStartScan}
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-telkomsat-red to-telkomsat-red-dark text-white py-3.5 px-4 rounded-xl hover:shadow-xl transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Buka Scanner</span>
                    </button>

                    <button
                      onClick={handleManualInput}
                      disabled={isProcessing}
                      className="w-full border-2 border-telkomsat-red text-telkomsat-red py-3 px-4 rounded-xl hover:bg-telkomsat-red/10 transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      <QrCode className="w-5 h-5" />
                      <span>Input ID Manual</span>
                    </button>

                    {/* Tombol untuk item tanpa barcode - warna sesuai aksi */}
                    <button
                      onClick={() => {
                        // Check session first
                        if (!sessionToken && !namaTeknisi) {
                          setShowTechForm(true);
                          toast.error("Silakan isi nama teknisi terlebih dahulu");
                          return;
                        }
                        setShowQuickAdd(true);
                      }}
                      disabled={isProcessing}
                      className={`w-full text-white py-3 px-4 rounded-xl hover:shadow-xl transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 ${
                        defaultAction === "DAMAGE"
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : "bg-gradient-to-r from-orange-500 to-orange-600"
                      }`}
                    >
                      {defaultAction === "DAMAGE" ? (
                        <>
                          <AlertTriangle className="w-5 h-5" />
                          <span>Lapor Rusak (Belum Ada Data)</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-5 h-5" />
                          <span>Item Belum Ada QR Code</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Session Info */}
                  {(sessionToken || namaTeknisi) && (
                    <div className="mt-5 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">✓ Teknisi:</span> {namaTeknisi}
                        </p>
                        <button
                          onClick={() => {
                            if (confirm("Akhiri sesi? Keranjang akan dikosongkan.")) {
                              clearCart();
                              clearSession();
                              toast.success("Sesi diakhiri", { icon: "👋" });
                            }
                          }}
                          className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                        >
                          Akhiri Sesi
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div 
                  className="bg-white rounded-xl shadow-lg p-6 border border-telkomsat-gray-lighter animate-slide-in-left"
                  style={{ animationDelay: "0.2s" }}
                >
                  <h3 className="text-sm font-semibold text-telkomsat-gray mb-3">Ringkasan Keranjang</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {scannedItems.filter(i => i.actionType === "MOVE").length}
                      </p>
                      <p className="text-xs text-blue-600">Bawa</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {scannedItems.filter(i => i.actionType === "DAMAGE").length}
                      </p>
                      <p className="text-xs text-red-600">Rusak</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {scannedItems.filter(i => i.actionType === "FOUND").length}
                      </p>
                      <p className="text-xs text-green-600">Ditemukan</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-xl text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {scannedItems.filter(i => i.actionType === "DISMANTLE").length}
                      </p>
                      <p className="text-xs text-orange-600">Dismantle</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Scanned Items List */}
              <div className="lg:col-span-2">
                <div 
                  className="bg-white rounded-xl shadow-lg border border-telkomsat-gray-lighter animate-slide-in-right overflow-hidden"
                  style={{ animationDelay: "0.2s" }}
                >
                  <div className="p-6 border-b border-telkomsat-gray-lighter bg-gradient-to-r from-telkomsat-red/5 to-transparent flex items-center justify-between">
                    <h2 className="text-lg font-bold text-telkomsat-black">
                      Item yang Di-scan <span className="text-telkomsat-red">({scannedItems.length})</span>
                    </h2>
                    {scannedItems.length > 0 && (
                      <Link
                        href="/transaksi/keranjang"
                        className="group flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:shadow-xl transition-all duration-300 text-sm font-semibold"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Lanjut ke Keranjang</span>
                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </Link>
                    )}
                  </div>

                  <div className="p-6">
                    {scannedItems.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-telkomsat-gray-lighter rounded-2xl mb-4">
                          <Package className="w-10 h-10 text-telkomsat-gray" />
                        </div>
                        <p className="text-telkomsat-black font-semibold mb-2">Belum ada item yang di-scan</p>
                        <p className="text-sm text-telkomsat-gray max-w-md mx-auto mb-6">
                          Buka scanner dan scan QR code perangkat untuk menambahkannya ke keranjang
                        </p>
                        <button
                          onClick={handleStartScan}
                          className="inline-flex items-center space-x-2 bg-telkomsat-red text-white px-6 py-3 rounded-xl hover:bg-telkomsat-red-dark transition-colors font-semibold"
                        >
                          <Camera className="w-5 h-5" />
                          <span>Mulai Scan</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {scannedItems.map((item, index) => (
                          <div
                            key={item.cartItemId}
                            className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-300 group ${
                              item.actionType === "FOUND"
                                ? "border-green-200 bg-gradient-to-r from-green-50 to-green-50/50 hover:from-green-100 hover:to-green-100/50 shadow-sm"
                                : item.actionType === "DAMAGE"
                                ? "border-red-200 bg-red-50/30 hover:bg-red-50/50"
                                : item.actionType === "DISMANTLE"
                                ? "border-orange-200 bg-orange-50/30 hover:bg-orange-50/50"
                                : "border-telkomsat-gray-lighter hover:bg-telkomsat-gray-lighter/30"
                            }`}
                            style={{ 
                              animation: `fadeIn 0.3s ease-out ${index * 0.05}s forwards` 
                            }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                {item.actionType === "MOVE" ? (
                                  <div className="p-2 bg-blue-100 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-blue-600" />
                                  </div>
                                ) : item.actionType === "FOUND" ? (
                                  <div className="p-2 bg-green-100 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  </div>
                                ) : item.actionType === "DISMANTLE" ? (
                                  <div className="p-2 bg-orange-100 rounded-lg">
                                    <Package className="w-5 h-5 text-orange-600" />
                                  </div>
                                ) : (
                                  <div className="p-2 bg-red-100 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="font-semibold text-telkomsat-black">{item.nama}</p>
                                  {item.serialNumber && (
                                    <p className="text-sm text-telkomsat-gray mt-0.5 font-mono">
                                      SN: {item.serialNumber}
                                    </p>
                                  )}
                                  {item.actionType === "FOUND" && item.lokasiDitemukan && (
                                    <p className="text-sm text-green-700 mt-1 font-medium flex items-center space-x-1">
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>Ditemukan di: {item.lokasiDitemukan}</span>
                                    </p>
                                  )}
                                  {item.actionType === "DISMANTLE" && item.kondisiDismantle && (
                                    <p className={`text-sm mt-1 font-medium flex items-center space-x-1 ${
                                      item.kondisiDismantle === "Bagus" ? "text-green-700" : "text-red-700"
                                    }`}>
                                      <span>Kondisi: {item.kondisiDismantle}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 ml-12">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    item.actionType === "MOVE"
                                      ? "bg-blue-100 text-blue-700"
                                      : item.actionType === "FOUND"
                                      ? "bg-green-100 text-green-700"
                                      : item.actionType === "DISMANTLE"
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {item.actionType === "MOVE" 
                                    ? "📦 Bawa Barang" 
                                    : item.actionType === "FOUND"
                                    ? "✅ Barang Ditemukan"
                                    : item.actionType === "DISMANTLE"
                                    ? `🔧 Dismantle (${item.kondisiDismantle || "Bagus"})`
                                    : "⚠️ Lapor Rusak"}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.cartItemId)}
                              className="ml-4 p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300"
                              title="Hapus dari keranjang"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Lokasi Barang Ditemukan */}
      {showFoundConfirm && foundItemData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl animate-scale-in w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-telkomsat-gray-lighter">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100">
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-telkomsat-black">
                      Barang Ditemukan
                    </h2>
                    <p className="text-telkomsat-gray mt-1">
                      Konfirmasi lokasi saat ini barang ditemukan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowFoundConfirm(false);
                    setFoundItemData(null);
                    setFoundLokasi("");
                  }}
                  className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-telkomsat-gray" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Info Barang */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-800 mb-1">Barang yang Ditemukan:</p>
                <p className="text-base font-bold text-telkomsat-black">{foundItemData.nama}</p>
                {foundItemData.lokasiSaatIni && (
                  <p className="text-xs text-green-700 mt-1">
                    Lokasi terakhir: {foundItemData.lokasiSaatIni}
                  </p>
                )}
              </div>

              {/* Input Lokasi */}
              <div>
                <label className="block text-sm font-semibold text-telkomsat-black mb-2">
                  Lokasi Ditemukan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={foundLokasi}
                  onChange={(e) => setFoundLokasi(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all bg-white"
                  placeholder="Contoh: Gudang, Site ABC, Ruang Spare"
                  autoFocus
                />
                <p className="text-xs text-telkomsat-gray mt-2">
                  Pastikan lokasi sesuai dengan tempat barang ditemukan
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowFoundConfirm(false);
                  setFoundItemData(null);
                  setFoundLokasi("");
                }}
                className="flex-1 px-4 py-3 border-2 border-telkomsat-gray-light text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-colors font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmFound}
                disabled={!foundLokasi.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:shadow-xl transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Konfirmasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Dismantle */}
      {showDismantleForm && dismantleItemId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl animate-scale-in w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-telkomsat-gray-lighter">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100">
                    <Package className="w-7 h-7 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-telkomsat-black">
                      Pilih Kondisi Dismantle
                    </h2>
                    <p className="text-telkomsat-gray mt-1">
                      Pilih kondisi barang setelah dismantle
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDismantleForm(false);
                    setDismantleItemId(null);
                    setKondisiDismantle("Bagus");
                  }}
                  className="p-2 hover:bg-telkomsat-gray-lighter rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-telkomsat-gray" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <button
                  onClick={() => setKondisiDismantle("Bagus")}
                  className={`w-full flex items-center justify-center space-x-3 px-4 py-4 rounded-xl border-2 transition-all ${
                    kondisiDismantle === "Bagus"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <CheckCircle className="w-6 h-6" />
                  <div className="text-left">
                    <p className="font-semibold">Bagus</p>
                    <p className="text-xs opacity-75">Status: Tersedia, bisa dibawa ke lokasi</p>
                  </div>
                </button>
                <button
                  onClick={() => setKondisiDismantle("Rusak")}
                  className={`w-full flex items-center justify-center space-x-3 px-4 py-4 rounded-xl border-2 transition-all ${
                    kondisiDismantle === "Rusak"
                      ? "border-red-600 bg-red-50 text-red-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                  <div className="text-left">
                    <p className="font-semibold">Rusak</p>
                    <p className="text-xs opacity-75">Status: Rusak</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-telkomsat-gray-lighter bg-telkomsat-gray-lighter/30 flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowDismantleForm(false);
                  setDismantleItemId(null);
                  setKondisiDismantle("Bagus");
                }}
                className="flex-1 px-4 py-3 border-2 border-telkomsat-gray-light text-telkomsat-black rounded-xl hover:bg-telkomsat-gray-lighter transition-colors font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDismantle}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:shadow-xl transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
              >
                <Package className="w-5 h-5" />
                <span>Konfirmasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
