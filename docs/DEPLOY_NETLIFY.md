# Deployment GitHub dan Netlify

- Repository: https://github.com/Fadliyuu/Telkomsatt
- Branch produksi yang perlu dikonfirmasi pada pengaturan Netlify: `main`.
- Situs: https://tsatspare.netlify.app
- Android: `android/gradle.properties` sudah menunjuk ke alamat situs tersebut.

## Pengaturan Netlify

Gunakan folder utama repository sebagai base directory. File `netlify.toml`
menentukan `npm run build`, publish directory `.next`, Node.js 22, serta
`NEXT_PUBLIC_BASE_URL=https://tsatspare.netlify.app` untuk konteks production.
Netlify mendeteksi Next.js dan menyediakan runtime untuk API/server rendering.
Jangan mengubah build menjadi static export karena aplikasi memerlukan API Next.js.

Isi environment melalui dashboard Netlify, mengacu pada `.env.example`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Firebase Admin: `FIREBASE_SERVICE_ACCOUNT_KEY` berisi JSON service account,
  **atau** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

Variabel publik Firebase diperlukan ketika build. Kredensial Firebase Admin dan
Cloudinary harus tersedia untuk Functions/runtime, bukan hanya build. Jangan
menambahkan awalan `NEXT_PUBLIC_` pada private key atau API secret.

Versi source baru memakai Firebase Admin untuk membuat cookie login dan
memverifikasi pengguna. Jadi, environment situs lama perlu diperiksa sebelum
deployment baru: konfigurasi Firebase web saja belum cukup untuk API ini.
`google-services.json` tidak diperlukan oleh wrapper Android.

## Pemeriksaan sebelum push

1. Pastikan akun GitHub yang login adalah `Fadliyuu`.
2. Periksa `git var GIT_AUTHOR_IDENT` dan `git var GIT_COMMITTER_IDENT` pada
   checkout yang akan di-push. Identitas lokal disesuaikan dengan riwayat commit
   Fadliyuu; tidak perlu menambahkan baris co-author.
3. Jalankan `npm run build` pada source yang memiliki environment lokal.
4. Jalankan `android/gradlew.bat -p android assembleDebug` pada Windows dengan
   Android SDK dan JDK tersedia.
5. Tinjau diff; jangan sertakan `.env.local`, private key, cache build, atau
   folder dependensi. `.env.example` hanya berisi petunjuk konfigurasi.

Push ke branch produksi dapat memicu deploy otomatis jika integrasi GitHub
Netlify aktif. Konfirmasi hasil pada daftar Deploys Netlify; keberhasilan push
saja belum membuktikan deployment berhasil.

## Sesudah deploy

Uji login/logout, dashboard sesuai role, upload gambar, scan QR, ekspor Excel/PDF,
dan endpoint yang memerlukan autentikasi. Ulangi alur utama melalui APK pada HP.
Pembaruan halaman web pada URL yang sama tidak memerlukan build APK ulang.

Referensi: [Next.js di Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
dan [Environment variables Netlify](https://docs.netlify.com/build/environment-variables/overview/).
