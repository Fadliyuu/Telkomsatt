# 🌱 Cara Push Data Contoh ke Database

## 📋 Ringkasan

Script `seed-data.js` digunakan untuk push **40+ data contoh** sparepart ke database sekaligus menggunakan batch write (lebih cepat).

## ⚠️ Perubahan

Script sekarang **memerlukan authentication** karena Firestore Security Rules memerlukan user yang sudah login untuk write data.

## 🚀 Cara Penggunaan

### Cara 1: Via Environment Variables (Recommended)

1. **Tambahkan ke `.env.local`**:
```env
ADMIN_EMAIL=admin@telkomsat.com
ADMIN_PASSWORD=your_admin_password
```

2. **Jalankan script**:
```bash
npm run seed:sample
```

### Cara 2: Via Command Line Arguments

```bash
npm run seed:sample admin@telkomsat.com yourpassword
```

### Cara 3: Buat Admin User Terlebih Dahulu

Jika belum punya admin user:

```bash
# Buat admin user
npm run seed:admin
```

Kemudian gunakan email dan password yang dibuat.

## 📊 Data yang Akan Di-push

Script akan push **40+ data contoh** yang mencakup:

- ✅ BUC (Block Up Converter) - berbagai watt
- ✅ LNB (Low Noise Block) - C-Band & KU-Band
- ✅ Modem Satellite - berbagai merk
- ✅ Antena VSAT - berbagai ukuran
- ✅ Power Supply & UPS
- ✅ Kabel & Connector
- ✅ Router & Switch
- ✅ Tools & Accessories
- ✅ Items dengan status berbeda (Tersedia, Digunakan, Rusak, Maintenance)

## 🔍 Output Script

Script akan menampilkan:
- ✅ Progress setiap item yang berhasil
- ❌ Error jika ada yang gagal
- 📊 Ringkasan akhir (berhasil/gagal/total)
- ⏱️ Waktu eksekusi

## 🐛 Troubleshooting

### Error: "Admin password tidak ditemukan"
**Solusi**: 
- Set environment variable `ADMIN_PASSWORD` di `.env.local`
- Atau gunakan command line: `npm run seed:sample admin@telkomsat.com password`

### Error: "auth/user-not-found" atau "auth/wrong-password"
**Solusi**: 
- Pastikan email dan password admin sudah benar
- Atau buat admin user baru dengan `npm run seed:admin`

### Error: "PERMISSION_DENIED"
**Solusi**: 
- Pastikan user yang digunakan memiliki role "admin" di Firestore collection `users`
- Cek Firestore Security Rules apakah sudah benar

### Semua item gagal
**Solusi**:
- Pastikan sudah login dengan benar
- Cek koneksi internet
- Cek Firebase config di `.env.local`
- Cek Firestore Security Rules

## ✅ Verifikasi Setelah Push

1. **Firestore Console**: 
   - Buka Firebase Console → Firestore Database
   - Cek collection `sparepart_items`
   - Harus ada 40+ document baru

2. **Web App**:
   - Buka `/spareparts` - Semua item harus muncul di list
   - Buka beberapa `/item/{itemId}` - Detail item dengan QR Code harus muncul

## 📝 Perbedaan dengan test-push-item.js

| Fitur | seed-data.js | test-push-item.js |
|-------|--------------|-------------------|
| Jumlah data | 40+ items (batch) | 1 item |
| Method | Batch Write | Single Add |
| Speed | Lebih cepat | Lebih lambat |
| Use case | Initial setup | Testing single item |

## 🎯 Kapan Menggunakan

- **seed-data.js**: Untuk initial setup atau push banyak data sekaligus
- **test-push-item.js**: Untuk testing push 1 item atau development

---

**Script sekarang sudah support authentication! 🎉**

