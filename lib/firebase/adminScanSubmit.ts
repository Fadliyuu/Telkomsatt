import type { SessionKeranjangItem } from "@/types";
import type { AdminScanItem } from "@/lib/store/useAdminScanStore";
import { getSparepartItemById, updateSparepartItem } from "./sparepartItems";
import { submitCartTransaction, createTransaction } from "./transactions";
import { normalizeItemStatus } from "@/lib/constants/sparepartItem";
import type { UserRole } from "@/types";

function toSessionItem(item: AdminScanItem): SessionKeranjangItem {
  return {
    id: item.id,
    idSessionKeranjang: "admin-scan",
    idSparepart: item.idSparepart,
    jenisAksi:
      item.mode === "UPDATE" ? "MOVE" : item.mode,
    lokasiDitemukan: item.lokasiDitemukan,
    kondisiDismantle: item.kondisiDismantle,
    kondisiBarang: item.kondisiBarang,
    createdAt: new Date(),
  };
}

export async function submitAdminScanBatch(params: {
  items: AdminScanItem[];
  namaTeknisi: string;
  penerimaRole?: UserRole;
  penerimaUserId?: string;
  nomorSpt?: string;
  lokasiTujuan: string;
  keteranganGlobal?: string;
  adminName: string;
  adminUid?: string;
  adminRole?: UserRole;
}): Promise<{ updated: number; transacted: number }> {
  const {
    items,
    namaTeknisi,
    penerimaRole,
    penerimaUserId,
    nomorSpt,
    lokasiTujuan,
    keteranganGlobal,
    adminName,
    adminUid,
    adminRole,
  } = params;

  if (items.length === 0) {
    throw new Error("Tidak ada item untuk diproses");
  }
  if (!adminUid) {
    throw new Error("Admin harus login sebelum memproses transaksi");
  }

  let updated = 0;
  let transacted = 0;

  const updateItems = items.filter((i) => i.mode === "UPDATE");
  const moveItems = items.filter((i) => i.mode === "MOVE");
  const damageItems = items.filter((i) => i.mode === "DAMAGE");
  const foundItems = items.filter((i) => i.mode === "FOUND");
  const dismantleItems = items.filter((i) => i.mode === "DISMANTLE");

  for (const item of updateItems) {
    const data = await getSparepartItemById(item.idSparepart);
    if (!data) continue;

    const patch: Parameters<typeof updateSparepartItem>[1] = {};
    if (item.newStatus) patch.status = item.newStatus;
    if (item.newLokasi?.trim()) patch.lokasiSaatIni = item.newLokasi.trim();
    if (item.newKeterangan !== undefined) {
      patch.keterangan = item.newKeterangan.trim();
    }

    if (Object.keys(patch).length > 0) {
      await updateSparepartItem(item.idSparepart, patch);
      updated++;
    }

    const note = [
      `[Admin: ${adminName}] Pembaruan data item`,
      item.newStatus ? `Status → ${item.newStatus}` : null,
      item.newLokasi ? `Lokasi → ${item.newLokasi}` : null,
      item.newKeterangan?.trim() || keteranganGlobal?.trim() || null,
    ]
      .filter(Boolean)
      .join(". ");

    await createTransaction({
      idSparepart: item.idSparepart,
      requestedByUid: adminUid,
      requestedByName: adminName,
      requestedByRole: adminRole,
      requestedAt: new Date(),
      statusTransaksi: "completed",
      namaTeknisi: adminName,
      carriedByName: adminName,
      carriedByRole: adminRole,
      approvedByName: adminName,
      approvedByRole: adminRole,
      approvedByUid: adminUid,
      approvedAt: new Date(),
      jenisTransaksi: "MOVE",
      nomorSpt: nomorSpt?.trim() || "",
      lokasiAsal: data.lokasiSaatIni || "Gudang",
      lokasiTujuan: item.newLokasi?.trim() || data.lokasiSaatIni || "Gudang",
      jumlah: 1,
      statusBarang:
        normalizeItemStatus(item.newStatus || data.status) === "Rusak"
          ? "Rusak"
          : "Normal",
      keterangan: note,
      namaItem: data.namaPerangkat,
      serialNumber: data.serialNumber,
    });
    transacted++;
  }

  const submitGroup = async (
    group: AdminScanItem[],
    note?: string
  ) => {
    if (group.length === 0) return;
    await submitCartTransaction(
      group.map(toSessionItem),
      namaTeknisi,
      lokasiTujuan,
      note || keteranganGlobal,
      undefined,
      {
        requestedByUid: adminUid,
        requestedByName: adminName,
        requestedByRole: adminRole,
        jabatanPenerima: penerimaRole,
        namaPenerima: namaTeknisi,
        idPenerima: penerimaUserId,
        nomorSpt: nomorSpt?.trim() || "",
        carriedByName: namaTeknisi,
        carriedByRole: penerimaRole,
        approvedByName: adminName,
        approvedByRole: adminRole,
        approvedByUid: adminUid,
        approvedAt: new Date(),
      }
    );
    transacted += group.length;
  };

  await submitGroup(
    moveItems,
    keteranganGlobal || `Diserahkan / dibawa oleh: ${namaTeknisi}`
  );
  await submitGroup(damageItems, keteranganGlobal || "Barang rusak");
  await submitGroup(foundItems, keteranganGlobal || "Barang ditemukan");
  await submitGroup(dismantleItems, keteranganGlobal || "Dismantle");

  return { updated, transacted };
}
