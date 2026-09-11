# 🔧 Fix: PERMISSION_DENIED Error

## ❌ Masalah

Saat menjalankan `npm run test:push-item`, muncul error:
```
PERMISSION_DENIED: Missing or insufficient permissions
```

## 🔍 Penyebab

Script menggunakan Firebase Client SDK tanpa authentication, sedangkan Firestore Security Rules memerlukan user yang sudah login untuk write ke collection `sparepart_items`.

## ✅ Solusi

Script sudah diperbaiki untuk login terlebih dahulu sebelum push item. Ada 3 cara penggunaan:

### Cara 1: Via Environment Variables (Recommended)

1. **Tambahkan ke `.env.local`**:
```env
ADMIN_EMAIL=admin@telkomsat.com
ADMIN_PASSWORD=your_admin_password
```

2. **Jalankan script**:
```bash
npm run test:push-item
```

### Cara 2: Via Command Line Arguments

```bash
# Basic usage
npm run test:push-item admin@telkomsat.com yourpassword

# Dengan data custom
npm run test:push-item admin@telkomsat.com yourpassword "Nama Perangkat" "SN123" "TAG001"
```

### Cara 3: Buat Admin User Terlebih Dahulu

Jika belum punya admin user:

```bash
# Buat admin user
npm run seed:admin
```

Kemudian gunakan email dan password yang dibuat untuk login.

## 📝 Contoh Penggunaan

### Contoh 1: Default Data
```bash
npm run test:push-item admin@telkomsat.com password123
```

### Contoh 2: Custom Data
```bash
npm run test:push-item admin@telkomsat.com password123 "BUC 2 WATT" "SN001" "TAG001"
```

## 🔐 Security Note

⚠️ **PENTING**: Jangan commit file `.env.local` ke git! File ini berisi credential sensitif.

## 🐛 Troubleshooting

### Error: "auth/user-not-found" atau "auth/wrong-password"
**Solusi**: 
- Pastikan email dan password admin sudah benar
- Atau buat admin user baru dengan `npm run seed:admin`

### Error: "auth/invalid-email"
**Solusi**: Pastikan format email benar (contoh: admin@telkomsat.com)

### Error: "PERMISSION_DENIED" setelah login
**Solusi**: 
- Pastikan user yang digunakan memiliki role "manager" atau "admin_gudang" di Firestore collection `users`
- Cek Firestore Security Rules apakah sudah benar

## 📚 Alternatif: Update Firestore Rules (Development Only)

Jika ingin script bisa push tanpa login (HANYA untuk development):

1. Buka Firebase Console → Firestore Database → Rules
2. Update rules untuk `sparepart_items`:
```javascript
match /sparepart_items/{itemId} {
  allow read: if true;
  allow write: if true; // ⚠️ HANYA untuk development!
}
```

⚠️ **JANGAN** gunakan rules ini di production!

## ✅ Verifikasi

Setelah script berhasil, cek:
1. Firestore Console → Collection `sparepart_items` → Document baru muncul
2. Web App → `/spareparts` → Item muncul di list
3. Web App → `/item/{itemId}` → Detail item dengan QR Code

---

**Script sekarang sudah bisa push item dengan authentication! 🎉**

