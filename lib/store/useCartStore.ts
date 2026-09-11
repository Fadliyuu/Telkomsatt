import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SessionKeranjangItem, JenisTeknisi, KondisiDismantle } from "@/types";
import { generateSessionToken } from "@/lib/utils";

interface CartState {
  sessionToken: string | null;
  namaTeknisi: string | null;
  jenisTeknisi: JenisTeknisi | null;
  items: SessionKeranjangItem[];
  initSession: (namaTeknisi: string, jenisTeknisi?: JenisTeknisi) => void;
  addItem: (idSparepart: string, jenisAksi: "MOVE" | "DAMAGE" | "FOUND" | "DISMANTLE", lokasiDitemukan?: string, kondisiDismantle?: KondisiDismantle, kondisiBarang?: KondisiDismantle) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  clearSession: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      sessionToken: null,
      namaTeknisi: null,
      jenisTeknisi: null,
      items: [],
      initSession: (namaTeknisi, jenisTeknisi) => {
        const token = generateSessionToken();
        set({
          sessionToken: token,
          namaTeknisi,
          jenisTeknisi: jenisTeknisi || null,
        });
      },
      addItem: (idSparepart, jenisAksi, lokasiDitemukan, kondisiDismantle, kondisiBarang) => {
        const newItem: SessionKeranjangItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          idSessionKeranjang: get().sessionToken || "",
          idSparepart,
          jenisAksi,
          lokasiDitemukan: jenisAksi === "FOUND" ? lokasiDitemukan : undefined,
          kondisiDismantle: jenisAksi === "DISMANTLE" ? kondisiDismantle : undefined,
          kondisiBarang: jenisAksi === "FOUND" ? kondisiBarang : undefined,
          createdAt: new Date(),
        };
        set({ items: [...get().items, newItem] });
      },
      removeItem: (id) => {
        set({ items: get().items.filter((item) => item.id !== id) });
      },
      clearCart: () => {
        set({ items: [] });
      },
      clearSession: () => {
        set({
          sessionToken: null,
          namaTeknisi: null,
          jenisTeknisi: null,
          items: [],
        });
      },
    }),
    {
      name: "cart-storage",
    }
  )
);

