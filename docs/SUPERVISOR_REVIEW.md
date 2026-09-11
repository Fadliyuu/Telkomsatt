# Pemeriksaan alur supervisor — 10 September 2026

## Alur yang diperiksa

- Login → dashboard sesuai role atau tujuan internal yang diizinkan.
- Dashboard → daftar transaksi berstatus pending → detail transaksi.
- Laporan → rentang tanggal/jenis/teknisi → detail transaksi atau ekspor PDF.
- Aktivitas/notifikasi → tujuan yang dapat dibuka supervisor.
- Profil sendiri dan tampilan detail barang.

Supervisor memonitor transaksi dan inventaris. Persetujuan/penolakan transaksi serta perubahan inventaris tetap merupakan wewenang Admin Gudang. API profil memperbarui dokumen berdasarkan UID token dan hanya menerima atribut profil yang diizinkan.

## Temuan dan perbaikan

| Temuan | Dampak | Perbaikan |
| --- | --- | --- |
| Dashboard menautkan `/spareparts/verifikasi`, yang dilarang RBAC supervisor | Tombol monitoring berujung penolakan akses | Arahkan ke `/transaksi?status=pending`; daftar membaca parameter status |
| Angka pengajuan memakai `sparepart_items.perluVerifikasi` | Angka tidak merepresentasikan transaksi pending | Hitung dokumen transaksi berstatus pending dengan agregasi Firestore |
| Dashboard induk memuat data juga untuk role yang memiliki dashboard sendiri | Query ganda, termasuk query yang tidak dibutuhkan | Jalankan pemuatan dashboard sistem hanya untuk role yang memakai view tersebut |
| Dashboard tidak menangani kegagalan query | Statistik nol bisa disangka data yang benar | Tampilkan pesan gagal dan tombol mencoba lagi |
| Daftar/laporan umum memakai batas bawaan 100 transaksi | Transaksi lama, opsi filter, total, dan PDF bisa tidak lengkap | Ambil seluruh hasil secara bertahap, 200 dokumen per halaman; pemanggil lain tetap dibatasi 100 secara bawaan |
| Daftar teknisi memfilter UID setelah query seluruh koleksi | Query tidak sesuai aturan baca Firestore teknisi | Filter UID di query sebelum membaca, tetap dibatasi kepemilikan pengguna |
| Awal tanggal laporan dibaca sebagai UTC; akhir tanggal berhenti sebelum milidetik terakhir | Transaksi pada batas tanggal dapat terlewat | Gunakan awal/akhir hari lokal, validasi tanggal dan urutannya |
| Filter OUT tidak tersedia | Barang Keluar tidak dapat dipilih tersendiri | Tambahkan opsi OUT |
| Permintaan laporan lama dapat selesai setelah permintaan terbaru | Data atau PDF tidak sesuai filter yang terlihat | Abaikan respons lama; nonaktifkan ekspor hingga hasil cocok dengan filter saat ini |
| Gagal mengambil aktivitas/notifikasi dapat berubah menjadi hasil kosong | Pengguna tidak mengetahui pemuatan gagal | Teruskan kegagalan dan tampilkan keadaan error dengan retry |
| Tautan notifikasi/login tidak disesuaikan dengan role | Supervisor dapat diarahkan ke halaman terlarang; parameter login juga menerima tujuan eksternal | Validasi tujuan internal dan role; ubah tautan verifikasi supervisor menjadi monitoring pending |
| Prefix `/transaksi` juga mengizinkan keranjang supervisor | RBAC mengizinkan halaman yang kemudian mengalihkan kembali | Batasi rute keranjang untuk teknisi |
| Petunjuk keranjang menyebut Supervisor/Manager sebagai pemberi persetujuan | Informasi alur bertentangan dengan kode dan aturan database | Nyatakan Admin Gudang sebagai pemberi persetujuan |

## Validasi

- `node scripts/test-supervisor-flow.cjs`: akses role, tautan, hitungan dashboard, error/retry, batas tanggal lokal, 405 transaksi melewati beberapa halaman, UID teknisi, filter OUT, payload ekspor, dan respons laporan yang datang tidak berurutan.
- `node scripts/test-transaction-contracts.cjs`: kontrak identitas, metadata, dan transaksi inventaris yang sudah tersedia.
- `node scripts/test-workflow-rules.js`: pemeriksaan statis aturan dan simulasi alur yang sudah tersedia; bukan pengujian Firestore Emulator.
- TypeScript dan ESLint pada kode yang diubah.
- Build produksi Next.js. Lint seluruh proyek masih melaporkan peringatan lama pada dependensi efek di halaman scan/detail sparepart/QRScanner serta penggunaan `img` pada detail sparepart/ImageUpload; file yang diubah dalam perbaikan ini bersih dari peringatan lint.
- Render komponen/CSS di Chromium pada lebar 320, 393, 768, 1024, dan 1440 untuk dashboard, laporan, dan daftar transaksi; data/auth/notifikasi menggunakan mock. Memeriksa satu layout, kontrol yang tidak terpotong, dan tidak ada overflow halaman.

## Batas pemeriksaan

Pengujian tidak memakai akun supervisor produksi, tidak mengubah data Firestore, dan tidak menjalankan perangkat Android fisik. Pengujian ekspor memeriksa data yang dikirim ke pembuat PDF, bukan hasil visual file PDF. Halaman Aktivitas masih mengambil notifikasi yang ditujukan kepada role/UID pengguna, dengan batas 150 baris; ini bukan penampil seluruh koleksi audit `aktivitas`.
