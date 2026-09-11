// Regression checks for shareable QR URLs and downloads. No Firebase connection.
// Run: node scripts/test-qr-urls.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const QRCode = require('qrcode');

function load(file, mocks = {}, globals = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports, module, console, URL, Date, React,
    require: name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (['clsx', 'tailwind-merge'].includes(name)) return require(name);
      throw new Error(`Unexpected dependency in ${file}: ${name}`);
    },
    ...globals,
  }, { filename: file });
  return module.exports;
}

function utils(env, origin) {
  return load('lib/utils.ts', {}, {
    process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_BASE_URL: env } },
    ...(origin ? { window: { location: { origin } } } : {}),
  });
}

const canonicalOrigin = 'https://tsatspare.netlify.app';
const canonical = utils('http://localhost:3000', canonicalOrigin);
const record = {
  id: 'physical-123', namaPerangkat: 'Modem', namaSpare: 'Modem',
  kodeSpare: 'MDM-123', serialNumber: 'SN-123', status: 'Tersedia',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  qrCodeUrl: 'http://localhost:3000/scan/physical-123',
};
const expectedUrl = `${canonicalOrigin}/scan/${record.id}`;
const empty = () => null;
function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  return [node, ...descendants(node.props?.children)];
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}

async function detailFixture(file, data, queryImage) {
  let cursor = 0;
  let mounted = false;
  const states = [];
  const effects = [];
  const calls = { encoded: [], downloaded: [], errors: [] };
  const hooks = {
    ...React,
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect: effect => { if (!mounted) effects.push(effect); },
    useCallback: callback => callback,
  };
  const document = {
    body: { appendChild() {}, removeChild() {} },
    createElement: () => ({ click() { calls.downloaded.push({ href: this.href, download: this.download }); } }),
  };
  const mocks = {
    react: hooks,
    'next/navigation': {
      useParams: () => ({ id: data.id }),
      useSearchParams: () => ({ get: () => queryImage }),
      useRouter: () => ({ push() {} }),
    },
    'next/link': empty,
    'lucide-react': new Proxy({}, { get: () => empty }),
    'react-hot-toast': { success() {}, error: value => calls.errors.push(value) },
    'qrcode.react': { QRCodeSVG: empty },
    qrcode: { toDataURL: async (value, options) => {
      calls.encoded.push(value);
      return QRCode.toDataURL(value, options);
    } },
    '@/lib/utils': canonical,
    '@/components/AdminLayout': empty,
    '@/components/ImageUpload': empty,
    '@/lib/store/useAuthStore': { useAuthStore: () => ({ user: { role: 'admin_gudang' } }) },
    '@/lib/firebase/sparepartItems': {
      getSparepartItemById: async () => data, getSparepartItems: async () => [],
    },
    '@/lib/firebase/spareparts': { getSparepartById: async () => data },
    '@/lib/firebase/config': { db: {} },
    '@/lib/firebase/collections': { COLLECTIONS: {} },
    'firebase/firestore': { collection() {}, query() {}, where() {}, getDocs: async () => ({ docs: [] }) },
    '@/lib/utils/transactionDisplay': {},
  };
  const component = load(file, mocks, { document }).default;
  let tree;
  const render = () => { cursor = 0; tree = component(); mounted = true; };
  render();
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  render();
  return {
    calls,
    nodes: () => descendants(tree),
    click: async label => {
      const button = descendants(tree).find(node => node.type === 'button' && label.test(textOf(node)));
      assert.ok(button, `Missing button ${label} in ${file}`);
      await button.props.onClick();
      render();
    },
  };
}

async function main() {
  assert.equal(utils(' https://inventory.example.com/path/?ignored=1#hash ', 'https://preview.netlify.app').getPublicBaseUrl(), 'https://inventory.example.com');
  assert.equal(utils(undefined, 'https://preview.netlify.app').getPublicBaseUrl(), 'https://preview.netlify.app');
  assert.equal(utils('https://inventory.example.com', 'http://localhost:3000').getPublicBaseUrl(), 'https://inventory.example.com');
  for (const bad of [undefined, '', 'invalid', 'http://localhost:3000', 'https://localhost:3000',
    'https://localhost.', 'https://x.localhost', 'https://127.0.0.1', 'https://127.99.4.2',
    'https://2130706433', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://0.0.0.0',
    'https://192.168.1.2', 'http://inventory.example.com', 'https://user:password@example.com']) {
    assert.equal(utils(bad, 'http://localhost:3000').getPublicBaseUrl(), canonicalOrigin, `Bad env must not leak into QR: ${bad}`);
    assert.equal(utils(bad).getPublicBaseUrl(), canonicalOrigin, `SSR requires a shareable fallback: ${bad}`);
    assert.equal(utils(bad, canonicalOrigin).generateQRCodeUrl(record.id), expectedUrl);
  }
  assert.equal(canonical.generateQRCodeUrl('SN /A?#'), `${canonicalOrigin}/scan/SN%20%2FA%3F%23`);

  for (const file of ['app/item/[id]/page.tsx', 'app/spareparts/[id]/page.tsx']) {
    for (const savedUrl of [record.qrCodeUrl, '', 'https://previous.example.com/scan/other']) {
      const fixture = await detailFixture(file, { ...record, qrCodeUrl: savedUrl }, 'data:image/png;base64,OLD_LOCALHOST_QR');
      const previews = fixture.nodes().filter(node => node.props?.value === expectedUrl);
      assert.ok(previews.length, 'Preview must reconstruct the public URL from the record ID');
      assert.equal(fixture.nodes().some(node => node.props?.src === 'data:image/png;base64,OLD_LOCALHOST_QR'), false);
      await fixture.click(/Download PNG/);
      assert.deepEqual(fixture.calls.encoded, [expectedUrl], 'First click must encode the current URL');
      assert.equal(fixture.calls.downloaded.length, 1, 'First click must download immediately after encoding');
      assert.equal(fixture.calls.errors.length, 0);
      assert.match(fixture.calls.downloaded[0].download, /\.png$/);
      const png = Buffer.from(fixture.calls.downloaded[0].href.split(',')[1], 'base64');
      assert.equal(png.subarray(1, 4).toString(), 'PNG', 'Download must be a PNG, not the scan web page');
    }
  }

  const modal = load('components/SparepartGroupDetailModal.tsx', {
    react: { ...React, useState: () => [true, () => {}], useEffect() {} },
    'react-dom': { createPortal: node => node },
    'next/link': empty,
    'lucide-react': new Proxy({}, { get: () => empty }),
    '@/lib/utils': canonical,
    '@/lib/utils/sparepartGroups': { getStatusBadgeClass: () => '' },
  }, { document: { body: {} } }).default;
  for (const savedUrl of [record.qrCodeUrl, '']) {
    const tree = modal({ group: { items: [{ ...record, qrCodeUrl: savedUrl }] } });
    const link = descendants(tree).find(node => node.type === 'a' && node.props.title === 'Buka URL QR');
    assert.equal(link.props.href, expectedUrl, 'Group detail must offer a public URL even for historical or empty stored URLs');
  }

  const created = [];
  const encoded = [];
  const firestore = {
    collection: () => ({}),
    addDoc: async (_ref, data) => { created.push(data); return { id: record.id }; },
    updateDoc: async (_ref, data) => { created.push(data); },
    Timestamp: { now: () => new Date() },
  };
  const itemApi = load('lib/firebase/sparepartItems.ts', {
    'firebase/firestore': firestore,
    './config': { db: {} },
    './collections': { COLLECTIONS: {} },
    './utils/mappers': {},
    './notifications': { createNotification: async () => {} },
    '@/types': { USER_ROLE_LABELS: {} },
    '@/lib/utils': canonical,
    qrcode: { toDataURL: async value => { encoded.push(value); return 'data:image/png;base64,test'; } },
  });
  await itemApi.createSparepartItem({ namaPerangkat: 'Modem' });
  assert.deepEqual(encoded, [expectedUrl]);
  assert.equal(created.at(-1).qrCodeUrl, expectedUrl, 'New item QR must store the same public destination');
  console.log('PASS: public HTTPS origin selection, loopback env rejection, old/missing QR repair, consistent previews/first-click PNG downloads, group links, new item creation');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
