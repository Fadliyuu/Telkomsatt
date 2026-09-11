// Local OCR regressions: no Firebase, camera, upload, or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function load(file, mocks = {}, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports, module, console, crypto, DOMException, setTimeout, clearTimeout,
    require: name => { if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`); return mocks[name]; },
    ...extra,
  }, { filename: file });
  return module.exports;
}

async function main() {
  const constants = load('lib/constants/sparepartItem.ts');
  const parser = load('lib/utils/ocrImport.ts', { '@/lib/constants/sparepartItem': constants });
  const rows = parser.parseOcrTextToRows([
    'No | Nama Perangkat | Serial Number | Tag | Cari Fisik | Status Stok | Lokasi | Kategori | Keterangan',
    '1 | Router Mikrotik | ABC123456 | TAG-001 | Sesuai | Tersedia | Gudang | Jaringan | Status diperiksa',
    '2 | Modem Satelit | | TAG-002 | Tidak Ditemukan | Rusak | Site Bogor | Modem | Lokasi belum dikonfirmasi',
  ].join('\n'));
  assert.equal(rows.length, 2, 'TAG/status/lokasi in data must not be treated as a header');
  assert.equal(rows[0].namaPerangkat, 'Router Mikrotik');
  assert.equal(rows[0].kategori, 'Jaringan');
  assert.equal(rows[0].tagging, 'TAG-001', 'Preserve the tag prefix');
  assert.equal(rows[1].serialNumber, '', 'Empty cells must retain their column position');
  assert.equal(rows[1].tagging, 'TAG-002');
  assert.equal(rows[1].status, 'Rusak');
  assert.equal(rows[1].cariFisik, 'Tidak Ditemukan');
  assert.equal(rows[1].lokasiSaatIni, 'Site Bogor');
  assert.equal(parser.validateOcrRow(parser.normalizeOcrRow(rows[1]), 2), null);

  const reordered = parser.parseOcrTextToRows('Tag\tNama Perangkat\tKategori\tSerial Number\tLokasi\nR6-004\tAntena\tRadio\tSN12345\tGudang')[0];
  assert.equal(reordered.namaPerangkat, 'Antena');
  assert.equal(reordered.serialNumber, 'SN12345', 'Do not strip an actual SN prefix');
  assert.equal(reordered.tagging, 'R6-004');
  assert.equal(reordered.kategori, 'Radio');
  const collapsed = parser.parseOcrTextToRows('Nama Perangkat    Serial Number    Tag    Cari Fisik Status Stok Lokasi\nRadio Link    ABC123456    TAG-003    Sesuai    Rusak    Site Bogor')[0];
  assert.equal(collapsed.status, 'Rusak', 'Collapsed header gaps must not hide damage status');
  assert.equal(collapsed.lokasiSaatIni, 'Site Bogor');
  const labeled = parser.parseOcrTextToRows('Radio Link SN: ABC54321 Tag: TLSAT-003')[0];
  assert.equal(labeled.namaPerangkat, 'Radio Link');
  assert.equal(labeled.serialNumber, 'ABC54321');
  assert.equal(labeled.tagging, 'TLSAT-003');
  assert.match(parser.validateOcrRow(parser.parseOcrTextToRows('Nama tanpa identitas')[0], 1), /SN atau Tag/);

  const actualPath = process.argv[2];
  if (actualPath) {
    const actual = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
    assert.equal(actual.ok, true);
    const recognized = parser.parseOcrTextToRows(actual.text);
    assert.equal(recognized.length, 2);
    assert.equal(recognized[0].namaPerangkat, 'Router Mikrotik');
    assert.equal(recognized[0].serialNumber, 'ABC123456');
    assert.equal(recognized[0].tagging, 'TAG-001');
    assert.equal(recognized[1].namaPerangkat, 'Modem Satelit');
    // This synthetic photo reads Z as 7: preserve the engine result for human correction.
    assert.equal(recognized[1].serialNumber, '7X987654');
    assert.equal(recognized[1].status, 'Rusak');
    assert.equal(recognized[1].lokasiSaatIni, 'Site Bogor');
    console.log(`Actual browser OCR: ${recognized.length} rows, confidence ${actual.confidence}%`);
  }

  let terminated = 0;
  let mode = 'success';
  let onRecognize;
  const worker = {
    setParameters: async params => assert.equal(params.preserve_interword_spaces, '1'),
    recognize: async () => {
      onRecognize?.();
      if (mode === 'failure') throw new Error('bad image');
      if (mode === 'abort') return new Promise(() => {});
      return { data: { text: 'recognized', confidence: 91 } };
    },
    terminate: async () => { terminated++; },
  };
  const ocr = load('lib/utils/ocrRecognition.ts', { 'tesseract.js': {
    createWorker: async (langs, oem) => { assert.equal(langs, 'ind+eng'); assert.equal(oem, 1); return worker; },
  } });
  assert.equal((await ocr.recognizeInventoryImage('synthetic')).text, 'recognized');
  assert.equal(terminated, 1);
  mode = 'failure';
  await assert.rejects(ocr.recognizeInventoryImage('synthetic'), /bad image/);
  assert.equal(terminated, 2, 'Failed recognition must release its worker');
  mode = 'abort';
  const controller = new AbortController();
  onRecognize = () => controller.abort();
  await assert.rejects(ocr.recognizeInventoryImage('synthetic', { signal: controller.signal }), /dibatalkan/);
  assert.equal(terminated, 3, 'Unmount/abort must release an initialized worker');

  const startupFailure = load('lib/utils/ocrRecognition.ts', { 'tesseract.js': {
    createWorker: (_langs, _oem, options) => {
      queueMicrotask(() => options.errorHandler(new Error('language download failed')));
      return new Promise(() => {});
    },
  } });
  await assert.rejects(startupFailure.recognizeInventoryImage('synthetic'), /language download failed/);
  let releaseWorker;
  const late = load('lib/utils/ocrRecognition.ts', { 'tesseract.js': {
    createWorker: () => new Promise(resolve => { releaseWorker = resolve; }),
  } });
  const lateController = new AbortController();
  const pending = late.recognizeInventoryImage('synthetic', { signal: lateController.signal });
  await new Promise(resolve => setImmediate(resolve));
  lateController.abort();
  await assert.rejects(pending, /dibatalkan/);
  releaseWorker(worker);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(terminated, 4, 'A worker finishing startup after cancellation must also terminate');
  console.log('PASS: OCR table mapping, blank cells, identifiers, validation, recognition cleanup, abort and startup errors');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
