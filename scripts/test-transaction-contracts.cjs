// Local regression checks: no Firebase connection or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const writes = [];
let reads = 0;
let itemUpdates = 0;
const firestore = {
  collection: (_db, name) => ({ id: name }),
  doc: (...args) => ({ id: args.length === 1 ? 'new-transaction' : args.at(-1) }),
  Timestamp: { now: () => new Date() },
  runTransaction: async (_db, callback) => {
    let wrote = false;
    return callback({
      get: async () => {
        assert.equal(wrote, false, 'Firestore reads must precede writes');
        reads++;
        return { exists: () => true, data: () => ({ stokGudang: 5, stokTotal: 8 }) };
      },
      set: (ref, value) => { wrote = true; writes.push({ kind: 'set', ref, value }); },
      update: (ref, value) => { wrote = true; writes.push({ kind: 'update', ref, value }); },
    });
  },
};
const itemHelpers = {
  getSparepartItemById: async id => id === 'physical'
    ? { namaPerangkat: 'Modem', lokasiSaatIni: 'Gudang', serialNumber: 'SN-1' } : null,
  updateSparepartItem: async () => { itemUpdates++; },
};
const mocks = {
  'firebase/firestore': firestore,
  './config': { db: {} },
  './collections': { COLLECTIONS: { TRANSAKSI: 'transaksi', SPAREPARTS: 'spareparts' } },
  './spareparts': { getSparepartById: async () => ({ namaSpare: 'Antena', lokasiDefault: 'Gudang' }) },
  './sparepartItems': itemHelpers,
  './notifications': { SYSTEM_NOTIFICATION_ROLES: [], createNotification: async () => {} },
  './utils/mappers': {},
  '@/lib/constants/sparepartItem': { normalizeItemStatus: value => value },
  '@/types': { USER_ROLE_LABELS: { admin_gudang: 'Admin Gudang', teknisi: 'Teknisi' } },
};
function load(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports, module, console, Date,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    },
  }, { filename: relativePath });
  return module.exports;
}

async function main() {
  const transactions = load('lib/firebase/transactions.ts');
  mocks['./transactions'] = transactions;
  const admin = load('lib/firebase/adminScanSubmit.ts');
  const display = load('lib/utils/transactionDisplay.ts');
  assert.equal(display.getCarriedBy({ requestedByName: 'Admin', requestedByRole: 'admin_gudang' }), 'Admin Gudang - Admin');
  assert.equal(display.getCarriedBy({ namaTeknisi: 'Teknisi A', requestedByRole: 'admin_gudang' }), 'Teknisi - Teknisi A');
  assert.equal(display.getApprovedBy({ adminGudang: 'Admin Lama' }), 'Admin Gudang - Admin Lama');
  const items = ['physical', 'catalog'].map(id => ({ id, idSparepart: id, jenisAksi: 'MOVE' }));

  await assert.rejects(transactions.submitCartTransaction(items, 'Teknisi', 'Site A'), /Identitas/);
  await assert.rejects(admin.submitAdminScanBatch({ items: [{ mode: 'MOVE' }], adminName: 'Admin' }), /login/);
  assert.equal(reads, 0, 'Missing identity must fail before database access');
  assert.equal(itemUpdates, 0);
  assert.equal(writes.length, 0);

  await transactions.submitCartTransaction(items, 'Teknisi', 'Site A', undefined, undefined, {
    requestedByUid: 'admin-uid', requestedByName: 'Admin', requestedByRole: 'admin_gudang',
    approvedByUid: 'admin-uid', nomorSpt: 'SPT-001',
  });
  const created = writes.filter(write => write.kind === 'set');
  assert.equal(created.length, 2, 'Both physical and catalogue items produce a transaction');
  for (const { value } of created) {
    assert.equal(value.requestedByUid, 'admin-uid');
    assert.equal(value.requestedByName, 'Admin');
    assert.equal(value.requestedByRole, 'admin_gudang');
    assert.equal(value.statusTransaksi, 'completed');
    assert.equal(value.nomorSpt, 'SPT-001');
    assert.ok(value.requestedAt instanceof Date);
    assert.equal(value.lokasiTujuan, 'Site A');
  }
  for (const { value } of writes.filter(write => write.kind === 'update')) {
    assert.equal(value.stokGudang, 4);
    assert.equal(value.stokTotal, undefined, 'MOVE must not reduce total owned stock');
  }
  console.log('PASS: identity guards, transaction metadata, physical/catalogue paths, Firestore read ordering, MOVE stock');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
