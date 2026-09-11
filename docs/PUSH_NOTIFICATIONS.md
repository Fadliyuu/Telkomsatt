# Notifikasi website dan Android

Notifikasi baru dibuat melalui API `/api/notifications` yang memverifikasi Firebase
ID token dan akun aktif. Server menyimpan kotak masuk, memilih pengguna aktif sesuai
target role/UID, lalu mengirim FCM ke Android dan Web Push ke browser terdaftar. Token hanya dapat
diakses melalui API server; tidak ada izin Firestore untuk membaca token dari klien.
Kegagalan push tidak menghapus notifikasi kotak masuk dan dicatat di log server.

## Mengaktifkan

1. Deploy website beserta route API dan `/firebase-messaging-sw.js`.
2. Buka website HTTPS, login, lalu tekan **Aktifkan notifikasi** dan izinkan.
   Browser menggunakan service worker untuk menerima pesan ketika tab ditutup.
   Pada iPhone/iPad yang mendukung Web Push, pasang website ke layar utama dahulu.
3. Pasang APK versi 1.1.0 atau yang lebih baru. Login dan aktifkan notifikasi;
   Android 13+ meminta izin sistem. APK lama belum mempunyai layanan FCM.
4. Uji pengajuan dari teknisi ke admin gudang, kemudian persetujuan/penolakan
   ke teknisi. Uji saat halaman terbuka, di latar belakang, dan ditutup.
   Perangkat harus online. Force-stop aplikasi atau pemblokiran notifikasi oleh
   sistem dapat mencegah pengiriman/pop-up sampai pengguna membuka aplikasi lagi.

## Konfigurasi

- Firebase Admin memakai environment server yang sama dengan login. Service account
  membutuhkan izin pengiriman FCM. Jangan masukkan private key ke client/APK.
- Android memakai `android/app/google-services.json` untuk paket
  `id.co.telkomsat.inventory`; ini konfigurasi aplikasi publik, bukan kredensial admin.
- Website memakai Web Push dengan pasangan VAPID yang dibuat sekali oleh server
  dan disimpan di `push_config/vapid`. Hanya public key dikirim ke browser;
  private key tidak dikirim ke klien atau disimpan dalam repository.
- Token didaftarkan kembali setelah login/pembukaan aplikasi. Logout melepaskan
  hubungan token dengan akun. Token yang ditolak FCM karena sudah kedaluwarsa
  dihapus oleh server.
- Klik notifikasi membuka halaman tujuan di aplikasi/situs yang sama. ID notifikasi
  dipakai sebagai tag agar notifikasi yang sama tidak menumpuk.

## Pemeriksaan lokal

`node scripts/test-push.cjs` memeriksa otorisasi, pemilihan penerima, kepemilikan
token, link internal, dan persistensi ketika FCM gagal menggunakan mock tanpa
mengirim pesan. Pengujian perangkat nyata tetap diperlukan untuk izin OS,
heads-up notification, dan pembatasan baterai masing-masing perangkat.

Dokumentasi Firebase: https://firebase.google.com/docs/cloud-messaging/web/receive-messages
dan https://firebase.google.com/docs/cloud-messaging/android/receive-messages.
