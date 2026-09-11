# 🚀 Cara Push Item Sparepart ke Database

## 📖 Ringkasan Fungsi

### Fungsi Utama: `createSparepartItem`

**Lokasi**: `lib/firebase/sparepartItems.ts`

**Cara Kerja**:
1. ✅ Validasi Serial Number (jika diisi, harus unik)
2. ✅ Siapkan data dengan Timestamp
3. ✅ Create document di Firestore collection `sparepart_items`
4. ✅ Generate QR Code URL: `{baseUrl}/scan/{itemId}`
5. ✅ Update document dengan `qrCodeUrl`
6. ✅ Return `{ itemId, qrCodeDataUrl }`

## 🎯 Metode Push Item

### Metode 1: Via Web Form (Paling Mudah) ⭐

1. **Login sebagai Admin**
2. **Buka**: `http://localhost:3000/spareparts/tambah`
3. **Isi Form**:
   - **Nama Perangkat** (Wajib): Contoh "BUC 2 WATT FULL C-BAND"
   - **Serial Number** (Opsional): Contoh "A07458A12"
   - **Tag/Label** (Opsional): Contoh "TLSAT1339900026009"
   - **Cari Fisik** (Wajib): Pilih dari dropdown
   - **Lokasi** (Opsional): Default "Gudang"
   - **Keterangan** (Opsional)
4. **Klik**: "Simpan & Generate QR Code"
5. **Selesai!** Item tersimpan dan redirect ke halaman detail

### Metode 2: Via Script (Test/Development)

```bash
# Test dengan data default
npm run test:push-item

# Atau dengan data custom
node scripts/test-push-item.js "Nama Perangkat" "SN123" "TAG001"
```

**Output**:
```
✅ Item created with ID: abc123xyz...
📱 QR Code URL: http://localhost:3000/scan/abc123xyz...
```

### Metode 3: Via Code (Programmatic)

```typescript
import { createSparepartItem } from "@/lib/firebase/sparepartItems";

const result = await createSparepartItem({
  namaPerangkat: "BUC 2 WATT FULL C-BAND",
  serialNumber: "A07458A12",
  tagging: "TLSAT1339900026009",
  cariFisik: "Sesuai",
  lokasiSaatIni: "Gudang",
  status: "Tersedia",
  keterangan: "Item baru"
});

console.log("Item ID:", result.itemId);
console.log("QR Code:", result.qrCodeDataUrl);
```

## 📋 Field yang Tersedia

### Wajib:
- `namaPerangkat` (string) - **HARUS DIISI**

### Opsional:
- `serialNumber` (string) - Harus unik jika diisi
- `tagging` (string)
- `cariFisik` ("Sesuai" | "Tidak Ditemukan" | "Outstanding" | "Mutasi Keluar")
- `lokasiSaatIni` (string) - Default: "Gudang"
- `status` ("Tersedia" | "Digunakan" | "Rusak" | "Hilang" | "Maintenance") - Default: "Tersedia"
- `keterangan` (string)
- `fotoUrl` (string[])
- `idSparepart` (string) - Reference ke sparepart type
- `ditambahkanOleh` (string) - Untuk tracking teknisi
- `jenisTeknisi` ("freelance" | "karyawan" | "vendor")
- `perluVerifikasi` (boolean) - Default: false

### Auto-Generated:
- `id` - Firebase document ID
- `createdAt` - Timestamp
- `updatedAt` - Timestamp
- `qrCodeUrl` - URL untuk scan QR code

## ✅ Checklist Sebelum Push

- [ ] Firebase config sudah benar di `.env.local`
- [ ] Koneksi internet stabil
- [ ] Firestore Security Rules sudah di-set
- [ ] Nama Perangkat sudah diisi
- [ ] Serial Number unik (jika diisi)
- [ ] Cari Fisik sudah dipilih

## 🔍 Verifikasi Setelah Push

1. **Firestore Console**: 
   - Buka Firebase Console → Firestore Database
   - Cek collection `sparepart_items`
   - Document baru harus muncul

2. **Web App**:
   - Buka `/spareparts` - Item harus muncul di list
   - Buka `/item/{itemId}` - Detail item dengan QR Code

3. **QR Code**:
   - QR Code harus bisa di-scan
   - URL harus mengarah ke `/scan/{itemId}`

## 🐛 Troubleshooting

### Error: "Serial Number sudah digunakan"
**Solusi**: Gunakan SN yang berbeda atau kosongkan field SN

### Error: "Gagal menambah sparepart"
**Solusi**: 
- Cek koneksi internet
- Cek Firebase config di `.env.local`
- Cek Firestore Security Rules
- Cek console browser untuk error detail

### Item tidak muncul di list
**Solusi**:
- Refresh halaman `/spareparts`
- Cek Firestore Console apakah document sudah dibuat
- Cek filter/search di halaman list

### QR Code tidak muncul
**Solusi**:
- Pastikan `qrCodeUrl` sudah ter-update di document
- Cek apakah redirect ke `/item/{itemId}` berhasil
- Reload halaman

## 📚 File Terkait

- **Fungsi**: `lib/firebase/sparepartItems.ts`
- **Form UI**: `app/spareparts/tambah/page.tsx`
- **Types**: `types/index.ts`
- **Test Script**: `scripts/test-push-item.js`
- **Dokumentasi Lengkap**: `docs/PUSH_ITEM_TO_DATABASE.md`

## 🎓 Contoh Data Lengkap

```typescript
{
  namaPerangkat: "BUC 2 WATT FULL C-BAND NIT8102WF - NIF",
  serialNumber: "A07458A12",
  tagging: "TLSAT1339900026009",
  cariFisik: "Sesuai",
  lokasiSaatIni: "Gudang",
  status: "Tersedia",
  keterangan: "Item dalam kondisi baik, siap digunakan"
}
```

---

**Selamat! Item sparepart Anda sudah berhasil di-push ke database! 🎉**

