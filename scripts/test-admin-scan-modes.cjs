// Local UI regression checks: Firebase, downloads, and browser effects are mocked.
// Run: node scripts/test-admin-scan-modes.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const componentPath = 'components/scan/AdminGudangScanView.tsx';
const { outputText } = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '..', componentPath), 'utf8'),
  { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }
);
const admin = { id: 'admin-test', nama: 'Admin Test', role: 'admin_gudang', status: 'aktif' };
const recipient = { id: 'recipient-test', nama: 'Teknisi Test', role: 'teknisi', status: 'aktif', email: 'test@example.invalid' };
const item = (mode, id = mode, selected = true) => ({
  id, idSparepart: id, mode, selected, scanCount: 1,
  namaPerangkat: `Perangkat ${id}`, lokasiSaatIni: 'Gudang', status: 'Tersedia',
});
const textOf = node => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
};
function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  return [node, ...descendants(node.props?.children)];
}

async function fixture({ mode = 'UPDATE', items = [], meta = {} } = {}) {
  const calls = { submissions: [], errors: [], updates: [], suratJalan: [], beritaAcara: [] };
  const state = {
    defaultMode: mode, items,
    docMeta: {
      namaTeknisi: '', jenisTeknisi: 'karyawan', penerimaRole: '', penerimaUserId: '',
      nomorSpt: '', lokasiTujuan: '', lokasiSite: '', keteranganGlobal: '',
      namaPelanggan: '', beritaAcaraJenis: 'maintenance', pekerjaanTambahan: '',
      alamat: '', noTiketComplaint: '', noTiketMaintenance: '', noHpTeknisi: '',
      namaPic: '', noHpPic: '', sumberMasalah: '', tindakan: '', catatanRingkasan: '',
      tipeMaintenance: 'PM', layananTerpilih: [], ...meta,
    },
    setDefaultMode: value => { state.defaultMode = value; },
    setDocMeta: value => { state.docMeta = { ...state.docMeta, ...value }; },
    updateItem: (id, patch) => {
      calls.updates.push({ id, patch });
      state.items = state.items.map(row => row.id === id ? { ...row, ...patch } : row);
    },
    clearAll: () => { state.items = []; },
    selectAll: selected => { state.items = state.items.map(row => ({ ...row, selected })); },
  };
  let cursor = 0;
  let mounted = false;
  let tree;
  const hookState = [];
  const pendingEffects = [];
  const hooks = {
    ...React,
    useState: initial => {
      const index = cursor++;
      if (!(index in hookState)) hookState[index] = typeof initial === 'function' ? initial() : initial;
      return [hookState[index], value => {
        hookState[index] = typeof value === 'function' ? value(hookState[index]) : value;
      }];
    },
    useEffect: effect => { if (!mounted) pendingEffects.push(effect); },
    useCallback: callback => callback,
  };
  const toast = Object.assign(() => {}, {
    error: message => calls.errors.push(message), success: () => {},
  });
  const emptyComponent = () => null;
  const mocks = {
    react: hooks,
    'lucide-react': new Proxy({}, { get: () => emptyComponent }),
    'react-hot-toast': toast,
    '@/components/QRScanner': emptyComponent,
    '@/components/scan/UnrecognizedQRModal': emptyComponent,
    '@/components/ImageUpload': emptyComponent,
    '@/lib/firebase/sparepartItems': {},
    '@/lib/firebase/lokasi': { getLokasiList: async () => [] },
    '@/lib/firebase/users': { getUsers: async () => [admin, recipient] },
    '@/lib/firebase/adminScanSubmit': { submitAdminScanBatch: async params => {
      calls.submissions.push(params);
      return { updated: 0, transacted: params.items.length };
    } },
    '@/lib/store/useAdminScanStore': { useAdminScanStore: () => state },
    '@/lib/store/useAuthStore': { useAuthStore: () => ({ user: admin }) },
    '@/lib/constants/sparepartItem': { ITEM_STATUS_VALUES: ['Tersedia', 'Maintenance', 'Rusak'] },
    '@/lib/constants/beritaAcara': {
      BERITA_ACARA_TEMPLATES: [{ jenis: 'maintenance', label: 'Maintenance' }],
      LAYANAN_BA_CHECKLIST: ['Layanan test'],
    },
    '@/lib/pdf/suratJalan': {
      createSuratJalanNumber: () => 'SJ-TEST',
      downloadSuratJalanPdf: async params => calls.suratJalan.push(params),
    },
    '@/lib/pdf/beritaAcara': {
      createBeritaAcaraNumber: () => 'BA-TEST',
      downloadBeritaAcaraPdf: async params => calls.beritaAcara.push(params),
    },
    '@/types': {
      USER_ROLES: ['admin', 'admin_gudang', 'teknisi', 'supervisor'],
      USER_ROLE_LABELS: { admin_gudang: 'Admin Gudang', teknisi: 'Teknisi' },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports, module, console,
    require: name => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  }, { filename: componentPath });
  const render = () => {
    cursor = 0;
    tree = module.exports.default();
    mounted = true;
    return renderToStaticMarkup(tree);
  };
  render();
  pendingEffects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  render();
  const find = (tag, match) => {
    const found = descendants(tree).find(node => node.type === tag && match.test(textOf(node)));
    assert.ok(found, `Missing ${tag}: ${match}`);
    return found;
  };
  const control = labelMatch => {
    const parent = descendants(tree).find(node => {
      const children = React.Children.toArray(node.props?.children);
      return children.some(child => child.type === 'label' && labelMatch.test(textOf(child)));
    });
    assert.ok(parent, `Missing field label: ${labelMatch}`);
    const label = descendants(parent).find(node => node.type === 'label' && labelMatch.test(textOf(node)));
    return descendants(label).find(node => ['input', 'select', 'textarea'].includes(node.type))
      || descendants(parent).find(node => ['input', 'select', 'textarea'].includes(node.type));
  };
  return {
    calls, state, render,
    visible: match => descendants(tree).some(node => node.type === 'label' && match.test(textOf(node))),
    change: (label, value) => {
      const target = control(label);
      assert.ok(target, `Missing field control: ${label}`);
      target.props.onChange({ target: { value, checked: value } });
      render();
    },
    click: async match => { await find('button', match).props.onClick(); render(); },
    submit: async () => { await find('button', /Proses & Simpan/).props.onClick(); render(); },
  };
}

async function main() {
  const view = await fixture();
  assert.equal(view.visible(/Status stok/), true);
  assert.equal(view.visible(/Dibawa oleh|Nomor SPT|Lokasi barang rusak|Lokasi site \(Berita Acara\)/), false);
  await view.click(/^Serah \/ Bawa$/);
  assert.equal(view.visible(/Status stok/), false);
  assert.equal(view.visible(/Dibawa oleh/), true);
  assert.equal(view.visible(/Nomor SPT/), true);
  assert.equal(view.visible(/Lokasi tujuan \/ site/), true);
  assert.equal(view.visible(/Unduh Surat Jalan/), true);
  await view.click(/^Lapor Rusak$/);
  assert.equal(view.visible(/Status stok|Dibawa oleh|Nomor SPT|Unduh Surat Jalan/), false);
  assert.equal(view.visible(/Lokasi barang rusak/), true);
  assert.equal(view.visible(/Keterangan kerusakan/), true);

  for (const mode of ['UPDATE', 'MOVE', 'DAMAGE']) {
    const ba = await fixture({ mode });
    assert.equal(ba.visible(/Lokasi site \(Berita Acara\)|Jenis Berita Acara|Pelanggan \/ pihak/), false);
    ba.change(/Unduh Berita Acara/, true);
    assert.equal(ba.visible(/Lokasi site \(Berita Acara\)/), true);
    assert.equal(ba.visible(/Jenis Berita Acara/), true);
    await ba.click(/Form BA resmi/);
    assert.match(ba.render(), /No\. Tiket Complaint/);
    ba.change(/Unduh Berita Acara/, false);
    assert.equal(ba.visible(/Lokasi site \(Berita Acara\)|Jenis Berita Acara/), false);
    assert.doesNotMatch(ba.render(), /No\. Tiket Complaint/);
  }

  const mixed = await fixture({ mode: 'DAMAGE', items: [item('UPDATE'), item('MOVE'), item('DAMAGE'), item('UPDATE', 'unselected', false)] });
  assert.equal(mixed.visible(/Status stok/), true);
  assert.equal(mixed.visible(/Dibawa oleh/), true);
  assert.equal(mixed.visible(/Nomor SPT/), true);
  assert.equal(mixed.visible(/Lokasi tujuan \/ lokasi barang rusak/), true);
  mixed.change(/Status stok/, 'Maintenance');
  await mixed.click(/^Terapkan ke 1 item$/);
  assert.equal(mixed.calls.updates.length, 1);
  assert.equal(mixed.calls.updates[0].id, 'UPDATE');
  assert.equal(mixed.calls.updates[0].patch.newStatus, 'Maintenance');

  for (const mode of ['UPDATE', 'DAMAGE']) {
    const plain = await fixture({ mode, items: [item(mode)], meta: { lokasiTujuan: 'Gudang' } });
    await plain.submit();
    assert.equal(plain.calls.errors.length, 0, `${mode} must not require an unused recipient`);
    assert.equal(plain.calls.submissions.length, 1);
    assert.equal(plain.calls.suratJalan.length, 0);
    const stale = await fixture({ mode, items: [item(mode)], meta: {
      lokasiTujuan: 'Gudang', penerimaRole: recipient.role, penerimaUserId: recipient.id,
      namaTeknisi: recipient.nama, nomorSpt: 'OLD-SPT',
    } });
    await stale.submit();
    const params = stale.calls.submissions[0];
    assert.ok(params);
    assert.equal(params.namaTeknisi, admin.nama);
    assert.equal(params.penerimaRole, undefined);
    assert.equal(params.penerimaUserId, undefined);
    assert.equal(params.nomorSpt, '');
  }

  const move = await fixture({ mode: 'MOVE', items: [item('MOVE')] });
  await move.submit();
  assert.match(move.calls.errors.at(-1), /role/i);
  move.change(/Dibawa oleh/, recipient.role);
  await move.submit();
  assert.match(move.calls.errors.at(-1), /nama user/i);
  move.change(/Nama penerima/, recipient.id);
  await move.submit();
  assert.match(move.calls.errors.at(-1), /SPT/);
  move.change(/Nomor SPT/, 'SPT-TEST');
  await move.submit();
  assert.match(move.calls.errors.at(-1), /Lokasi/);
  assert.equal(move.calls.submissions.length, 0, 'Invalid MOVE must fail before submission');
  move.change(/Lokasi tujuan \/ site/, 'Site Test');
  await move.submit();
  assert.equal(move.calls.submissions.length, 1);
  assert.equal(move.calls.submissions[0].penerimaUserId, recipient.id);
  assert.equal(move.calls.submissions[0].nomorSpt, 'SPT-TEST');
  assert.equal(move.calls.suratJalan.length, 1);

  const ba = await fixture({ items: [item('UPDATE')] });
  ba.change(/Unduh Berita Acara/, true);
  await ba.submit();
  assert.match(ba.calls.errors.at(-1), /role/i);
  ba.change(/Role penanggung jawab Berita Acara/, recipient.role);
  ba.change(/Nama penanggung jawab Berita Acara/, recipient.id);
  await ba.submit();
  assert.match(ba.calls.errors.at(-1), /Lokasi site/);
  assert.equal(ba.calls.submissions.length, 0);
  ba.change(/Lokasi site \(Berita Acara\)/, 'Site BA');
  await ba.submit();
  assert.equal(ba.calls.submissions.length, 1);
  assert.equal(ba.calls.beritaAcara.length, 1);
  console.log('PASS: mode forms, mixed modes, optional BA, recipient/SPT/location validation, stale metadata, UPDATE-only bulk changes');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
