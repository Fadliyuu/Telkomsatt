import {
  NormalizedSparepartRow,
  normalizeCariFisik,
  normalizeItemStatus,
  normalizeLokasi,
  DEFAULT_CARI_FISIK,
} from "@/lib/constants/sparepartItem";

export interface OcrPreviewRow extends NormalizedSparepartRow {
  id: string;
}

export function createEmptyOcrRow(): OcrPreviewRow {
  return {
    id: crypto.randomUUID(),
    namaPerangkat: "",
    serialNumber: "",
    tagging: "",
    kategori: "",
    status: "Tersedia",
    lokasiSaatIni: "Gudang",
    keterangan: "",
    cariFisik: DEFAULT_CARI_FISIK,
  };
}

type Column = keyof NormalizedSparepartRow | "ignore";

function headerColumn(value: string): Column | null {
  const key = value.toLowerCase().replace(/[._:]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(nama perangkat|nama barang|nama sparepart|nama|perangkat)$/.test(key)) return "namaPerangkat";
  if (/^(serial number|serial|nomor seri|no seri|sn|s\/n)$/.test(key)) return "serialNumber";
  if (/^(tag|tagging|no tag|nomor tag)$/.test(key)) return "tagging";
  if (/^(cari fisik|hasil fisik)$/.test(key)) return "cariFisik";
  if (/^(status|status stok|kondisi)$/.test(key)) return "status";
  if (/^(lokasi|lokasi saat ini)$/.test(key)) return "lokasiSaatIni";
  if (/^kategori$/.test(key)) return "kategori";
  if (/^(keterangan|catatan)$/.test(key)) return "keterangan";
  if (/^(no|nomor|tanggal|tanggal update)$/.test(key)) return "ignore";
  return null;
}

function headerColumns(part: string): (Column | null)[] {
  const exact = headerColumn(part);
  if (exact) return [exact];
  // OCR can collapse the gaps between adjacent header titles while retaining data gaps.
  const titles = /\b(?:nama perangkat|nama barang|nama sparepart|serial number|nomor seri|no seri|nomor tag|no tag|cari fisik|hasil fisik|status stok|lokasi saat ini|tanggal update|nama|perangkat|serial|sn|s\/n|tagging|tag|status|kondisi|lokasi|kategori|keterangan|catatan|nomor|no|tanggal)\b/gi;
  const matches = [...part.matchAll(titles)];
  if (matches.length < 2 || part.replace(titles, "").trim()) return [null];
  return matches.map((match) => headerColumn(match[0]));
}

function splitLine(line: string): string[] {
  // Keep empty interior cells: dropping them moves a tag into the serial-number column.
  if (line.includes("|")) {
    return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((part) => part.trim());
  }
  if (line.includes("\t")) return line.split("\t").map((part) => part.trim());
  return line.split(/ {2,}/).map((part) => part.trim());
}

function identifier(value: string, kind: "sn" | "tag"): string {
  if (/^[-–—]+$/.test(value.trim())) return "";
  // Only strip an explicit label separator; SN12345 and TAG-001 are actual identifiers.
  const label = kind === "sn" ? /^(?:serial number|s\/n|sn)\s*:\s*/i : /^(?:tagging|tag)\s*:\s*/i;
  return value.replace(label, "").trim();
}

function parseUnstructuredLine(line: string): Partial<NormalizedSparepartRow> {
  const labels = [...line.matchAll(/\b(serial number|s\/n|sn|tagging|tag)\s*:\s*/gi)];
  if (labels.length === 0) return { namaPerangkat: line };
  const values: Partial<NormalizedSparepartRow> = {
    namaPerangkat: line.slice(0, labels[0].index).trim(),
  };
  for (let i = 0; i < labels.length; i++) {
    const match = labels[i];
    const value = line.slice(match.index! + match[0].length, labels[i + 1]?.index ?? line.length).trim();
    const field = /^(tag|tagging)$/i.test(match[1]) ? "tagging" : "serialNumber";
    values[field] = value;
  }
  return values;
}

/** Heuristic table parser. Preview and correction remain required before import. */
export function parseOcrTextToRows(text: string): OcrPreviewRow[] {
  const lines = text.replace(/\u00a0/g, " ").split(/\r?\n/).filter((line) => line.trim().length > 1);
  const rows: OcrPreviewRow[] = [];
  let columns: (Column | null)[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^[\s|+\-_:]+$/.test(line)) continue;
    const parts = splitLine(line);
    const candidate = parts.flatMap(headerColumns);
    if (candidate.includes("namaPerangkat") &&
        (candidate.includes("serialNumber") || candidate.includes("tagging"))) {
      columns = candidate;
      continue;
    }
    // A collapsed header has no usable boundaries, but is still not an inventory item.
    if (parts.length === 1 && /nama\s+(perangkat|barang).*\b(serial number|sn|tagging|tag)\b/i.test(line)) continue;

    let values: Partial<NormalizedSparepartRow> = {};
    if (columns && parts.length > 1) {
      columns.forEach((column, index) => {
        if (column && column !== "ignore") Object.assign(values, { [column]: parts[index] ?? "" });
      });
    } else if (parts.length > 1) {
      const cells = [...parts];
      if (/^\d+[.)]?$/.test(cells[0]) && cells.length >= 3) cells.shift();
      const [namaPerangkat, serialNumber = "", tagging = "", cariFisik = "", status = "", lokasiSaatIni = "", ...notes] = cells;
      values = { namaPerangkat, serialNumber, tagging, keterangan: notes.join(" ") };
      // Normalizers accept arbitrary OCR strings and provide safe preview defaults.
      Object.assign(values, { cariFisik, status, lokasiSaatIni });
    } else {
      values = parseUnstructuredLine(line);
    }
    if (!values.namaPerangkat?.trim() || values.namaPerangkat.trim().length < 2) continue;
    rows.push({
      ...createEmptyOcrRow(),
      ...values,
      namaPerangkat: values.namaPerangkat.trim(),
      serialNumber: identifier(values.serialNumber ?? "", "sn"),
      tagging: identifier(values.tagging ?? "", "tag"),
      status: normalizeItemStatus(values.status),
      cariFisik: normalizeCariFisik(values.cariFisik),
      lokasiSaatIni: normalizeLokasi(values.lokasiSaatIni),
    });
  }
  return rows;
}

export function validateOcrRow(row: NormalizedSparepartRow, lineIndex: number): string | null {
  if (!row.namaPerangkat.trim()) return `Baris ${lineIndex}: Nama Perangkat wajib`;
  if (!row.serialNumber.trim() && !row.tagging.trim()) return `Baris ${lineIndex}: SN atau Tag wajib salah satu`;
  return null;
}

export function normalizeOcrRow(row: OcrPreviewRow): NormalizedSparepartRow {
  return {
    namaPerangkat: row.namaPerangkat.trim(),
    serialNumber: row.serialNumber.trim(),
    tagging: row.tagging.trim(),
    kategori: row.kategori.trim(),
    status: normalizeItemStatus(row.status),
    lokasiSaatIni: normalizeLokasi(row.lokasiSaatIni),
    keterangan: row.keterangan.trim(),
    cariFisik: normalizeCariFisik(row.cariFisik),
  };
}
