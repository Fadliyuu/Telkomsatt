# 🔧 Troubleshooting: Seed Data Error

## ❌ Error: `auth/invalid-email`

### Penyebab
Email yang digunakan tidak valid atau formatnya salah.

### Solusi

#### 1. Cek Format Email di `.env.local`

Pastikan email menggunakan format yang benar:
```env
# ✅ BENAR
ADMIN_EMAIL=admin@telkomsat.com
ADMIN_PASSWORD=password123

# ❌ SALAH
ADMIN_EMAIL=admin                    # Tidak ada @
ADMIN_EMAIL=admin@                   # Tidak ada domain
ADMIN_EMAIL=admin@telkomsat          # Tidak ada .com
ADMIN_EMAIL=                         # Kosong
```

#### 2. Cek Apakah Email Sudah Dibuat di Firebase

Email harus sudah dibuat di Firebase Authentication terlebih dahulu:

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project Anda
3. Klik **Authentication** > **Users**
4. Cek apakah email sudah ada di list
5. Jika belum, klik **Add user** dan buat user baru

#### 3. Buat Admin User dengan Script

```bash
npm run seed:admin
```

Script ini akan memandu Anda membuat admin user.

#### 4. Gunakan Command Line (Lebih Jelas)

```bash
npm run seed:sample admin@telkomsat.com yourpassword
```

## ❌ Error: `auth/user-not-found`

### Penyebab
Email yang digunakan belum terdaftar di Firebase Authentication.

### Solusi

1. **Buat user di Firebase Console**:
   - Buka Firebase Console > Authentication > Users
   - Klik "Add user"
   - Isi email dan password
   - Klik "Add user"

2. **Atau gunakan script**:
   ```bash
   npm run seed:admin
   ```

3. **Kemudian jalankan seed lagi**:
   ```bash
   npm run seed:sample admin@telkomsat.com yourpassword
   ```

## ❌ Error: `auth/wrong-password`

### Penyebab
Password yang digunakan salah.

### Solusi

1. **Cek password di `.env.local`** - pastikan tidak ada typo
2. **Atau reset password di Firebase Console**:
   - Buka Firebase Console > Authentication > Users
   - Klik email user
   - Klik "Reset password"
   - Kirim reset link ke email

## ❌ Error: `PERMISSION_DENIED`

### Penyebab
User tidak memiliki permission untuk write ke Firestore.

### Solusi

1. **Pastikan user memiliki role "manager"**:
   - Buka Firestore Console
   - Collection `users`
   - Cari document dengan ID = UID user
   - Pastikan field `role` = "manager"

2. **Atau buat admin user dengan script**:
   ```bash
   npm run seed:admin
   ```

## ✅ Checklist Sebelum Seed

- [ ] Email sudah dibuat di Firebase Authentication
- [ ] Password sudah benar
- [ ] Format email valid (ada @ dan domain)
- [ ] User memiliki role "manager" di Firestore collection `users`
- [ ] `.env.local` sudah diisi dengan benar
- [ ] Koneksi internet stabil
- [ ] Firebase config sudah benar

## 📝 Contoh `.env.local` yang Benar

```env
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Admin Credentials (untuk script)
ADMIN_EMAIL=admin@telkomsat.com
ADMIN_PASSWORD=your_secure_password
```

## 🚀 Langkah-langkah Setup Lengkap

1. **Buat user di Firebase Authentication**:
   - Email: `admin@telkomsat.com`
   - Password: `yourpassword`

2. **Buat admin document di Firestore**:
   ```bash
   npm run seed:admin
   ```
   - Masukkan UID dari Firebase Console
   - Masukkan email dan nama

3. **Push data contoh**:
   ```bash
   npm run seed:sample admin@telkomsat.com yourpassword
   ```

## 💡 Tips

- Gunakan email yang mudah diingat
- Simpan password dengan aman (jangan commit ke git)
- Gunakan password yang kuat
- Test dengan 1 item dulu sebelum push banyak data

---

**Jika masih error, pastikan semua checklist di atas sudah dilakukan! ✅**

