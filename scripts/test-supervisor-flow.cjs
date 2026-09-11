// Local regression tests with mocked Firebase and downloads; no production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports,console,React){${code}\n})`, { filename: file })(
    name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected dependency: ${name} in ${file}`);
    }, module, module.exports, { ...console, error() {} }, React
  );
  return module.exports;
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const textOf = node => node == null || typeof node === 'boolean' ? '' :
  typeof node !== 'object' ? String(node) :
  Array.isArray(node) ? node.map(textOf).join('') : textOf(node.props?.children);
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(file, mocks) {
  let cursor = 0, effects = [], state = [], tree;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(value) { const [ref] = hooks.useState({ current: value }); return ref; },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect: fn => effects.push(fn),
  };
  const Component = load(file, { ...mocks, react: hooks }).default;
  return {
    render(props) { cursor = 0; effects = []; tree = Component(props); return tree; },
    runEffects() { effects.forEach(fn => fn()); },
    get nodes() { return nodes(tree); },
    get text() { return textOf(tree); },
  };
}
const Empty = () => null;
const common = {
  'lucide-react': new Proxy({}, { get: () => Empty }),
  'next/link': Empty,
  '@/components/ErrorState': Empty,
};

async function main() {
  const rbac = load('lib/rbac.ts');
  for (const url of ['/dashboard', '/transaksi', '/transaksi/abc', '/laporan', '/aktivitas', '/profile', '/notifikasi', '/item/abc']) {
    assert.equal(rbac.canAccessPath('supervisor', url), true, url);
  }
  for (const url of ['/spareparts/verifikasi', '/spareparts/tambah', '/spareparts/abc/edit', '/transaksi/keranjang', '/scan', '/users']) {
    assert.equal(rbac.canAccessPath('supervisor', url), false, url);
  }
  assert.equal(rbac.canAccessPath('teknisi', '/transaksi/keranjang'), true);
  assert.equal(rbac.getAccessiblePath('supervisor', '/spareparts/verifikasi'), '/transaksi?status=pending');
  assert.equal(rbac.getAccessiblePath('admin_gudang', '/spareparts/verifikasi'), '/spareparts/verifikasi');
  for (const url of ['https://example.test', '//example.test', '/\\example.test', '/users', 'javascript:alert(1)']) {
    assert.equal(rbac.getAccessiblePath('supervisor', url), undefined);
  }
  const dates = load('lib/utils/reportDates.ts');
  const range = dates.getReportDateRange('2026-09-01', '2026-09-10');
  assert.equal(range.startDate.getHours(), 0);
  assert.equal(range.endDate.getHours(), 23);
  assert.equal(range.endDate.getMilliseconds(), 999);
  for (const [start, end] of [['', '2026-09-10'], ['2026-02-30', '2026-09-10'], ['2026-09-11', '2026-09-10']]) {
    assert.throws(() => dates.getReportDateRange(start, end));
  }

  const allRows = Array.from({ length: 405 }, (_, i) => ({
    id: String(i), idSparepart: String(i), namaItem: `Item ${i}`, jenisTransaksi: i % 2 ? 'MOVE' : 'OUT',
    requestedByUid: i % 2 ? 'other' : 'technician', createdAt: new Date(2026, 8, 10, 0, 0, i),
  }));
  let queryCalls = [];
  const firestore = {
    collection: (_db, name) => ({ collection: name, constraints: [] }),
    query: (base, ...constraints) => ({ ...base, constraints: [...base.constraints, ...constraints] }),
    where: (field, op, value) => ({ type: 'where', field, op, value }),
    orderBy: field => ({ type: 'order', field }),
    limit: count => ({ type: 'limit', count }),
    startAfter: doc => ({ type: 'cursor', id: doc.id }),
    Timestamp: { fromDate: date => date },
    getDocs: async q => {
      queryCalls.push(q);
      let rows = allRows.filter(row => q.constraints.filter(c => c.type === 'where').every(c =>
        c.op === '==' ? row[c.field] === c.value : c.op === '>=' ? row[c.field] >= c.value : row[c.field] <= c.value));
      if (q.constraints.some(c => c.type === 'order')) rows = rows.slice().sort((a, b) => b.createdAt - a.createdAt);
      const cursor = q.constraints.find(c => c.type === 'cursor');
      if (cursor) rows = rows.slice(rows.findIndex(row => row.id === cursor.id) + 1);
      rows = rows.slice(0, q.constraints.find(c => c.type === 'limit').count);
      return { docs: rows };
    },
  };
  const tx = load('lib/firebase/transactions.ts', {
    'firebase/firestore': firestore, './config': { db: {} }, './collections': { COLLECTIONS: { TRANSAKSI: 'transaksi' } },
    './spareparts': {}, './sparepartItems': {}, './notifications': {},
    './utils/mappers': { mapFirestoreDocs: docs => docs },
  });
  assert.equal((await tx.getTransactions()).length, 100);
  queryCalls = [];
  const complete = await tx.getTransactions(range, null);
  assert.equal(complete.length, 405);
  assert.equal(new Set(complete.map(row => row.id)).size, 405);
  assert.equal(queryCalls.length, 3);
  assert.equal((await tx.getTransactions({ ...range, jenisTransaksi: 'OUT' }, null)).length, 203);
  queryCalls = [];
  const owned = await tx.getTransactions({ requestedByUid: 'technician' }, null);
  assert.equal(owned.length, 203);
  assert(owned.every(row => row.requestedByUid === 'technician'));
  assert(queryCalls.every(q => q.constraints.some(c => c.field === 'requestedByUid')));

  let countQueries = [], failCounts = false;
  const dashboard = fixture('components/dashboard/SupervisorDashboardView.tsx', {
    ...common, '@/lib/firebase/config': { db: {} }, '@/lib/firebase/collections': { COLLECTIONS: { TRANSAKSI: 'transaksi' } },
    'firebase/firestore': { ...firestore, getCountFromServer: async q => {
      countQueries.push(q); if (failCounts) throw new Error('offline');
      return { data: () => ({ count: q.constraints.some(c => c.field === 'statusTransaksi') ? 7 : 12 }) };
    } },
  });
  dashboard.render(); dashboard.runEffects(); await tick(); dashboard.render();
  assert(countQueries.every(q => q.collection === 'transaksi'));
  assert(dashboard.text.includes('7') && dashboard.text.includes('12'));
  assert(dashboard.nodes.filter(n => n.props?.href).every(n => n.props.href === '/transaksi?status=pending'));
  failCounts = true; dashboard.runEffects(); await tick(); dashboard.render();
  assert(dashboard.nodes.some(n => n.props?.message?.includes('Gagal memuat statistik') && n.props.onRetry));

  let reportCalls = [], exported, response = Promise.resolve(allRows), errors = [];
  const report = fixture('components/laporan/LaporanUmumView.tsx', {
    ...common, '@/lib/utils/reportDates': dates,
    '@/lib/firebase/transactions': { getTransactions: (...args) => { reportCalls.push(args); return response; } },
    '@/lib/utils': { formatDate: date => date.toISOString() },
    'react-hot-toast': { error: message => errors.push(message), promise: promise => promise },
    '@/lib/pdf/laporanTransaksi': { downloadLaporanTransaksiPdf: async value => { exported = value; } },
    '@/lib/firebase/spareparts': {}, '@/lib/firebase/sparepartItems': {},
    '@/lib/utils/transactionDisplay': { getTransactionSparepartLines: t => ({ name: t.namaItem }), getCarriedBy: () => '', getApprovedBy: () => '', getTransactionLocation: () => '' },
  });
  report.render(); report.runEffects(); await tick(); report.render();
  assert.equal(reportCalls[0][1], null);
  assert(report.nodes.some(n => n.type === 'option' && n.props.value === 'OUT'));
  let exportButton = report.nodes.find(n => n.type === 'button' && textOf(n).includes('Unduh PDF'));
  assert.equal(exportButton.props.disabled, false);
  await exportButton.props.onClick(); assert.equal(exported.transactions.length, 405);
  const selectType = () => report.nodes.find(n => n.type === 'select' && nodes(n).some(o => o.type === 'option' && o.props.value === 'OUT'));
  selectType().props.onChange({ target: { value: 'OUT' } }); report.render();
  assert.equal(report.nodes.find(n => n.type === 'button').props.disabled, true, 'Changed filters must disable old export');
  report.runEffects(); await tick(); report.render();
  await report.nodes.find(n => n.type === 'button').props.onClick();
  assert.equal(exported.transactions.length, 203);
  let finishOld;
  response = new Promise(resolve => { finishOld = resolve; });
  selectType().props.onChange({ target: { value: 'MOVE' } }); report.render(); report.runEffects();
  response = Promise.resolve(allRows);
  selectType().props.onChange({ target: { value: 'OUT' } }); report.render(); report.runEffects();
  await tick(); finishOld(allRows); await tick(); report.render();
  await report.nodes.find(n => n.type === 'button').props.onClick();
  assert(exported.transactions.every(t => t.jenisTransaksi === 'OUT'), 'Old request must not replace new filter');
  response = Promise.reject(new Error('offline')); report.runEffects(); await tick(); report.render();
  assert.equal(report.nodes.find(n => n.type === 'button').props.disabled, true);
  assert(report.nodes.some(n => n.props?.message === 'offline'));

  let notificationFailure = false;
  const notifications = load('lib/firebase/notifications.ts', {
    'firebase/firestore': { ...firestore, getDocs: async () => {
      if (notificationFailure) throw new Error('offline');
      return { docs: [{ id: 'notice', data: () => ({ link: '/spareparts/verifikasi' }) }] };
    } }, './config': { db: {} }, './collections': { COLLECTIONS: { NOTIFICATIONS: 'notifications' } },
    '@/types': {}, '@/lib/rbac': rbac,
  });
  const notices = await notifications.getActivitiesForUser({ id: 's', role: 'supervisor' });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].link, '/transaksi?status=pending');
  notificationFailure = true;
  await assert.rejects(notifications.getActivitiesForUser({ id: 's', role: 'supervisor' }), /offline/);

  const list = fixture('app/transaksi/page.tsx', {
    'next/navigation': { useSearchParams: () => new URLSearchParams('status=pending') },
    ...common, '@/lib/firebase/transactions': { getTransactions: async () => [
      { ...allRows[0], statusTransaksi: 'pending' },
      { ...allRows[1], statusTransaksi: 'completed' },
    ] },
    '@/types': { getJenisTransaksiLabel: value => value },
    '@/lib/store/useAuthStore': { useAuthStore: () => ({ user: { id: 's', role: 'supervisor' } }) },
    '@/lib/utils': { formatDate: date => date.toISOString() }, 'react-hot-toast': { error() {} },
  });
  list.render({ searchParams: { status: 'pending' } }); list.runEffects(); await tick();
  list.render({ searchParams: { status: 'pending' } });
  assert.equal(list.nodes.find(n => n.props?.['aria-label'] === 'Filter status transaksi').props.value, 'pending');
  assert(list.nodes.some(n => n.props?.href === `/transaksi/${allRows[0].id}`));
  assert(!list.nodes.some(n => n.props?.href === `/transaksi/${allRows[1].id}`));
  console.log('PASS supervisor routes, dashboard counts/errors, report dates/pagination/OUT/export/races, and notification routing/errors');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
