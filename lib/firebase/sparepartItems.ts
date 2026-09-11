import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS } from "./collections";
import { SparepartItem, USER_ROLE_LABELS, UserRole } from "@/types";
import {
  NotificationActor,
  SYSTEM_NOTIFICATION_ROLES,
  createNotification,
  createSystemNotification,
  formatNotificationActor,
} from "./notifications";
import QRCode from "qrcode";
import { generateQRCodeUrl } from "@/lib/utils";

import { mapFirestoreDoc, mapFirestoreDocs } from "./utils/mappers";

export const COLLECTION_SPAREPART_ITEMS = COLLECTIONS.SPAREPART_ITEMS;

// Interface untuk pagination
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}

// Get items with default query limit to prevent unpaginated memory leaks
export const getSparepartItems = async (
  idSparepart?: string,
  maxLimit: number = 50
): Promise<SparepartItem[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      orderBy("createdAt", "desc"),
      limit(maxLimit)
    );
    if (idSparepart) {
      q = query(
        collection(db, COLLECTION_SPAREPART_ITEMS),
        where("idSparepart", "==", idSparepart),
        orderBy("createdAt", "desc"),
        limit(maxLimit)
      );
    }

    const snapshot = await getDocs(q);
    return mapFirestoreDocs<SparepartItem>(snapshot.docs);
  } catch (error) {
    console.error("Error getting sparepart items:", error);
    throw error;
  }
};

// Get items with pagination (for large datasets)
export const getSparepartItemsPaginated = async (
  pageSize: number = 20,
  lastDocument?: DocumentSnapshot | null,
  searchQuery?: string
): Promise<PaginatedResult<SparepartItem>> => {
  try {
    // Get total count
    const countSnapshot = await getCountFromServer(
      collection(db, COLLECTION_SPAREPART_ITEMS)
    );
    const total = countSnapshot.data().count;

    // Build query with pagination
    let q = query(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    // If continuing from last document
    if (lastDocument) {
      q = query(
        collection(db, COLLECTION_SPAREPART_ITEMS),
        orderBy("createdAt", "desc"),
        startAfter(lastDocument),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => {
      const docData = doc.data();
      return {
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate() || new Date(),
        updatedAt: docData.updatedAt?.toDate() || new Date(),
      } as SparepartItem;
    });

    const lastDoc = snapshot.docs.length > 0 
      ? snapshot.docs[snapshot.docs.length - 1] 
      : null;

    return {
      data,
      total,
      hasMore: snapshot.docs.length === pageSize,
      lastDoc,
    };
  } catch (error) {
    console.error("Error getting paginated sparepart items:", error);
    throw error;
  }
};

// Get total count only
export const getSparepartItemsCount = async (): Promise<number> => {
  try {
    const countSnapshot = await getCountFromServer(
      collection(db, COLLECTION_SPAREPART_ITEMS)
    );
    return countSnapshot.data().count;
  } catch (error) {
    console.error("Error getting sparepart items count:", error);
    return 0;
  }
};

export const getSparepartItemById = async (
  id: string
): Promise<SparepartItem | null> => {
  try {
    const docRef = doc(db, COLLECTION_SPAREPART_ITEMS, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapFirestoreDoc<SparepartItem>(docSnap);
  } catch (error) {
    console.error("Error getting sparepart item:", error);
    throw error;
  }
};

export const getSparepartItemByTagging = async (
  tagging: string
): Promise<SparepartItem | null> => {
  try {
    if (!tagging?.trim()) return null;

    const q = query(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      where("tagging", "==", tagging.trim())
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    return mapFirestoreDoc<SparepartItem>(snapshot.docs[0]);
  } catch (error) {
    console.error("Error getting sparepart item by tagging:", error);
    throw error;
  }
};

// ─── In-memory cache for unique device names ────────────────────────────────
// This prevents a Firestore read on every autocomplete keystroke.
// TTL: 5 minutes — sufficient freshness for an autocomplete dropdown.
const _namaPerangkatCache: { data: string[] | null; expiresAt: number } = {
  data: null,
  expiresAt: 0,
};
const NAMA_CACHE_TTL_MS = 5 * 60 * 1000;

export const getUniqueNamaPerangkat = async (
  forceRefresh = false
): Promise<string[]> => {
  const now = Date.now();
  if (!forceRefresh && _namaPerangkatCache.data && now < _namaPerangkatCache.expiresAt) {
    return _namaPerangkatCache.data;
  }

  const items = await getSparepartItems(undefined, 500);
  const names = new Set<string>();
  for (const item of items) {
    const nama = item.namaPerangkat?.trim();
    if (nama) names.add(nama);
  }
  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, "id"));

  _namaPerangkatCache.data = sorted;
  _namaPerangkatCache.expiresAt = now + NAMA_CACHE_TTL_MS;

  return sorted;
};

/** Call this after creating/updating a SparepartItem to bust the name cache. */
export function invalidateNamaPerangkatCache(): void {
  _namaPerangkatCache.data = null;
  _namaPerangkatCache.expiresAt = 0;
}

export const findExistingItemBySnOrTag = async (
  serialNumber?: string,
  tagging?: string
): Promise<SparepartItem | null> => {
  const sn = serialNumber?.trim();
  if (sn) {
    const bySn = await getSparepartItemBySN(sn);
    if (bySn) return bySn;
  }
  const tag = tagging?.trim();
  if (tag) {
    return getSparepartItemByTagging(tag);
  }
  return null;
};

export const resolveSparepartItemIdentifier = async (
  identifier: string
): Promise<SparepartItem | null> => {
  const value = identifier.trim();
  if (!value) return null;

  try {
    const byId = await getSparepartItemById(value);
    if (byId) return byId;
  } catch {
    // Not a document ID or not found.
  }

  const bySn = await getSparepartItemBySN(value);
  if (bySn) return bySn;

  return getSparepartItemByTagging(value);
};

/**
 * Search sparepart items by keyword (client-side filter).
 *
 * TODO: Replace with a server-side full-text search (e.g. Algolia or Firestore
 * array-contains) when the dataset grows beyond a few hundred records.
 * Current implementation fetches up to 200 items and filters in-memory.
 */
export const searchSparepartItemSuggestions = async (
  keyword: string,
  maxResults = 8
): Promise<SparepartItem[]> => {
  const term = keyword.trim().toLowerCase();
  if (term.length < 2) return [];

  const rows = await getSparepartItems(undefined, 200);
  return rows
    .filter((item) => {
      const haystack = [
        item.id,
        item.namaPerangkat,
        item.serialNumber,
        item.tagging,
        item.lokasiSaatIni,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    })
    .slice(0, maxResults);
};

export const getSparepartItemBySN = async (
  serialNumber: string
): Promise<SparepartItem | null> => {
  try {
    if (!serialNumber?.trim()) return null;

    const q = query(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      where("serialNumber", "==", serialNumber.trim())
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    // Use mapFirestoreDoc for consistency with the rest of the codebase
    return mapFirestoreDoc<SparepartItem>(snapshot.docs[0]);
  } catch (error) {
    console.error("[getSparepartItemBySN] Error:", error);
    throw error;
  }
};

export const createSparepartItem = async (
  data: Omit<SparepartItem, "id" | "createdAt" | "updatedAt" | "qrCodeUrl" | "tanggalVerifikasi" | "diverifikasiOleh">
): Promise<{ itemId: string; qrCodeDataUrl: string }> => {
  try {
    // Check if SN already exists (only if SN is provided)
    if (data.serialNumber && data.serialNumber.trim()) {
      const existing = await getSparepartItemBySN(data.serialNumber);
      if (existing) {
        throw new Error(`Serial Number ${data.serialNumber} sudah digunakan`);
      }
    }
    if (data.tagging && data.tagging.trim()) {
      const existing = await getSparepartItemByTagging(data.tagging);
      if (existing) {
        throw new Error(`Tag ${data.tagging} sudah digunakan`);
      }
    }

    // Siapkan data item dengan field opsional untuk tracking teknisi
    const itemData: Record<string, unknown> = {
      namaPerangkat: data.namaPerangkat,
      serialNumber: data.serialNumber || "",
      qrCodeUrl: "", // Will be updated after creation (if possible)
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Tambahkan field opsional jika ada
    if (data.idSparepart) itemData.idSparepart = data.idSparepart;
    if (data.tagging) itemData.tagging = data.tagging;
    if (data.cariFisik) itemData.cariFisik = data.cariFisik;
    if (data.lokasiSaatIni) itemData.lokasiSaatIni = data.lokasiSaatIni;
    if (data.status) itemData.status = data.status;
    if (data.keterangan) itemData.keterangan = data.keterangan;
    if (data.fotoUrl) itemData.fotoUrl = data.fotoUrl;
    
    // Field untuk tracking item yang ditambahkan oleh teknisi
    // PENTING: perluVerifikasi HARUS ada untuk guest users (Firebase rules requirement)
    if (data.ditambahkanOleh) itemData.ditambahkanOleh = data.ditambahkanOleh;
    if (data.jenisTeknisi) itemData.jenisTeknisi = data.jenisTeknisi;
    if (data.carriedByName) itemData.carriedByName = data.carriedByName;
    if (data.carriedByRole) itemData.carriedByRole = data.carriedByRole;
    if (data.requestedByUid) itemData.requestedByUid = data.requestedByUid;
    if (data.requestedAction) itemData.requestedAction = data.requestedAction;
    if (data.requestedLocation) itemData.requestedLocation = data.requestedLocation;
    if (data.requestNote) itemData.requestNote = data.requestNote;
    if (data.requestFotoUrl) itemData.requestFotoUrl = data.requestFotoUrl;
    // Selalu set perluVerifikasi jika ada
    if (data.perluVerifikasi !== undefined) {
      itemData.perluVerifikasi = data.perluVerifikasi;
    }

    const docRef = await addDoc(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      itemData
    );

    const actualQrUrl = generateQRCodeUrl(docRef.id);
    let qrCodeDataUrl = "";
    try {
      qrCodeDataUrl = await QRCode.toDataURL(actualQrUrl);
    } catch (qrError) {
      console.warn("Could not generate QR data URL:", qrError);
    }

    // Try to update with actual QR URL (may fail for guest users - that's OK)
    try {
      await updateDoc(docRef, {
        qrCodeUrl: actualQrUrl,
      });
    } catch (updateError) {
      // Guest users can't update - QR URL will be set by admin during verification
      console.warn("Could not update QR URL (permission issue - normal for guest users):", updateError);
    }

    try {
      const actorName = data.carriedByName || data.ditambahkanOleh || "User";
      const needsApproval = data.perluVerifikasi === true;
      await createNotification({
        title: needsApproval ? "Permintaan item baru" : "Barang ditambahkan",
        message: needsApproval
          ? `${actorName} mengajukan ${data.namaPerangkat} untuk approval.`
          : `${actorName}${
              data.carriedByRole ? ` (${USER_ROLE_LABELS[data.carriedByRole]})` : ""
            } menambahkan ${data.namaPerangkat} ke data sparepart.`,
        actorName,
        actorRole: data.carriedByRole,
        targetRoles: needsApproval
          ? ["admin_gudang", "supervisor", "manager"]
          : SYSTEM_NOTIFICATION_ROLES,
        targetUids: data.requestedByUid ? [data.requestedByUid] : [],
        link: needsApproval ? "/spareparts/verifikasi" : `/item/${docRef.id}`,
        details: [
          [
            data.namaPerangkat,
            data.serialNumber ? `SN: ${data.serialNumber}` : undefined,
            data.tagging ? `Tag: ${data.tagging}` : undefined,
            data.lokasiSaatIni ? `Lokasi: ${data.lokasiSaatIni}` : undefined,
            data.status ? `Status: ${data.status}` : undefined,
          ]
            .filter(Boolean)
            .join(" - "),
        ],
        type: needsApproval ? "request" : "transaction",
      });
    } catch (notificationError) {
      console.warn("Could not create item notification:", notificationError);
    }

    return {
      itemId: docRef.id,
      qrCodeDataUrl,
    };
  } catch (error: unknown) {
    console.error("Error creating sparepart item:", error);
    throw error;
  }
};

export const updateSparepartItem = async (
  id: string,
  data: Partial<Omit<SparepartItem, "id" | "createdAt" | "updatedAt">>,
  options?: { notify?: boolean; actor?: NotificationActor }
): Promise<void> => {
  try {
    // If updating SN, check if it's unique
    if (data.serialNumber) {
      const existing = await getSparepartItemBySN(data.serialNumber);
      if (existing && existing.id !== id) {
        throw new Error(`Serial Number ${data.serialNumber} sudah digunakan`);
      }
    }

    const docRef = doc(db, COLLECTION_SPAREPART_ITEMS, id);
    await updateDoc(
      docRef,
      Object.fromEntries(
        Object.entries({
          ...data,
          updatedAt: Timestamp.now(),
        }).filter(([, value]) => value !== undefined)
      )
    );

    if (options?.notify !== false) {
      await createSystemNotification({
        title: "Item sparepart diperbarui",
        message: `${formatNotificationActor(options?.actor)} memperbarui ${
          data.namaPerangkat || data.serialNumber || data.tagging || "data item"
        }.`,
        actorName: options?.actor?.name,
        actorRole: options?.actor?.role,
        link: `/item/${id}`,
        details: [
          [
            data.namaPerangkat,
            data.serialNumber ? `SN: ${data.serialNumber}` : undefined,
            data.tagging ? `Tag: ${data.tagging}` : undefined,
            data.lokasiSaatIni ? `Lokasi: ${data.lokasiSaatIni}` : undefined,
            data.cariFisik ? `Cari fisik: ${data.cariFisik}` : undefined,
            data.status ? `Status: ${data.status}` : undefined,
          ]
            .filter(Boolean)
            .join(" - "),
        ],
      });
    }
  } catch (error: unknown) {
    console.error("Error updating sparepart item:", error);
    throw error;
  }
};

export const deleteSparepartItem = async (
  id: string,
  actor?: NotificationActor
): Promise<void> => {
  try {
    const item = await getSparepartItemById(id).catch(() => null);
    const docRef = doc(db, COLLECTION_SPAREPART_ITEMS, id);
    await deleteDoc(docRef);
    await createSystemNotification({
      title: "Item sparepart dihapus",
      message: `${formatNotificationActor(actor)} menghapus ${
        item?.namaPerangkat || item?.serialNumber || "item sparepart"
      } dari data sparepart.`,
      actorName: actor?.name,
      actorRole: actor?.role,
      link: "/spareparts",
      details: item
        ? [
            [
              item.namaPerangkat,
              item.serialNumber ? `SN: ${item.serialNumber}` : undefined,
              item.tagging ? `Tag: ${item.tagging}` : undefined,
              item.lokasiSaatIni ? `Lokasi: ${item.lokasiSaatIni}` : undefined,
              item.status ? `Status: ${item.status}` : undefined,
            ]
              .filter(Boolean)
              .join(" - "),
          ]
        : undefined,
    });
  } catch (error) {
    console.error("Error deleting sparepart item:", error);
    throw error;
  }
};

// Delete multiple items
export const deleteMultipleSparepartItems = async (
  ids: string[],
  actor?: NotificationActor
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const results = { success: 0, failed: 0, errors: [] as string[] };
  const itemDetails: string[] = [];

  for (const id of ids) {
    try {
      const item = await getSparepartItemById(id).catch(() => null);
      await deleteDoc(doc(db, COLLECTION_SPAREPART_ITEMS, id));
      if (item) {
        itemDetails.push(
          [
            item.namaPerangkat,
            item.serialNumber ? `SN: ${item.serialNumber}` : undefined,
            item.tagging ? `Tag: ${item.tagging}` : undefined,
            item.lokasiSaatIni ? `Lokasi: ${item.lokasiSaatIni}` : undefined,
            item.status ? `Status: ${item.status}` : undefined,
          ]
            .filter(Boolean)
            .join(" - ")
        );
      }
      results.success++;
    } catch (error: unknown) {
      results.failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Gagal menghapus item ${id}: ${message}`);
    }
  }

  if (results.success > 0) {
    await createSystemNotification({
      title: "Item sparepart dihapus massal",
      message: `${formatNotificationActor(actor)} menghapus ${results.success} item dari data sparepart.`,
      actorName: actor?.name,
      actorRole: actor?.role,
      link: "/spareparts",
      details: itemDetails,
    });
  }

  return results;
};

// Update multiple items
export const updateMultipleSparepartItems = async (
  ids: string[],
  data: Partial<Omit<SparepartItem, "id" | "createdAt" | "updatedAt">>,
  actor?: NotificationActor
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const results = { success: 0, failed: 0, errors: [] as string[] };
  const itemDetails: string[] = [];

  for (const id of ids) {
    try {
      const item = await getSparepartItemById(id).catch(() => null);
      await updateSparepartItem(id, data, { notify: false });
      if (item) {
        itemDetails.push(
          [
            item.namaPerangkat,
            item.serialNumber ? `SN: ${item.serialNumber}` : undefined,
            item.tagging ? `Tag: ${item.tagging}` : undefined,
            data.cariFisik ? `Cari fisik -> ${data.cariFisik}` : undefined,
            data.status ? `Status -> ${data.status}` : undefined,
            data.lokasiSaatIni ? `Lokasi -> ${data.lokasiSaatIni}` : undefined,
          ]
            .filter(Boolean)
            .join(" - ")
        );
      }
      results.success++;
    } catch (error: unknown) {
      results.failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Gagal update item ${id}: ${message}`);
    }
  }

  if (results.success > 0) {
    const changedFields = [
      data.cariFisik ? `cari fisik: ${data.cariFisik}` : undefined,
      data.status ? `status: ${data.status}` : undefined,
      data.lokasiSaatIni ? `lokasi: ${data.lokasiSaatIni}` : undefined,
    ]
      .filter(Boolean)
      .join(", ");

    await createSystemNotification({
      title: "Item sparepart diperbarui massal",
      message: `${formatNotificationActor(actor)} memperbarui ${results.success} item${
        changedFields ? ` (${changedFields})` : ""
      }.`,
      actorName: actor?.name,
      actorRole: actor?.role,
      link: "/spareparts",
      details: itemDetails,
    });
  }

  return results;
};

export const bulkCreateSparepartItems = async (
  items: Omit<SparepartItem, "id" | "createdAt" | "updatedAt">[]
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const item of items) {
    try {
      await createSparepartItem(item);
      results.success++;
    } catch (error: unknown) {
      results.failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`${item.serialNumber}: ${message}`);
    }
  }

  return results;
};

// Get items yang perlu diverifikasi oleh admin
export const getItemsPerluVerifikasi = async (): Promise<SparepartItem[]> => {
  try {
    // Query sederhana tanpa orderBy untuk menghindari composite index
    const q = query(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      where("perluVerifikasi", "==", true)
    );

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        tanggalVerifikasi: data.tanggalVerifikasi?.toDate() || undefined,
      } as SparepartItem;
    });
    
    // Sort di client-side untuk menghindari kebutuhan composite index
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error("Error getting items perlu verifikasi:", error);
    throw error;
  }
};

// Get count items yang perlu diverifikasi
export const getItemsPerluVerifikasiCount = async (): Promise<number> => {
  try {
    // Gunakan query sederhana
    const q = query(
      collection(db, COLLECTION_SPAREPART_ITEMS),
      where("perluVerifikasi", "==", true)
    );
    
    // Coba gunakan getCountFromServer dulu, jika gagal fallback ke getDocs
    try {
      const countSnapshot = await getCountFromServer(q);
      return countSnapshot.data().count;
    } catch {
      // Fallback: hitung manual
      const snapshot = await getDocs(q);
      return snapshot.size;
    }
  } catch (error) {
    console.error("Error getting items perlu verifikasi count:", error);
    return 0;
  }
};

// Verifikasi item oleh admin
export const verifikasiItem = async (
  id: string,
  adminName: string,
  updateData?: Partial<Omit<SparepartItem, "id" | "createdAt" | "updatedAt">>,
  approval?: { uid?: string; role?: UserRole; name?: string }
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_SPAREPART_ITEMS, id);
    const payload = {
      ...updateData,
      perluVerifikasi: false,
      approvalStatus: "approved",
      diverifikasiOleh: adminName,
      tanggalVerifikasi: Timestamp.now(),
      approvedByUid: approval?.uid,
      approvedByName: approval?.name || adminName,
      approvedByRole: approval?.role,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(
      docRef,
      Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      )
    );
  } catch (error: unknown) {
    console.error("Error verifikasi item:", error);
    throw error;
  }
};

export const tolakVerifikasiItem = async (
  id: string,
  params: {
    rejectedByName: string;
    rejectedByRole: UserRole;
    rejectReason: string;
  }
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_SPAREPART_ITEMS, id);
    await updateDoc(docRef, {
      perluVerifikasi: false,
      approvalStatus: "rejected",
      rejectedByName: params.rejectedByName,
      rejectedByRole: params.rejectedByRole,
      rejectedAt: Timestamp.now(),
      rejectReason: params.rejectReason,
      updatedAt: Timestamp.now(),
    });
  } catch (error: unknown) {
    console.error("Error menolak verifikasi item:", error);
    throw error;
  }
};
