# Dokumentasi: Push Item Sparepart ke Database

## 📋 Cara Kerja Fungsi `createSparepartItem`

### Lokasi File
- **Fungsi**: `lib/firebase/sparepartItems.ts`
- **Halaman Form**: `app/spareparts/tambah/page.tsx`

### Flow Proses

```
1. User mengisi form di halaman /spareparts/tambah
   ↓
2. Form submit → handleSubmit()
   ↓
3. Validasi: namaPerangkat wajib diisi
   ↓
4. Panggil createSparepartItem(data)
   ↓
5. Cek Serial Number (jika ada) - pastikan unik
   ↓
6. Siapkan data item dengan Timestamp
   ↓
7. Add document ke Firestore collection "sparepart_items"
   ↓
8. Generate QR Code URL: {baseUrl}/scan/{itemId}
   ↓
9. Generate QR Code image (Data URL)
   ↓
10. Update document dengan qrCodeUrl
   ↓
11. Return { itemId, qrCodeDataUrl }
   ↓
12. Redirect ke /item/{itemId} untuk download QR
```

### Field yang Disimpan

#### Wajib:
- `namaPerangkat` (string) - Nama perangkat
- `createdAt` (Timestamp) - Auto-generated
- `updatedAt` (Timestamp) - Auto-generated

#### Opsional:
- `serialNumber` (string) - Serial Number (unik jika diisi)
- `tagging` (string) - Tag/Label
- `cariFisik` ("Sesuai" | "Tidak Ditemukan" | "Outstanding" | "Mutasi Keluar")
- `lokasiSaatIni` (string) - Default: "Gudang"
- `status` ("Tersedia" | "Digunakan" | "Rusak" | "Hilang" | "Maintenance") - Default: "Tersedia"
- `keterangan` (string)
- `fotoUrl` (string[]) - Array URL foto
- `idSparepart` (string) - Reference ke sparepart type
- `qrCodeUrl` (string) - Auto-generated setelah create
- `ditambahkanOleh` (string) - Nama teknisi (jika dari teknisi)
- `jenisTeknisi` ("freelance" | "karyawan" | "vendor")
- `perluVerifikasi` (boolean) - Default: false (true jika dari teknisi)

### Validasi

1. **Serial Number Unik**: Jika SN diisi, sistem akan cek apakah sudah ada
2. **Nama Perangkat Wajib**: Harus diisi, tidak boleh kosong
3. **QR Code URL**: Otomatis dibuat setelah document dibuat

### Error Handling

- Jika SN sudah ada → Error: "Serial Number {SN} sudah digunakan"
- Jika namaPerangkat kosong → Error dari form validation
- Jika gagal create → Error dari Firestore

## 🚀 Cara Push Item ke Database

### Metode 1: Via Form Web (Recommended)

1. Login sebagai Admin
2. Buka halaman: `/spareparts/tambah`
3. Isi form:
   - Nama Perangkat: **Wajib**
   - Serial Number: Opsional
   - Tag/Label: Opsional
   - Cari Fisik: Pilih dari dropdown
   - Lokasi: Opsional (default: Gudang)
   - Keterangan: Opsional
4. Klik "Simpan & Generate QR Code"
5. Item akan tersimpan dan redirect ke halaman detail dengan QR Code

### Metode 2: Via API/Function Call

```typescript
import { createSparepartItem } from "@/lib/firebase/sparepartItems";

// Contoh penggunaan
const result = await createSparepartItem({
  namaPerangkat: "BUC 2 WATT FULL C-BAND",
  serialNumber: "A07458A12",
  tagging: "TLSAT1339900026009",
  cariFisik: "Sesuai",
  lokasiSaatIni: "Gudang",
  status: "Tersedia",
  keterangan: "Item baru dari gudang utama"
});

console.log("Item ID:", result.itemId);
console.log("QR Code Data URL:", result.qrCodeDataUrl);
```

### Metode 3: Via Script (Batch Import)

Lihat file: `scripts/seed-data.js` untuk contoh batch import.

## 📝 Contoh Data Item

```typescript
{
  namaPerangkat: "BUC 2 WATT FULL C-BAND NIT8102WF - NIF",
  serialNumber: "A07458A12",
  tagging: "TLSAT1339900026009",
  cariFisik: "Sesuai",
  lokasiSaatIni: "Gudang",
  status: "Tersedia",
  keterangan: "Item dalam kondisi baik"
}
```

## ✅ Checklist Sebelum Push

- [ ] Nama Perangkat sudah diisi
- [ ] Serial Number unik (jika diisi)
- [ ] Cari Fisik sudah dipilih
- [ ] Lokasi sudah ditentukan
- [ ] Status sudah ditentukan
- [ ] Koneksi Firebase sudah OK
- [ ] Permission Firestore sudah benar

## 🔍 Verifikasi Data

Setelah push, cek di:
1. Firestore Console → Collection `sparepart_items`
2. Halaman `/spareparts` - Item harus muncul di list
3. Halaman `/item/{itemId}` - Detail item dengan QR Code

## 🐛 Troubleshooting

### Error: "Serial Number sudah digunakan"
- **Solusi**: Gunakan SN yang berbeda atau kosongkan field SN

### Error: "Gagal menambah sparepart"
- **Solusi**: 
  - Cek koneksi internet
  - Cek Firebase config di `.env.local`
  - Cek Firestore Security Rules
  - Cek console untuk error detail

### QR Code tidak muncul
- **Solusi**: 
  - Pastikan `qrCodeUrl` sudah ter-update di document
  - Cek apakah redirect ke `/item/{itemId}` berhasil
  - Reload halaman

### Item tidak muncul di list
- **Solusi**:
  - Cek Firestore Console apakah document sudah dibuat
  - Refresh halaman `/spareparts`
  - Cek filter/search di halaman list

