/**
 * Firebase transaction helpers.
 *
 * Design notes:
 * - All Firestore writes that affect stock levels use runTransaction() for atomicity.
 * - Notifications are best-effort (try/catch) so a notification failure never rolls
 *   back a committed transaction.
 * - stokTotal represents the total quantity across ALL locations (gudang + lapangan).
 *   Therefore MOVE does NOT reduce stokTotal (the item is still "owned", just relocated).
 *   Only DAMAGE reduces both stokGudang and stokTotal (item is effectively lost/unusable).
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
  getDoc,
  runTransaction,
  limit as limitQuery,
  orderBy,
  startAfter,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS } from "./collections";
import { Transaksi, SessionKeranjang, SessionKeranjangItem, StatusBarang, SparepartItem, UserRole } from "@/types";
import { getSparepartById, updateSparepart } from "./spareparts";
import { createSparepartItem, getSparepartItemById, updateSparepartItem } from "./sparepartItems";
import { SYSTEM_NOTIFICATION_ROLES, createNotification } from "./notifications";
import { mapFirestoreDoc, mapFirestoreDocs } from "./utils/mappers";

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Strip undefined fields — Firestore rejects `undefined` values. */
const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;

// ─── Status resolution helpers ────────────────────────────────────────────────

/**
 * Derives the `statusBarang` value from a cart item's action and condition fields.
 * Extracted to avoid duplicating the same switch logic across the two code paths
 * (individual items vs. sparepart catalogue fallback).
 */
function resolveStatusBarang(item: SessionKeranjangItem): StatusBarang {
  const { jenisAksi, kondisiDismantle, kondisiBarang } = item;

  if (jenisAksi === "DAMAGE") return "Rusak";
  if (jenisAksi === "DISMANTLE" && kondisiDismantle === "Rusak") return "Rusak";
  if (jenisAksi === "FOUND" && kondisiBarang === "Rusak") return "Rusak";

  if (jenisAksi === "DISMANTLE" && kondisiDismantle === "Tidak Diketahui") return "Perlu Pengecekan";
  if (jenisAksi === "FOUND" && kondisiBarang === "Tidak Diketahui") return "Perlu Pengecekan";

  return "Normal";
}

/**
 * Builds optional/conditional fields that are appended to a transaction object.
 * Eliminates the near-identical blocks that previously existed for each code path.
 */
function buildTransactionOptionalFields(
  item: SessionKeranjangItem,
  lokasiTujuan: string,
  keterangan?: string,
  fotoUrls?: string[]
): Partial<Omit<Transaksi, "id" | "createdAt">> {
  const fields: Partial<Omit<Transaksi, "id" | "createdAt">> = {};

  const shouldSetLokasiTujuan =
    item.jenisAksi === "MOVE" ||
    item.jenisAksi === "FOUND" ||
    (item.jenisAksi === "DISMANTLE" && item.kondisiDismantle === "Bagus");

  if (shouldSetLokasiTujuan && lokasiTujuan) {
    fields.lokasiTujuan = lokasiTujuan;
  }

  if (item.jenisAksi === "FOUND") {
    if (item.lokasiDitemukan) fields.lokasiTujuan = item.lokasiDitemukan;
    fields.keterangan = [
      item.lokasiDitemukan ? `Barang ditemukan di ${item.lokasiDitemukan}` : "Barang ditemukan",
      item.kondisiBarang ? `Kondisi: ${item.kondisiBarang}` : undefined,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (item.jenisAksi === "DISMANTLE" && item.kondisiDismantle) {
    fields.keterangan = `Dismantle - Kondisi: ${item.kondisiDismantle}`;
  }

  // Explicit keterangan from caller overrides computed value (except for FOUND)
  if (keterangan?.trim() && item.jenisAksi !== "FOUND") {
    fields.keterangan = keterangan.trim();
  }

  if (fotoUrls && fotoUrls.length > 0) {
    fields.fotoUrl = fotoUrls;
  }

  return fields;
}

// ─── createTransaction ───────────────────────────────────────────────────────

export const createTransaction = async (
  transaction: Omit<Transaksi, "id" | "createdAt">
): Promise<string> => {
  try {
    const cleanTransaction = removeUndefined(transaction);
    const transactionData = {
      ...cleanTransaction,
      createdAt: Timestamp.now(),
    };

    const docRef = doc(collection(db, COLLECTIONS.TRANSAKSI));

    await runTransaction(db, async (tx) => {
      const sparepartRef = transaction.idSparepart
        ? doc(db, COLLECTIONS.SPAREPARTS, transaction.idSparepart)
        : null;
      // Firestore requires every read to happen before the first write.
      const sparepartSnap = sparepartRef ? await tx.get(sparepartRef) : null;
      tx.set(docRef, transactionData);
      if (!sparepartRef || !sparepartSnap?.exists()) return;

      const sparepart = sparepartSnap.data() as { stokGudang?: number; stokTotal?: number };
      const stokGudang = Number(sparepart.stokGudang ?? 0);
      const stokTotal = Number(sparepart.stokTotal ?? 0);

      if (transaction.jenisTransaksi === "MOVE") {
        // MOVE = item relocated from gudang to a site.
        // stokGudang decreases because it left the warehouse.
        // stokTotal does NOT decrease — the item is still owned by the company.
        if (transaction.lokasiAsal === "Gudang" || !transaction.lokasiAsal) {
          tx.update(sparepartRef, {
            stokGudang: Math.max(0, stokGudang - transaction.jumlah),
            updatedAt: Timestamp.now(),
          });
        }
      } else if (transaction.jenisTransaksi === "DAMAGE") {
        // DAMAGE = item is damaged/lost — reduce both counters.
        tx.update(sparepartRef, {
          stokGudang: Math.max(0, stokGudang - transaction.jumlah),
          stokTotal: Math.max(0, stokTotal - transaction.jumlah),
          updatedAt: Timestamp.now(),
        });
      } else if (transaction.jenisTransaksi === "RETURN") {
        // RETURN = item comes back to gudang — increase stokGudang.
        tx.update(sparepartRef, {
          stokGudang: stokGudang + transaction.jumlah,
          updatedAt: Timestamp.now(),
        });
      }
      // FOUND and DISMANTLE do not affect aggregate stock counters.
    });

    // Notification is best-effort — failure never rolls back the committed transaction.
    try {
      await createNotification({
        title: "Transaksi barang",
        message: `${transaction.carriedByName || transaction.namaPenerima || transaction.namaTeknisi} melakukan transaksi ${transaction.jenisTransaksi} untuk ${transaction.namaItem || "item sparepart"}.`,
        actorName: transaction.carriedByName || transaction.namaPenerima || transaction.namaTeknisi,
        actorRole: transaction.carriedByRole || transaction.jabatanPenerima,
        targetRoles: SYSTEM_NOTIFICATION_ROLES,
        targetUids: transaction.idPenerima ? [transaction.idPenerima] : [],
        link: "/laporan",
        type: "transaction",
      });
    } catch (notificationError) {
      console.warn("[createTransaction] Notification failed (non-fatal):", notificationError);
    }

    return docRef.id;
  } catch (error) {
    console.error("[createTransaction] Error:", error);
    throw error;
  }
};

// ─── submitCartTransaction ────────────────────────────────────────────────────

export const submitCartTransaction = async (
  sessionItems: SessionKeranjangItem[],
  namaTeknisi: string,
  lokasiTujuan: string,
  keterangan?: string,
  fotoUrls?: string[],
  metadata?: Partial<
    Pick<
      Transaksi,
      | "jabatanPenerima"
      | "namaPenerima"
      | "idPenerima"
      | "nomorSpt"
      | "requestedByUid"
      | "requestedByName"
      | "requestedByRole"
      | "carriedByName"
      | "carriedByRole"
      | "approvedByName"
      | "approvedByRole"
      | "approvedByUid"
      | "approvedAt"
    >
  >
): Promise<void> => {
  const requesterUid = metadata?.requestedByUid;
  const requesterName = metadata?.requestedByName;
  if (!requesterUid || !requesterName) {
    throw new Error("Identitas pengaju transaksi wajib diisi");
  }
  const requestedAt = new Date();
  try {
    const transactions = await Promise.all(
      sessionItems.map(async (item) => {
        // Try sparepart_items first (individual tracked items with SN)
        const itemData = await getSparepartItemById(item.idSparepart);

        if (itemData) {
          // Update the physical item's status (best-effort — guest users may lack permission)
          try {
            await updateSparepartItemStatus(item, itemData, lokasiTujuan);
          } catch (updateError) {
            console.warn("[submitCartTransaction] Item status update failed (permission — OK for guests):", updateError);
          }

          const baseTransaction: Omit<Transaksi, "id" | "createdAt"> = {
            idSparepart: item.idSparepart,
            namaTeknisi,
            carriedByName: metadata?.namaPenerima || namaTeknisi,
            carriedByRole: metadata?.jabatanPenerima,
            ...removeUndefined(metadata || {}),
            jenisTransaksi: item.jenisAksi,
            lokasiAsal: itemData.lokasiSaatIni || "Gudang",
            jumlah: 1,
            statusBarang: resolveStatusBarang(item),
            namaItem: itemData.namaPerangkat,
            ...(itemData.tagging ? { tagging: itemData.tagging } : {}),
            ...(itemData.serialNumber ? { serialNumber: itemData.serialNumber } : {}),
            ...buildTransactionOptionalFields(item, lokasiTujuan, keterangan, fotoUrls),
            requestedByUid: requesterUid,
            requestedByName: requesterName,
            requestedByRole: metadata?.requestedByRole,
            requestedAt,
            statusTransaksi: "completed",
          };

          return baseTransaction;
        }

        // Fallback: catalogue-level sparepart (no individual item tracking)
        const sparepart = await getSparepartById(item.idSparepart);
        if (sparepart) {
          const baseTransaction: Omit<Transaksi, "id" | "createdAt"> = {
            idSparepart: item.idSparepart,
            namaTeknisi,
            carriedByName: metadata?.namaPenerima || namaTeknisi,
            carriedByRole: metadata?.jabatanPenerima,
            ...removeUndefined(metadata || {}),
            jenisTransaksi: item.jenisAksi,
            lokasiAsal: sparepart.lokasiDefault,
            jumlah: 1,
            statusBarang: resolveStatusBarang(item),
            namaItem: sparepart.namaSpare,
            ...buildTransactionOptionalFields(item, lokasiTujuan, keterangan, fotoUrls),
            requestedByUid: requesterUid,
            requestedByName: requesterName,
            requestedByRole: metadata?.requestedByRole,
            requestedAt,
            statusTransaksi: "completed",
          };

          return baseTransaction;
        }

        throw new Error(`Item ${item.idSparepart} tidak ditemukan di database`);
      })
    );

    await Promise.all(transactions.map((trans) => createTransaction(trans)));
  } catch (error) {
    console.error("[submitCartTransaction] Error:", error);
    throw error;
  }
};

/** Updates a SparepartItem's status fields based on the cart action. */
async function updateSparepartItemStatus(
  item: SessionKeranjangItem,
  itemData: Awaited<ReturnType<typeof getSparepartItemById>> & object,
  lokasiTujuan: string
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};

  switch (item.jenisAksi) {
    case "MOVE":
      updatePayload.lokasiSaatIni = lokasiTujuan;
      updatePayload.status = "Digunakan";
      break;

    case "DAMAGE":
      updatePayload.status = "Rusak";
      if (lokasiTujuan) updatePayload.lokasiSaatIni = lokasiTujuan;
      break;

    case "FOUND": {
      const kondisi = item.kondisiBarang;
      updatePayload.lokasiSaatIni = item.lokasiDitemukan || lokasiTujuan;
      updatePayload.cariFisik = "Sesuai";
      updatePayload.status =
        kondisi === "Tidak Diketahui" ? "Perlu Pengecekan" : kondisi === "Rusak" ? "Rusak" : "Tersedia";
      break;
    }

    case "DISMANTLE": {
      const kondisi = item.kondisiDismantle;
      if (lokasiTujuan) updatePayload.lokasiSaatIni = lokasiTujuan;
      updatePayload.status =
        kondisi === "Rusak" ? "Rusak" : kondisi === "Tidak Diketahui" ? "Perlu Pengecekan" : "Tersedia";
      break;
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await updateSparepartItem(item.idSparepart, updatePayload as Parameters<typeof updateSparepartItem>[1]);
  }
}

// ─── submitCartApprovalRequest ────────────────────────────────────────────────

export const submitCartApprovalRequest = async (
  sessionItems: SessionKeranjangItem[],
  namaTeknisi: string,
  lokasiTujuan: string,
  keterangan?: string,
  fotoUrls?: string[],
  metadata?: Partial<
    Pick<
      Transaksi,
      | "jabatanPenerima"
      | "namaPenerima"
      | "idPenerima"
      | "carriedByName"
      | "carriedByRole"
      | "nomorSpt"
      | "requestedByUid"
      | "requestedByName"
      | "requestedByRole"
      | "approvedByName"
      | "approvedByRole"
      | "approvedByUid"
      | "approvedAt"
    >
  >
): Promise<void> => {
  const requesterUid = metadata?.requestedByUid || metadata?.idPenerima || "";
  const requesterName = metadata?.requestedByName || metadata?.carriedByName || metadata?.namaPenerima || namaTeknisi;
  const requesterRole = metadata?.requestedByRole || metadata?.carriedByRole || metadata?.jabatanPenerima || "teknisi";
  const nomorSpt = metadata?.nomorSpt?.trim() || "";

  if (!requesterUid) {
    throw new Error("Pengaju transaksi harus terautentikasi (UID wajib)");
  }

  // Validate required nomorSpt for OUT and MOVE
  for (const item of sessionItems) {
    if ((item.jenisAksi === "OUT" || item.jenisAksi === "MOVE") && !nomorSpt) {
      throw new Error("Nomor SPT wajib diisi untuk transaksi Barang Keluar (OUT) dan Pemindahan (MOVE)");
    }
  }

  const requestDetails = await Promise.all(
    sessionItems.map(async (item) => {
      const lockRef = doc(db, COLLECTIONS.ITEM_LOCKS, item.idSparepart);
      const txRef = doc(collection(db, COLLECTIONS.TRANSAKSI));

      return await runTransaction(db, async (tx) => {
        // 1. Check reservation lock atomically
        const lockSnap = await tx.get(lockRef);
        if (lockSnap.exists() && lockSnap.data().status === "pending") {
          throw new Error(
            `Item ${item.idSparepart} sedang mempunyai pengajuan pending aktif dan tidak dapat diajukan dua kali.`
          );
        }

        // 2. Read item details without mutating sparepart_items
        const itemRef = doc(db, COLLECTIONS.SPAREPART_ITEMS, item.idSparepart);
        const itemSnap = await tx.get(itemRef);
        let namaItem = "Sparepart";
        let serialNumber = "";
        let tagging = "";
        let lokasiAsal = "Gudang";
        let kondisiSebelum = "Normal";

        if (itemSnap.exists()) {
          const itemData = itemSnap.data() as SparepartItem;
          namaItem = itemData.namaPerangkat || namaItem;
          serialNumber = itemData.serialNumber || "";
          tagging = itemData.tagging || "";
          lokasiAsal = itemData.lokasiSaatIni || "Gudang";
          kondisiSebelum = itemData.status || "Normal";
        } else {
          const spRef = doc(db, COLLECTIONS.SPAREPARTS, item.idSparepart);
          const spSnap = await tx.get(spRef);
          if (spSnap.exists()) {
            const spData = spSnap.data() as { namaSpare?: string; kodeSpare?: string; lokasiDefault?: string };
            namaItem = spData.namaSpare || namaItem;
            tagging = spData.kodeSpare || "";
            lokasiAsal = spData.lokasiDefault || "Gudang";
          }
        }

        const requestNoteParts = [
          keterangan?.trim(),
          item.jenisAksi === "FOUND" && item.kondisiBarang
            ? `Kondisi ditemukan: ${item.kondisiBarang}`
            : undefined,
          item.jenisAksi === "DISMANTLE" && item.kondisiDismantle
            ? `Kondisi dismantle: ${item.kondisiDismantle}`
            : undefined,
        ].filter(Boolean);

        // 3. Create pending transaction document
        const txPayload: Omit<Transaksi, "id"> = {
          idSparepart: item.idSparepart,
          namaItem,
          serialNumber,
          tagging,
          jenisTransaksi: item.jenisAksi,
          nomorSpt,
          lokasiAsal,
          lokasiTujuan: item.lokasiDitemukan || lokasiTujuan,
          kondisiSebelum,
          kondisiSesudah: kondisiSebelum,
          statusTransaksi: "pending",
          jumlah: 1,
          statusBarang: kondisiSebelum === "Rusak" ? "Rusak" : "Normal",
          requestedByUid: requesterUid,
          requestedByName: requesterName,
          requestedByRole: requesterRole,
          requestedAt: new Date(),
          keterangan: requestNoteParts.join(" - ") || undefined,
          fotoUrl: fotoUrls && fotoUrls.length > 0 ? fotoUrls : undefined,
          createdAt: new Date(),
        };

        tx.set(txRef, {
          ...removeUndefined(txPayload),
          requestedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        });

        // 4. Reserve item lock atomically
        tx.set(lockRef, {
          itemId: item.idSparepart,
          transactionId: txRef.id,
          requestedByUid: requesterUid,
          status: "pending",
          createdAt: Timestamp.now(),
        });

        return [
          namaItem,
          serialNumber ? `SN: ${serialNumber}` : undefined,
          nomorSpt ? `SPT: ${nomorSpt}` : undefined,
          `Aksi: ${item.jenisAksi}`,
          `Tujuan: ${item.lokasiDitemukan || lokasiTujuan}`,
        ]
          .filter(Boolean)
          .join(" - ");
      });
    })
  );

  try {
    await createNotification({
      title: "Pengajuan Transaksi Sparepart",
      message: `${requesterName} mengajukan ${sessionItems.length} item untuk ${lokasiTujuan}${nomorSpt ? ` (SPT: ${nomorSpt})` : ""}.`,
      actorName: requesterName,
      actorRole: requesterRole,
      targetRoles: ["admin_gudang"],
      targetUids: requesterUid ? [requesterUid] : [],
      link: "/spareparts/verifikasi",
      details: requestDetails,
      type: "request",
    });
  } catch (notificationError) {
    console.warn("[submitCartApprovalRequest] Notification failed (non-fatal):", notificationError);
  }
};

// ─── Get Pending Transactions for Verification ────────────────────────────────

export const getPendingTransactions = async (): Promise<Transaksi[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.TRANSAKSI),
      where("statusTransaksi", "==", "pending")
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((docSnap) => mapFirestoreDoc<Transaksi>(docSnap));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error getting pending transactions:", error);
    return [];
  }
};

// ─── Atomic Approval & Rejection (Single Transaction Pipeline) ────────────────

export const executeAtomicApproval = async (
  transactionId: string,
  verifier: { uid: string; name: string; role: UserRole }
): Promise<void> => {
  const txRef = doc(db, COLLECTIONS.TRANSAKSI, transactionId);

  await runTransaction(db, async (tx) => {
    // 1. Read pending transaction document
    const txSnap = await tx.get(txRef);
    if (!txSnap.exists()) {
      throw new Error("Dokumen pengajuan transaksi tidak ditemukan");
    }

    const txData = txSnap.data() as Transaksi;
    if (txData.statusTransaksi !== "pending") {
      throw new Error("Transaksi ini sudah diproses dan tidak berstatus pending");
    }

    const itemId = txData.idSparepart;
    const itemRef = doc(db, COLLECTIONS.SPAREPART_ITEMS, itemId);
    const itemSnap = await tx.get(itemRef);

    const requestedAction = txData.jenisTransaksi || "MOVE";
    const requestedLocation = txData.lokasiTujuan || txData.lokasiAsal || "Gudang";
    const lokasiAsal = txData.lokasiAsal || "Gudang";

    let newStatus = txData.kondisiSebelum || "Tersedia";
    if (requestedAction === "OUT" || requestedAction === "MOVE") {
      newStatus = "Digunakan";
    } else if (requestedAction === "DAMAGE") {
      newStatus = "Rusak";
    } else if (requestedAction === "RETURN") {
      newStatus = "Tersedia";
    }

    // 2. Adjust catalog stock if idSparepart exists
    let catalogSparepartId = itemSnap.exists() ? (itemSnap.data() as SparepartItem).idSparepart : itemId;
    if (catalogSparepartId) {
      const spRef = doc(db, COLLECTIONS.SPAREPARTS, catalogSparepartId);
      const spSnap = await tx.get(spRef);
      if (spSnap.exists()) {
        const sp = spSnap.data() as { stokGudang?: number; stokTotal?: number };
        const stokGudang = Number(sp.stokGudang ?? 0);
        const stokTotal = Number(sp.stokTotal ?? 0);

        if (requestedAction === "OUT" || requestedAction === "MOVE") {
          if (lokasiAsal === "Gudang" || !lokasiAsal) {
            tx.update(spRef, {
              stokGudang: Math.max(0, stokGudang - 1),
              updatedAt: Timestamp.now(),
            });
          }
        } else if (requestedAction === "DAMAGE") {
          tx.update(spRef, {
            stokGudang: Math.max(0, stokGudang - 1),
            stokTotal: Math.max(0, stokTotal - 1),
            updatedAt: Timestamp.now(),
          });
        } else if (requestedAction === "RETURN") {
          if (requestedLocation === "Gudang") {
            tx.update(spRef, {
              stokGudang: stokGudang + 1,
              updatedAt: Timestamp.now(),
            });
          }
        }
      }
    }

    // 3. Update sparepart item location & status
    if (itemSnap.exists()) {
      tx.update(itemRef, {
        lokasiSaatIni: requestedLocation,
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
    }

    // 4. Update the SAME transaction document to completed
    tx.update(txRef, {
      statusTransaksi: "completed",
      kondisiSesudah: newStatus,
      approvedByUid: verifier.uid,
      approvedByName: verifier.name,
      approvedByRole: verifier.role,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // 5. Release reservation item lock
    const lockRef = doc(db, COLLECTIONS.ITEM_LOCKS, itemId);
    tx.delete(lockRef);
  });
};

export const executeAtomicRejection = async (
  transactionId: string,
  verifier: { uid: string; name: string; role: UserRole },
  rejectReason: string
): Promise<void> => {
  const txRef = doc(db, COLLECTIONS.TRANSAKSI, transactionId);

  await runTransaction(db, async (tx) => {
    // 1. Read pending transaction document
    const txSnap = await tx.get(txRef);
    if (!txSnap.exists()) {
      throw new Error("Dokumen pengajuan transaksi tidak ditemukan");
    }

    const txData = txSnap.data() as Transaksi;
    if (txData.statusTransaksi !== "pending") {
      throw new Error("Transaksi ini sudah diproses dan tidak berstatus pending");
    }

    const itemId = txData.idSparepart;

    // 2. Update SAME transaction document to rejected (Item location & stock remain UNTOUCHED)
    tx.update(txRef, {
      statusTransaksi: "rejected",
      rejectedByUid: verifier.uid,
      rejectedByName: verifier.name,
      rejectedByRole: verifier.role,
      rejectedAt: Timestamp.now(),
      rejectReason: rejectReason.trim(),
      updatedAt: Timestamp.now(),
    });

    // 3. Release reservation item lock
    const lockRef = doc(db, COLLECTIONS.ITEM_LOCKS, itemId);
    tx.delete(lockRef);
  });
};

// ─── getTransactions ──────────────────────────────────────────────────────────

/**
 * Fetches transactions from Firestore.
 *
 * Notes:
 * - Only `idSparepart` + date range are filtered server-side (Firestore limitations).
 * - `jenisTransaksi` and `namaTeknisi` filters are applied in-memory after fetch.
 *   TODO: Add composite indexes for these fields to move filtering server-side.
 */
export const getTransactions = async (
  filters?: {
    idSparepart?: string;
    namaTeknisi?: string;
    jenisTransaksi?: "OUT" | "MOVE" | "DAMAGE" | "RETURN" | "FOUND" | "DISMANTLE";
    requestedByUid?: string;
    startDate?: Date;
    endDate?: Date;
  },
  maxLimit: number | null = 100
): Promise<Transaksi[]> => {
  try {
    let q = query(
      collection(db, COLLECTIONS.TRANSAKSI),
      orderBy("createdAt", "desc"),
      limitQuery(maxLimit ?? 200)
    );

    if (filters?.idSparepart) {
      // Always include orderBy to use the composite index (idSparepart ASC, createdAt DESC).
      // This is required for pagination (startAfter) when maxLimit is null.
      q = query(
            collection(db, COLLECTIONS.TRANSAKSI),
            where("idSparepart", "==", filters.idSparepart),
            orderBy("createdAt", "desc"),
            limitQuery(maxLimit ?? 200)
          );
    }
    if (filters?.requestedByUid) {
      q = !filters.idSparepart && !filters.startDate && !filters.endDate
        ? query(collection(db, COLLECTIONS.TRANSAKSI), where("requestedByUid", "==", filters.requestedByUid), limitQuery(maxLimit ?? 200))
        : query(q, where("requestedByUid", "==", filters.requestedByUid));
    }
    if (filters?.startDate) {
      q = query(q, where("createdAt", ">=", Timestamp.fromDate(filters.startDate)));
    }
    if (filters?.endDate) {
      q = query(q, where("createdAt", "<=", Timestamp.fromDate(filters.endDate)));
    }

    let snapshot = await getDocs(q);
    let rows = mapFirestoreDocs<Transaksi>(snapshot.docs);
    // Explicitly unlimited reads (reports/list) still fetch bounded pages.
    while (maxLimit === null && snapshot.docs.length === 200) {
      snapshot = await getDocs(query(q, startAfter(snapshot.docs[snapshot.docs.length - 1])));
      rows.push(...mapFirestoreDocs<Transaksi>(snapshot.docs));
    }

    // In-memory filters (until composite indexes are added for these fields)
    if (filters?.jenisTransaksi) {
      rows = rows.filter((t) => t.jenisTransaksi === filters.jenisTransaksi);
    }
    if (filters?.namaTeknisi?.trim()) {
      const target = filters.namaTeknisi.trim();
      rows = rows.filter(
        (t) =>
          ((t.carriedByName || t.namaPenerima || t.namaTeknisi) ?? "").trim() === target
      );
    }

    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error("[getTransactions] Error:", error);
    throw error;
  }
};

// ─── Session cart persistence ──────────────────────────────────────────────────

export const saveSessionCart = async (
  sessionToken: string,
  namaTeknisi: string,
  jenisTeknisi?: "freelance" | "karyawan" | "vendor"
): Promise<string> => {
  try {
    const sessionData: Omit<SessionKeranjang, "id" | "createdAt" | "updatedAt"> = {
      sessionToken,
      namaTeknisi,
      jenisTeknisi,
      status: "aktif",
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.SESSION_KERANJANG), {
      ...sessionData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error("[saveSessionCart] Error:", error);
    throw error;
  }
};

export const saveSessionCartItems = async (
  sessionId: string,
  items: Omit<SessionKeranjangItem, "id" | "createdAt">[]
): Promise<void> => {
  try {
    await Promise.all(
      items.map((item) =>
        addDoc(collection(db, COLLECTIONS.SESSION_KERANJANG_ITEM), {
          ...item,
          idSessionKeranjang: sessionId,
          createdAt: Timestamp.now(),
        })
      )
    );
  } catch (error) {
    console.error("[saveSessionCartItems] Error:", error);
    throw error;
  }
};
