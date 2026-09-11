/** Jenis berita acara — menentukan layout form resmi Telkomsat */
export type BeritaAcaraJenis =
  | "perbaikan"
  | "maintenance"
  | "pemasangan"
  | "aktivasi"
  | "dismantle";

export type BeritaAcaraFormLayout = "ba_maintenance" | "laporan_pemeliharaan";

export type TipeMaintenance = "PM" | "CM";

/** Layanan pada form BA Maintenance (3 kolom) */
export const LAYANAN_BA_CHECKLIST: string[] = [
  "VSAT IP",
  "VSAT GYRO",
  "VSAT SCPC",
  "VSAT STAR",
  "MANGOSTAR",
  "MCS",
  "BGAN",
  "RADIO IP",
  "TV UPLINK SCPC",
  "MCPC",
  "AIS",
  "TRANSPONDER ONLY",
  "ASAP DIGITAL",
  "SUPPORT NETWORK (SN)",
  "VESSEL INFORMATION SYSTEM (VIS)",
];

export interface BeritaAcaraTemplate {
  jenis: BeritaAcaraJenis;
  label: string;
  judul: string;
  formLayout: BeritaAcaraFormLayout;
  formCode: string;
  formRev: string;
}

export const BERITA_ACARA_TEMPLATES: BeritaAcaraTemplate[] = [
  {
    jenis: "maintenance",
    label: "Berita Acara Maintenance (PM/CM)",
    judul: "BERITA ACARA MAINTENANCE",
    formLayout: "ba_maintenance",
    formCode: "Form-CM/PM-VSAT",
    formRev: "08",
  },
  {
    jenis: "perbaikan",
    label: "Laporan Pemeliharaan / Troubleshooting",
    judul: "LAPORAN PEMELIHARAAN",
    formLayout: "laporan_pemeliharaan",
    formCode: "Form-CM/PM-VSAT",
    formRev: "08",
  },
  {
    jenis: "pemasangan",
    label: "Pemasangan / Instalasi",
    judul: "BERITA ACARA PEMASANGAN & INSTALASI",
    formLayout: "ba_maintenance",
    formCode: "Form-INST-VSAT",
    formRev: "01",
  },
  {
    jenis: "aktivasi",
    label: "Aktivasi / Commissioning",
    judul: "BERITA ACARA AKTIVASI",
    formLayout: "ba_maintenance",
    formCode: "Form-AKT-VSAT",
    formRev: "01",
  },
  {
    jenis: "dismantle",
    label: "Dismantle / Pembongkaran",
    judul: "BERITA ACARA DISMANTLE",
    formLayout: "ba_maintenance",
    formCode: "Form-DSM-VSAT",
    formRev: "01",
  },
];

export function getBeritaAcaraTemplate(
  jenis: BeritaAcaraJenis
): BeritaAcaraTemplate {
  return (
    BERITA_ACARA_TEMPLATES.find((t) => t.jenis === jenis) ??
    BERITA_ACARA_TEMPLATES[0]
  );
}

/** Teks footer kantor Telkomsat (ringkas) */
export const TELKOMSAT_FOOTER_LINES = [
  "PT Telkom Satelit Indonesia (Kantor Utama & Pemasaran): Jl. Gatot Subroto Kav. 52, Jakarta Selatan 12710. Telp. (021) 5292 5292",
  "Pusat Pengendali Satelit: Jl. Raya Puncak KM 78, Cibinong-Bogor. Telp. (021) 8754 7854",
  "Pusat Transmisi Satelit: Jl. Raya Puncak KM 78, Cibinong-Bogor. Telp. (021) 8754 7854",
  "Kantor Pendukung: Jl. Alternatif Cibubur, Jakarta Timur. Telp. (021) 8459 4510",
  "www.telkomsat.co.id",
];
