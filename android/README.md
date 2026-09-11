# Android — Telkomsat Inventaris

Proyek Android Studio berbasis WebView untuk web Next.js di folder induk.
Server Next.js tetap harus berjalan di URL HTTPS (misalnya Netlify), karena login,
unggah foto, dan pengelolaan pengguna menggunakan API server. APK bukan server
Next.js dan tidak menyediakan mode offline penuh.

## Buka dan build

1. Buka folder **android** ini melalui **Android Studio → Open**.
2. Gunakan **JDK 21** untuk Gradle. Proyek menyertakan kriteria daemon Java 21.
   Jika belum ada, buka Settings → Build, Execution, Deployment → Build Tools →
   Gradle → Gradle JDK → Download JDK, pilih versi 21.
3. Biarkan Gradle Sync mengunduh dependensi dan Android SDK Platform 35.
   Jika diminta, instal SDK Platform 35 dan Build Tools melalui SDK Manager.
4. Pilih emulator atau perangkat Android (minimal Android 8), lalu klik **Run**.
5. Aplikasi langsung membuka `https://tsatspare.netlify.app`.

Untuk membuat APK debug: **Build → Generate App Bundles or APKs → Generate APKs**
(nama menu bisa berbeda menurut versi Studio). Hasil:
`app/build/outputs/apk/debug/app-debug.apk`.

Alternatif PowerShell dari folder ini, setelah JAVA_HOME dan ANDROID_HOME tersedia:

```powershell
.\gradlew.bat assembleDebug
```

Untuk distribusi release, gunakan **Build → Generate Signed App Bundle / APK** dan
buat/pilih keystore Anda. Simpan keystore beserta password dengan aman. Proyek tidak
menyertakan kunci penandatanganan release.

## Langsung membuka web tanpa konfigurasi perangkat

Alamat produksi sudah diisi di `gradle.properties`:

```properties
TELKOMSAT_WEB_URL=https://tsatspare.netlify.app
```

Gunakan URL utama, tanpa `/login`, query, atau fragmen. Sync dan build kembali.
Aplikasi langsung membuka web dan tombol penggantian server tidak ditampilkan.
Jika nilai kosong, alamat diminta sekali dan disimpan di perangkat. Tombol Server
menghapus sesi lokal ketika mengganti server.

## Firebase dan Netlify

Firebase Cloud Messaging native memakai `app/google-services.json` untuk paket
`id.co.telkomsat.inventory`. File konfigurasi publik ini sudah disertakan. Akun
dan transaksi tetap memakai Firebase SDK web.

1. Repository tujuan adalah `https://github.com/Fadliyuu/Telkomsatt`.
   Hubungkan repository tersebut ke situs Netlify `tsatspare` sebagai Next.js.
   Base directory Netlify adalah folder utama repository, bukan folder `android`.
   `netlify.toml` menyiapkan build `npm run build`, publish `.next`, dan Node.js 22.
2. Masukkan environment sesuai `.env.example` melalui pengaturan Netlify:
   `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_BASE_URL` (URL produksi),
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. API server juga memerlukan `FIREBASE_SERVICE_ACCOUNT_KEY` berisi JSON service
   account, atau `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, dan
   `FIREBASE_PRIVATE_KEY`. Ini adalah kredensial server, berbeda dari
   `google-services.json`. Jangan masukkan kredensial Admin ke APK atau GitHub.
4. Pastikan konfigurasi Firebase Authentication dan Firestore Rules proyek sudah
   sesuai. Uji login, unggah foto, dan pengelolaan pengguna langsung di URL Netlify.
5. Build Android kembali hanya jika URL produksi berubah. Pembaruan web di URL
   yang sama tampil saat aplikasi memuat ulang halaman.

Referensi: [Firebase Web](https://firebase.google.com/docs/web/setup),
[Firebase Android](https://firebase.google.com/docs/android/setup),
[kompatibilitas AGP 8.9](https://developer.android.com/build/releases/agp-8-9-0-release-notes).

## Fitur dan verifikasi perangkat

- Izin kamera diminta ketika scanner web membutuhkan kamera, hanya untuk origin
  server yang dikonfigurasi. Mikrofon tidak diberikan.
- Pemilih file Android untuk unggah gambar dan impor dokumen; foto baru dapat
  diambil lewat kamera perangkat lalu dipilih melalui pemilih file.
- Cookie dan penyimpanan web untuk sesi login; tombol Back mengikuti riwayat web.
- Ekspor blob/data melalui tombol download disimpan dengan dialog Android
  (maksimum 20 MB; memerlukan Android System WebView yang mendukung Web Message Listener).
- Halaman web tampil tanpa toolbar Muat ulang/Cetak di atasnya. Pemanggilan
  `window.print()` dari web tetap membuka dialog cetak Android, termasuk Simpan sebagai PDF.
- Tautan HTTPS di luar server dibuka di browser. HTTP tidak diizinkan.

Sesudah deploy, uji pada HP: login/logout dan buka ulang aplikasi, scan QR dengan
izin diterima/ditolak, upload foto, impor Excel, ekspor Excel/PDF, cetak QR, tombol
Back, rotasi, keyboard, serta pemulihan setelah koneksi terputus. Build APK saja
belum membuktikan integrasi server dan kamera pada perangkat.
