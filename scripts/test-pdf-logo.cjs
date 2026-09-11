// Real jsPDF output using local assets; no network or Firebase access.
// Optional argument: directory in which to save sample PDFs for visual review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { jsPDF } = require('jspdf');

const root = path.resolve(__dirname, '..');
const outputDir = process.argv[2] && path.resolve(process.argv[2]);
if (outputDir) fs.mkdirSync(outputDir, { recursive: true });
const logo = fs.readFileSync(path.join(root, 'public/logo/logo.png'));
const calls = [];
const documents = [];
const env = {};
let fetchMode = 'success';
const modules = new Map();

function capturePdf(options) {
  const doc = new jsPDF(options);
  doc.save = filename => {
    const bytes = Buffer.from(doc.output('arraybuffer'));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    documents.push({ filename, doc });
    if (outputDir) fs.writeFileSync(path.join(outputDir, filename), bytes);
  };
  return doc;
}

function load(relativePath) {
  const absolute = path.join(root, relativePath);
  if (modules.has(absolute)) return modules.get(absolute);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console, Uint8Array,
    process: { env }, window: { location: { origin: 'https://inventory.example.test' } },
    fetch: async url => {
      calls.push(url);
      if (fetchMode === 'missing') return { ok: false };
      if (fetchMode === 'fallback' && url.startsWith('https://inventory.example.test/')) throw new Error('Network unavailable');
      return { ok: true, arrayBuffer: async () => fetchMode === 'corrupt'
        ? new Uint8Array([0, 1, 2]).buffer
        : logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength) };
    },
    require: name => {
      if (name === 'jspdf') return { __esModule: true, default: capturePdf };
      if (name === 'jspdf-autotable') return require(name);
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      if (name.startsWith('./')) return load(path.join(path.dirname(relativePath), name + '.ts'));
      throw new Error('Unexpected dependency: ' + name);
    },
  }, { filename: relativePath });
  modules.set(absolute, module.exports);
  return module.exports;
}

async function main() {
  const { tryAddLogo } = load('lib/pdf/pdfShared.ts');
  const real = new jsPDF();
  const props = real.getImageProperties(new Uint8Array(logo));
  assert.ok(props.width >= 1000 && props.height >= 300, 'Print logo must have enough source pixels');
  for (const [maxW, maxH] of [[44, 18], [32, 14], [16, 16], [18, 8]]) {
    const images = [];
    const doc = {
      getImageProperties: image => real.getImageProperties(image),
      addImage: (_image, _format, x, y, width, height) => images.push({ x, y, width, height }),
    };
    assert.equal(await tryAddLogo(doc, 15, 12, maxW, maxH), true);
    const image = images[0];
    assert.ok(Math.abs(image.width / image.height - props.width / props.height) < 1e-8, 'Logo must not be stretched');
    assert.ok(image.x >= 15 && image.y >= 12);
    assert.ok(image.x + image.width <= 15 + maxW + 1e-8);
    assert.ok(image.y + image.height <= 12 + maxH + 1e-8);
  }
  assert.ok(calls.every(url => url.endsWith('/logo/logo.png')), 'Do not embed the 32px UI icon');
  fetchMode = 'missing';
  assert.equal(await tryAddLogo(real, 15, 12, 44, 18), false);
  fetchMode = 'corrupt';
  assert.equal(await tryAddLogo(real, 15, 12, 44, 18), false);
  fetchMode = 'fallback';
  env.NEXT_PUBLIC_BASE_URL = 'https://fallback.example.test';
  assert.equal(await tryAddLogo(real, 15, 12, 44, 18), true);
  fetchMode = 'success';
  delete env.NEXT_PUBLIC_BASE_URL;

  const { downloadBeritaAcaraPdf } = load('lib/pdf/beritaAcara.ts');
  const { BERITA_ACARA_TEMPLATES } = load('lib/constants/beritaAcara.ts');
  for (const template of BERITA_ACARA_TEMPLATES) {
    await downloadBeritaAcaraPdf({
      nomor: 'BA/CONTOH/001', jenis: template.jenis,
      lokasiSite: 'Site Pengujian', namaPelanggan: 'Pelanggan Contoh',
      namaTeknisi: 'Teknisi Contoh', adminName: 'Admin Gudang',
      items: [{ id: 'contoh', idSparepart: 'contoh', mode: 'MOVE', selected: true, scanCount: 1,
        namaPerangkat: 'LNB C-Band', serialNumber: 'SN-UJI-001', tagging: 'TAG-UJI-001', status: 'Tersedia' }],
    });
    const { doc } = documents.at(-1);
    assert.equal(doc.getNumberOfPages(), 1, `${template.jenis} sample must fit one page`);
    const images = Object.values(doc.internal.collections.addImage_images);
    assert.ok(images.length > 0, `${template.jenis} must include logo`);
    assert.ok(images.every(image => image.width === props.width && image.height === props.height));
  }
  console.log(`PASS: high resolution logo, aspect ratio, bounds, asset failure/fallback, ${documents.length} actual BA PDFs`);
  if (outputDir) console.log('PDF samples:', outputDir);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
