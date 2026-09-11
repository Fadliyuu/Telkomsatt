const readline = require("readline");
require("dotenv").config();

const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await ask("Email manager: "));
  const password = process.env.ADMIN_PASSWORD || (await ask("Password: "));
  const nama = process.env.ADMIN_NAME || (await ask("Nama: "));

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const now = new Date();

  await setDoc(doc(db, "users", credential.user.uid), {
    nama,
    email,
    role: "manager",
    status: "aktif",
    nomorHP: "",
    alamat: "",
    divisi: "Management",
    tanggalMulai: null,
    tanggalSelesai: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Default manager user created: ${email}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
