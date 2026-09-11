import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS } from "./collections";
import { Lokasi, LokasiType } from "@/types";
import {
  NotificationActor,
  createSystemNotification,
  formatNotificationActor,
} from "./notifications";

function mapLokasiDoc(id: string, data: Record<string, unknown>): Lokasi {
  return {
    id,
    namaLokasi: String(data.namaLokasi ?? ""),
    tipe: (data.tipe as LokasiType) ?? "Lainnya",
    alamat: data.alamat ? String(data.alamat) : undefined,
    keterangan: data.keterangan ? String(data.keterangan) : undefined,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
  };
}

export const getLokasiList = async (): Promise<Lokasi[]> => {
  const q = query(
    collection(db, COLLECTIONS.LOKASI),
    orderBy("namaLokasi", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => mapLokasiDoc(d.id, d.data()));
};

export const createLokasi = async (data: {
  namaLokasi: string;
  tipe: LokasiType;
  alamat?: string;
  keterangan?: string;
  actor?: NotificationActor;
}): Promise<string> => {
  const now = Timestamp.now();
  const { actor, ...payload } = data;
  const ref = await addDoc(collection(db, COLLECTIONS.LOKASI), {
    ...payload,
    createdAt: now,
  });
  await createSystemNotification({
    title: "Lokasi ditambahkan",
    message: `${formatNotificationActor(actor)} menambahkan ${data.namaLokasi} sebagai lokasi ${data.tipe}.`,
    actorName: actor?.name,
    actorRole: actor?.role,
    link: "/lokasi",
  });
  return ref.id;
};

export const updateLokasi = async (
  id: string,
  data: Partial<{
    namaLokasi: string;
    tipe: LokasiType;
    alamat: string;
    keterangan: string;
  }>,
  actor?: NotificationActor
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.LOKASI, id), data);
  await createSystemNotification({
    title: "Lokasi diperbarui",
    message: `${formatNotificationActor(actor)} memperbarui ${data.namaLokasi || "data lokasi"}.`,
    actorName: actor?.name,
    actorRole: actor?.role,
    link: "/lokasi",
  });
};

export const deleteLokasi = async (
  id: string,
  actor?: NotificationActor
): Promise<void> => {
  const lokasi = (await getLokasiList()).find((item) => item.id === id);
  await deleteDoc(doc(db, COLLECTIONS.LOKASI, id));
  await createSystemNotification({
    title: "Lokasi dihapus",
    message: `${formatNotificationActor(actor)} menghapus ${lokasi?.namaLokasi || "data lokasi"}.`,
    actorName: actor?.name,
    actorRole: actor?.role,
    link: "/lokasi",
  });
};
