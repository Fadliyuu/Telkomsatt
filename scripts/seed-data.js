/**
 * Seed data inventaris: lokasi, spareparts, sparepart_items, transaksi.
 *
 * Usage:
 *   npm run seed:data
 *   npm run seed:sample          (alias)
 *   node scripts/seed-data.js --clear       (hapus seed lalu isi ulang)
 *   node scripts/seed-data.js --clear-only  (hapus seed saja, tanpa isi ulang)
 *   npm run seed:data:clear-only
 *
 * Env (.env.local):
 *   SEED_PASSWORD=Telkomsat@2026
 *   SEED_EMAIL_DOMAIN=telkomsat-r6.id
 *   NEXT_PUBLIC_BASE_URL=http://localhost:3000
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
require("dotenv").config();

if (process.env.NODE_ENV === "production" && process.argv.includes("--clear")) {
  console.error("❌ ERROR SANGAT FATAL: Dilarang menghapus database di lingkungan PRODUCTION!");
  process.exit(1);
}

const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} = require("firebase/auth");
const {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
} = require("firebase/firestore");

const SEED_PREFIX = "seed-";
const EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN || "telkomsat-r6.id";
const PASSWORD = process.env.SEED_PASSWORD || "Telkomsat@2026";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const CLEAR_FIRST = process.argv.includes("--clear");
const CLEAR_ONLY = process.argv.includes("--clear-only");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const COLLECTIONS = {
  LOKASI: "lokasi",
  SPAREPARTS: "spareparts",
  SPAREPART_ITEMS: "sparepart_items",
  TRANSAKSI: "transaksi",
};

const TEKNISI = [
  "Teknisi Demo",
  "Budi Santoso",
  "Andi Wijaya",
  "Rizki Pratama",
  "Guest Lapangan",
];

const LOKASI_SEED = [
  { id: `${SEED_PREFIX}lok-gudang`, namaLokasi: "Gudang Regional 6", tipe: "Gudang", alamat: "Jakarta Selatan" },
  { id: `${SEED_PREFIX}lok-site-a`, namaLokasi: "Site Tanjung Priok", tipe: "Site", alamat: "Pelabuhan Tanjung Priok" },
  { id: `${SEED_PREFIX}lok-site-b`, namaLokasi: "Site Cibinong", tipe: "Site", alamat: "Bogor" },
  { id: `${SEED_PREFIX}lok-cust-x`, namaLokasi: "Customer PT Nusantara", tipe: "Customer", alamat: "Jakarta Pusat" },
  { id: `${SEED_PREFIX}lok-workshop`, namaLokasi: "Workshop Perbaikan", tipe: "Workshop", alamat: "Bekasi" },
];

const SPAREPARTS_SEED = [
  { id: `${SEED_PREFIX}sp-buc`, kodeSpare: "SEED-BUC-2W", namaSpare: "BUC 2 Watt", kategori: "RF", deskripsi: "Block Up Converter 2 Watt C-Band", lokasiDefault: "Gudang Regional 6", stokTotal: 8, stokGudang: 5 },
  { id: `${SEED_PREFIX}sp-lnb`, kodeSpare: "SEED-LNB-CB", namaSpare: "LNB C-Band", kategori: "RF", deskripsi: "Low Noise Block C-Band", lokasiDefault: "Gudang Regional 6", stokTotal: 12, stokGudang: 8 },
  { id: `${SEED_PREFIX}sp-psu`, kodeSpare: "SEED-PSU-48", namaSpare: "Power Supply 48V", kategori: "Power", deskripsi: "PSU rack 48V DC", lokasiDefault: "Gudang Regional 6", stokTotal: 15, stokGudang: 10 },
  { id: `${SEED_PREFIX}sp-router`, kodeSpare: "SEED-RTR-MT", namaSpare: "Router MikroTik", kategori: "Network", deskripsi: "Router edge site", lokasiDefault: "Gudang Regional 6", stokTotal: 6, stokGudang: 4 },
  { id: `${SEED_PREFIX}sp-fiber`, kodeSpare: "SEED-FO-PATCH", namaSpare: "Patch Cord FO SM", kategori: "Fiber Optic", deskripsi: "Patch cord single mode 3m", lokasiDefault: "Gudang Regional 6", stokTotal: 50, stokGudang: 40 },
  { id: `${SEED_PREFIX}sp-rg6`, kodeSpare: "SEED-RG6-100", namaSpare: "Kabel RG6", kategori: "Kabel", deskripsi: "Kabel coaxial RG6 per 100m", lokasiDefault: "Gudang Regional 6", stokTotal: 20, stokGudang: 15 },
  { id: `${SEED_PREFIX}sp-modem`, kodeSpare: "SEED-MODEM-VSAT", namaSpare: "Modem VSAT", kategori: "VSAT", deskripsi: "Modem satelit VSAT", lokasiDefault: "Gudang Regional 6", stokTotal: 4, stokGudang: 2 },
  { id: `${SEED_PREFIX}sp-odu`, kodeSpare: "SEED-ODU-1.2", namaSpare: "ODU 1.2m", kategori: "Antenna", deskripsi: "Outdoor Unit antenna 1.2m", lokasiDefault: "Gudang Regional 6", stokTotal: 3, stokGudang: 1 },
];

/** Item fisik — id, idSparepart, nama, sn, tagging, lokasi, status, cariFisik, perluVerifikasi */
function buildItemsSeed() {
  const templates = [
    { sp: `${SEED_PREFIX}sp-buc`, base: "BUC 2 Watt", count: 4 },
    { sp: `${SEED_PREFIX}sp-lnb`, base: "LNB C-Band", count: 4 },
    { sp: `${SEED_PREFIX}sp-psu`, base: "Power Supply 48V", count: 3 },
    { sp: `${SEED_PREFIX}sp-router`, base: "Router MikroTik", count: 3 },
    { sp: `${SEED_PREFIX}sp-fiber`, base: "Patch Cord FO SM", count: 5 },
    { sp: `${SEED_PREFIX}sp-rg6`, base: "Kabel RG6", count: 3 },
    { sp: `${SEED_PREFIX}sp-modem`, base: "Modem VSAT", count: 2 },
    { sp: `${SEED_PREFIX}sp-odu`, base: "ODU 1.2m", count: 2 },
  ];

  const lokasiRotasi = [
    "Gudang Regional 6",
    "Site Tanjung Priok",
    "Site Cibinong",
    "Customer PT Nusantara",
    "Workshop Perbaikan",
  ];
  const statusRotasi = ["Tersedia", "Digunakan", "Tersedia", "Rusak", "Maintenance"];
  const cariRotasi = ["Sesuai", "Sesuai", "Sesuai", "Outstanding", "Sesuai"];

  const items = [];
  let idx = 1;

  for (const t of templates) {
    for (let i = 0; i < t.count; i++) {
      const n = String(idx).padStart(3, "0");
      const li = (idx - 1) % lokasiRotasi.length;
      const perluVerifikasi = idx === 25 || idx === 26;

      items.push({
        id: `${SEED_PREFIX}item-${n}`,
        idSparepart: t.sp,
        // Nama produk sama per jenis — unit dibedakan SN/tag (agar tabel grup jumlah > 1)
        namaPerangkat: t.base,
        serialNumber: `SEED-SN-${n}`,
        tagging: `TAG-R6-${n}`,
        lokasiSaatIni: lokasiRotasi[li],
        status: perluVerifikasi ? "Tersedia" : statusRotasi[li],
        cariFisik: cariRotasi[li],
        perluVerifikasi,
        ditambahkanOleh: perluVerifikasi ? "Guest Lapangan" : undefined,
        jenisTeknisi: perluVerifikasi ? "freelance" : undefined,
        keterangan: perluVerifikasi
          ? "Item ditambahkan teknisi lapangan — menunggu verifikasi admin"
          : `Data seed inventaris Telkomsat R6`,
      });
      idx++;
    }
  }

  return items;
}

const ITEMS_SEED = buildItemsSeed();

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + (days % 8), (days * 7) % 60, 0, 0);
  return d;
}

function buildTransactionsSeed(itemIds) {
  const jenisList = ["MOVE", "MOVE", "DAMAGE", "FOUND", "DISMANTLE", "RETURN"];
  const lokasiAsal = ["Gudang Regional 6", "Site Tanjung Priok", "Site Cibinong"];
  const lokasiTujuan = [
    "Site Tanjung Priok",
    "Site Cibinong",
    "Customer PT Nusantara",
    "Workshop Perbaikan",
    "Gudang Regional 6",
  ];

  const txs = [];
  let txNum = 1;

  for (let day = 30; day >= 0; day -= 2) {
    const itemsForDay = itemIds.slice(
      (30 - day) % itemIds.length,
      ((30 - day) % itemIds.length) + 2
    );

    for (const itemId of itemsForDay) {
      if (txNum > 55) break;
      const jenis = jenisList[txNum % jenisList.length];
      const itemMeta = ITEMS_SEED.find((it) => it.id === itemId);
      const n = String(txNum).padStart(3, "0");

      const tx = {
        id: `${SEED_PREFIX}tx-${n}`,
        idSparepart: itemId,
        namaTeknisi: TEKNISI[txNum % TEKNISI.length],
        jenisTransaksi: jenis,
        lokasiAsal: lokasiAsal[txNum % lokasiAsal.length],
        lokasiTujuan: lokasiTujuan[txNum % lokasiTujuan.length],
        jumlah: 1,
        statusBarang: jenis === "DAMAGE" ? "Rusak" : "Normal",
        namaItem: itemMeta?.namaPerangkat || "Item Seed",
        serialNumber: itemMeta?.serialNumber || "",
        keterangan:
          jenis === "MOVE"
            ? "Pengambilan barang untuk pekerjaan site"
            : jenis === "DAMAGE"
              ? "Barang rusak saat operasional"
              : jenis === "FOUND"
                ? "Barang ditemukan saat audit lapangan"
                : jenis === "DISMANTLE"
                  ? "Dismantle perangkat — kondisi dicatat"
                  : "Pengembalian barang ke gudang",
        createdAt: daysAgo(day),
      };

      txs.push(tx);
      txNum++;
    }
  }

  return txs;
}

const ALL_SEED_DOC_IDS = {
  lokasi: LOKASI_SEED.map((l) => l.id),
  spareparts: SPAREPARTS_SEED.map((s) => s.id),
  items: ITEMS_SEED.map((i) => i.id),
  transaksi: buildTransactionsSeed(ITEMS_SEED.map((i) => i.id)).map((t) => t.id),
};

function validateConfig() {
  if (!firebaseConfig.projectId) {
    throw new Error("Firebase belum dikonfigurasi di .env.local");
  }
}

async function loginAsAdminGudang(auth) {
  const email = `admin_gudang@${EMAIL_DOMAIN}`;
  await signInWithEmailAndPassword(auth, email, PASSWORD);
  return email;
}

async function clearSeedData(db) {
  console.log("\n🗑️  Menghapus data seed lama...");
  const allIds = [
    ...ALL_SEED_DOC_IDS.transaksi.map((id) => ({ col: COLLECTIONS.TRANSAKSI, id })),
    ...ALL_SEED_DOC_IDS.items.map((id) => ({ col: COLLECTIONS.SPAREPART_ITEMS, id })),
    ...ALL_SEED_DOC_IDS.spareparts.map((id) => ({ col: COLLECTIONS.SPAREPARTS, id })),
    ...ALL_SEED_DOC_IDS.lokasi.map((id) => ({ col: COLLECTIONS.LOKASI, id })),
  ];

  const BATCH_SIZE = 400;
  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = allIds.slice(i, i + BATCH_SIZE);
    for (const { col, id } of chunk) {
      batch.delete(doc(db, col, id));
    }
    await batch.commit();
  }
  console.log(`   ${allIds.length} dokumen dihapus.\n`);
}

async function seedLokasi(db, now) {
  for (const loc of LOKASI_SEED) {
    await setDoc(doc(db, COLLECTIONS.LOKASI, loc.id), {
      namaLokasi: loc.namaLokasi,
      tipe: loc.tipe,
      alamat: loc.alamat,
      keterangan: "Data seed — Telkomsat R6",
      createdAt: Timestamp.fromDate(now),
    });
  }
}

async function seedSpareparts(db, now) {
  for (const sp of SPAREPARTS_SEED) {
    const qrCodeUrl = `${BASE_URL}/scan/${sp.id}`;
    await setDoc(doc(db, COLLECTIONS.SPAREPARTS, sp.id), {
      kodeSpare: sp.kodeSpare,
      namaSpare: sp.namaSpare,
      kategori: sp.kategori,
      deskripsi: sp.deskripsi,
      lokasiDefault: sp.lokasiDefault,
      stokTotal: sp.stokTotal,
      stokGudang: sp.stokGudang,
      qrCodeUrl,
      fotoUrl: [],
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    });
  }
}

async function seedItems(db, now) {
  for (const item of ITEMS_SEED) {
    const qrCodeUrl = `${BASE_URL}/scan/${item.id}`;
    const data = {
      idSparepart: item.idSparepart,
      namaPerangkat: item.namaPerangkat,
      serialNumber: item.serialNumber,
      tagging: item.tagging,
      lokasiSaatIni: item.lokasiSaatIni,
      status: item.status,
      cariFisik: item.cariFisik,
      keterangan: item.keterangan,
      qrCodeUrl,
      fotoUrl: [],
      perluVerifikasi: item.perluVerifikasi ?? false,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    if (item.ditambahkanOleh) data.ditambahkanOleh = item.ditambahkanOleh;
    if (item.jenisTeknisi) data.jenisTeknisi = item.jenisTeknisi;

    await setDoc(doc(db, COLLECTIONS.SPAREPART_ITEMS, item.id), data);
  }
}

async function seedTransaksi(db) {
  const txs = buildTransactionsSeed(ITEMS_SEED.map((i) => i.id));

  const BATCH_SIZE = 400;
  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = txs.slice(i, i + BATCH_SIZE);

    for (const tx of chunk) {
      const { id, createdAt, ...fields } = tx;
      batch.set(doc(db, COLLECTIONS.TRANSAKSI, id), {
        ...fields,
        createdAt: Timestamp.fromDate(createdAt),
      });
    }
    await batch.commit();
  }

  return txs.length;
}

function printSummary(txCount) {
  console.log("\n========================================");
  console.log("  Seed inventaris selesai");
  console.log("========================================");
  console.log(`  Lokasi         : ${LOKASI_SEED.length}`);
  console.log(`  Katalog spare  : ${SPAREPARTS_SEED.length}`);
  console.log(`  Item fisik     : ${ITEMS_SEED.length}`);
  console.log(`  Transaksi      : ${txCount}`);
  console.log(`  Perlu verifikasi: ${ITEMS_SEED.filter((i) => i.perluVerifikasi).length} item`);
  console.log("\n  Cek di aplikasi:");
  console.log("  • /spareparts      — daftar item");
  console.log("  • /spareparts/verifikasi — item pending");
  console.log("  • /laporan         — transaksi");
  console.log("  • /dashboard       — ringkasan");
  console.log("\n  Login: admin_gudang@" + EMAIL_DOMAIN);
  console.log("  Password: " + PASSWORD + "\n");
}

async function main() {
  validateConfig();

  const app = initializeApp(firebaseConfig, "seed-inventory");
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("Seed inventaris Telkomsat Regional 6\n");

  const email = await loginAsAdminGudang(auth);
  console.log(`✓ Login sebagai ${email}\n`);

  if (CLEAR_ONLY) {
    await clearSeedData(db);
    await signOut(auth).catch(() => {});
    console.log("✓ Data seed inventaris dihapus (lokasi, katalog, item fisik, transaksi seed-).\n");
    return;
  }

  if (CLEAR_FIRST) {
    await clearSeedData(db);
  } else {
    const probe = await getDoc(doc(db, COLLECTIONS.SPAREPART_ITEMS, ITEMS_SEED[0].id));
    if (probe.exists()) {
      console.log("ℹ️  Data seed sudah ada. Gunakan --clear untuk reset lalu seed ulang.\n");
      console.log("   node scripts/seed-data.js --clear\n");
      console.log("   Atau hapus saja tanpa isi ulang: npm run seed:data:clear-only\n");
    }
  }

  const now = new Date();
  console.log("📍 Lokasi...");
  await seedLokasi(db, now);

  console.log("📦 Katalog sparepart...");
  await seedSpareparts(db, now);

  console.log("🏷️  Item fisik (sparepart_items)...");
  await seedItems(db, now);

  console.log("📋 Transaksi...");
  const txCount = await seedTransaksi(db);

  await signOut(auth).catch(() => {});

  printSummary(txCount);
}

main().catch(async (error) => {
  console.error("\n❌ Gagal:", error.message || error);
  if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
    console.error("\nJalankan dulu: npm run seed:roles");
  }
  process.exitCode = 1;
});
