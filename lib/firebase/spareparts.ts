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
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS } from "./collections";
import { Sparepart } from "@/types";
import { generateQRCodeUrl } from "@/lib/utils";
import QRCode from "qrcode";
import { createSystemNotification } from "./notifications";

export const getSpareparts = async (): Promise<Sparepart[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.SPAREPARTS));
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Sparepart;
    });
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error("Error getting spareparts:", error);
    throw error;
  }
};

export const getSparepartById = async (id: string): Promise<Sparepart | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.SPAREPARTS, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Sparepart;
  } catch (error) {
    console.error("Error getting sparepart:", error);
    throw error;
  }
};

export const getSparepartByKode = async (kodeSpare: string): Promise<Sparepart | null> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.SPAREPARTS),
      where("kodeSpare", "==", kodeSpare)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    return {
      id: snapshot.docs[0].id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Sparepart;
  } catch (error) {
    console.error("Error getting sparepart by kode:", error);
    throw error;
  }
};

export const createOrUpdateSparepart = async (
  data: Omit<Sparepart, "id" | "createdAt" | "updatedAt" | "qrCodePath" | "qrCodeUrl">,
  existingId?: string
): Promise<{ id: string; sparepart: Sparepart }> => {
  try {
    if (existingId) {
      // Update existing
      await updateSparepart(existingId, data);
      const updated = await getSparepartById(existingId);
      if (!updated) throw new Error("Failed to get updated sparepart");
      return { id: existingId, sparepart: updated };
    } else {
      // Create new
      const result = await createSparepart(data);
      return { id: result.sparepart.id, sparepart: result.sparepart };
    }
  } catch (error) {
    console.error("Error creating/updating sparepart:", error);
    throw error;
  }
};

export const createSparepart = async (
  data: Omit<Sparepart, "id" | "createdAt" | "updatedAt" | "qrCodePath" | "qrCodeUrl">
): Promise<{ sparepart: Sparepart; qrCodeDataUrl: string }> => {
  try {
    // Generate QR Code
    const qrCodeUrl = generateQRCodeUrl(""); // Will update with actual ID after creation
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

    // Create sparepart document
    const sparepartData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      qrCodeUrl: qrCodeUrl,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.SPAREPARTS), sparepartData);

    // Update QR Code URL with actual ID
    const actualQrCodeUrl = generateQRCodeUrl(docRef.id);
    const actualQrCodeDataUrl = await QRCode.toDataURL(actualQrCodeUrl);

    await updateDoc(docRef, {
      qrCodeUrl: actualQrCodeUrl,
    });

    const createdSparepart = {
      id: docRef.id,
      ...sparepartData,
      qrCodeUrl: actualQrCodeUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Sparepart;

    await createSystemNotification({
      title: "Master sparepart ditambahkan",
      message: `${createdSparepart.namaSpare} ditambahkan ke master sparepart.`,
      link: `/spareparts/${docRef.id}`,
    });

    return {
      sparepart: createdSparepart,
      qrCodeDataUrl: actualQrCodeDataUrl,
    };
  } catch (error) {
    console.error("Error creating sparepart:", error);
    throw error;
  }
};

export const updateSparepart = async (
  id: string,
  data: Partial<Omit<Sparepart, "id" | "createdAt" | "updatedAt">>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.SPAREPARTS, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    await createSystemNotification({
      title: "Master sparepart diperbarui",
      message: `${data.namaSpare || data.kodeSpare || "Data sparepart"} telah diperbarui.`,
      link: `/spareparts/${id}`,
    });
  } catch (error) {
    console.error("Error updating sparepart:", error);
    throw error;
  }
};

export const updateSparepartFoto = async (
  id: string,
  fotoUrls: string[]
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.SPAREPARTS, id);
    await updateDoc(docRef, {
      fotoUrl: fotoUrls,
      updatedAt: Timestamp.now(),
    });
    await createSystemNotification({
      title: "Foto sparepart diperbarui",
      message: "Foto pada master sparepart telah diperbarui.",
      link: `/spareparts/${id}`,
    });
  } catch (error) {
    console.error("Error updating sparepart foto:", error);
    throw error;
  }
};

export const deleteSparepart = async (id: string): Promise<void> => {
  try {
    const sparepart = await getSparepartById(id).catch(() => null);
    const docRef = doc(db, COLLECTIONS.SPAREPARTS, id);
    await deleteDoc(docRef);
    await createSystemNotification({
      title: "Master sparepart dihapus",
      message: `${sparepart?.namaSpare || "Master sparepart"} telah dihapus.`,
      link: "/spareparts",
    });
  } catch (error) {
    console.error("Error deleting sparepart:", error);
    throw error;
  }
};

export const restockSparepart = async (
  id: string,
  jumlah: number
): Promise<void> => {
  try {
    const sparepart = await getSparepartById(id);
    if (!sparepart) {
      throw new Error("Sparepart not found");
    }

    await updateDoc(doc(db, COLLECTIONS.SPAREPARTS, id), {
      stokTotal: sparepart.stokTotal + jumlah,
      stokGudang: sparepart.stokGudang + jumlah,
      updatedAt: Timestamp.now(),
    });
    await createSystemNotification({
      title: "Stok sparepart bertambah",
      message: `${sparepart.namaSpare} direstock sebanyak ${jumlah} unit.`,
      link: `/spareparts/${id}`,
    });
  } catch (error) {
    console.error("Error restocking sparepart:", error);
    throw error;
  }
};
