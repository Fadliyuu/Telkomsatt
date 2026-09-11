/**
 * Membuat akun demo untuk setiap role di sistem.
 *
 * Usage:
 *   npm run seed:roles
 *
 * Env (.env.local):
 *   SEED_PASSWORD=Telkomsat@2026   (opsional, default di bawah)
 *   SEED_EMAIL_DOMAIN=telkomsat-r6.id (opsional)
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
require("dotenv").config();

const { initializeApp } = require("firebase/app");
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} = require("firebase/auth");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const DEFAULT_PASSWORD = "Telkomsat@2026";
const EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN || "telkomsat-r6.id";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Satu akun per role — email: {role}@{domain} */
const SEED_ACCOUNTS = [
  {
    role: "admin",
    nama: "Admin Sistem",
    divisi: "IT & System",
    nomorHP: "08110000000",
  },
  {
    role: "admin_gudang",
    nama: "Admin Gudang Demo",
    divisi: "Gudang",
    nomorHP: "08110000004",
  },
  {
    role: "teknisi",
    nama: "Teknisi Demo",
    divisi: "Lapangan",
    nomorHP: "08110000006",
  },
  {
    role: "supervisor",
    nama: "Supervisor Demo",
    divisi: "Operasional",
    nomorHP: "08110000003",
  },
];

const ROLE_LABELS = {
  admin: "Admin Sistem",
  admin_gudang: "Admin Gudang",
  teknisi: "Teknisi",
  supervisor: "Supervisor",
};

function getEmail(role) {
  return `${role}@${EMAIL_DOMAIN}`;
}

function validateConfig() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      "Firebase belum dikonfigurasi. Isi NEXT_PUBLIC_FIREBASE_* di .env.local"
    );
  }
}

async function upsertUserDoc(db, uid, account, email, now) {
  await setDoc(
    doc(db, "users", uid),
    {
      nama: account.nama,
      email,
      role: account.role,
      status: "aktif",
      nomorHP: account.nomorHP,
      alamat: "Telkomsat Regional 6",
      divisi: account.divisi,
      tanggalMulai: null,
      tanggalSelesai: null,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

async function seedAccount(auth, db, account, password) {
  const email = getEmail(account.role);
  const now = new Date();

  try {
    await signOut(auth);
  } catch {
    /* abaikan jika belum login */
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await upsertUserDoc(db, credential.user.uid, account, email, now);
    return { email, role: account.role, status: "created" };
  } catch (error) {
    const code = error?.code || "";

    if (code === "auth/email-already-in-use") {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserDoc(db, credential.user.uid, account, email, now);
      await signOut(auth);
      return { email, role: account.role, status: "updated" };
    }

    if (code === "auth/weak-password") {
      throw new Error(
        `Password terlalu lemah. Gunakan minimal 6 karakter (disarankan: huruf besar, angka, simbol).`
      );
    }

    throw error;
  }
}

function printSummary(results, password) {
  console.log("\n========================================");
  console.log("  Akun seed — Telkomsat Inventaris");
  console.log("========================================\n");
  console.log(`Password (semua akun): ${password}\n`);
  console.log(
    "Role".padEnd(18) +
      "Email".padEnd(36) +
      "Status"
  );
  console.log("-".repeat(62));

  for (const r of results) {
    const label = ROLE_LABELS[r.role] || r.role;
    const status =
      r.status === "created" ? "✓ dibuat" : "↻ diperbarui";
    console.log(
      label.padEnd(18) + r.email.padEnd(36) + status
    );
  }

  console.log("\nLogin di: http://localhost:3000/login\n");
}

async function main() {
  validateConfig();

  const password = process.env.SEED_PASSWORD || DEFAULT_PASSWORD;

  if (password.length < 6) {
    throw new Error("SEED_PASSWORD minimal 6 karakter");
  }

  const app = initializeApp(firebaseConfig, "seed-all-roles");
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Membuat ${SEED_ACCOUNTS.length} akun (@${EMAIL_DOMAIN})...\n`);

  const results = [];

  for (const account of SEED_ACCOUNTS) {
    const email = getEmail(account.role);
    process.stdout.write(`  ${ROLE_LABELS[account.role]} (${email}) ... `);

    try {
      const result = await seedAccount(auth, db, account, password);
      results.push(result);
      console.log(result.status === "created" ? "OK (baru)" : "OK (update)");
    } catch (error) {
      console.log("GAGAL");
      console.error(`    → ${error.message || error}`);
      results.push({
        email,
        role: account.role,
        status: "failed",
        error: error.message,
      });
    }
  }

  await signOut(auth).catch(() => {});

  const succeeded = results.filter((r) => r.status !== "failed");
  printSummary(succeeded, password);

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error(`${failed.length} akun gagal. Periksa pesan error di atas.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nError:", error.message || error);
  process.exitCode = 1;
});
