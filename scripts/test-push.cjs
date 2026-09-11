// Exercise the real API handlers with isolated Firestore/FCM substitutes; no live messages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let authorized = true;
let persisted = [];
let sent = [];
let removed = [];
let owner = 'other-user';
let failPush = false;
const users = [{ id: 'warehouse', data: () => ({ role: 'admin_gudang' }) }, { id: 'tech', data: () => ({ role: 'teknisi' }) }];
const db = {
  collection(name) {
    return {
      add: async data => { persisted.push(data); return { id: 'notification-1' }; },
      doc: id => ({ id, set: async data => { owner = data.uid; }, delete: async () => removed.push(id) }),
      where: (_field, _op, value) => ({ get: async () => ({ docs: name === 'users' ? users : [{ data: () => ({ token: `token-${value}` }), ref: { delete: async () => removed.push(value) } }] }) }),
    };
  },
  runTransaction: async callback => callback({ get: async () => ({ data: () => ({ uid: owner }) }), delete: ref => removed.push(ref.id) }),
};
const mocks = {
  'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } },
  '@/lib/server/pushAuth': { pushUser: async () => { if (!authorized) throw Error('unauthorized'); return { uid: 'tech', nama: 'Teknisi', role: 'teknisi' }; } },
  '@/lib/server/firebaseAdmin': { adminDb: () => db },
  '@/lib/server/rateLimiter': { rateLimit: () => ({ allowed: true }) },
  'firebase-admin/messaging': { getMessaging: () => ({ sendEachForMulticast: async message => {
    if (failPush) throw Error('FCM unavailable');
    sent.push(message); return { responses: message.tokens.map(() => ({ success: true })) };
  } }) },
  '@/lib/server/webPush': { validPushSubscription: () => false, sendWebPush: async () => {} },
  'node:crypto': require('node:crypto'),
  'web-push': require('web-push'),
  './firebaseAdmin': { adminDb: () => db },
};
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: id => { if (!(id in mocks)) throw Error(id); return mocks[id]; }, console: { error() {} }, Date, Response, process, URL });
  return module.exports;
}
const request = data => ({ json: async () => data });
(async () => {
  const notifications = load('app/api/notifications/route.ts');
  const tokens = load('app/api/push/token/route.ts');
  authorized = false;
  assert.equal((await notifications.POST(request({}))).status, 401);
  assert.equal((await tokens.POST(request({ token: 'x'.repeat(30) }))).status, 401);
  assert.equal(persisted.length, 0);
  authorized = true;
  assert.equal((await notifications.POST(request(null))).status, 400);
  assert.equal((await tokens.POST(request(null))).status, 400);
  assert.equal((await notifications.POST(request({ title: 5 }))).status, 400);
  const payload = { title: 'Pengajuan', message: 'Barang baru', actorName: 'Spoofed', targetRoles: ['admin_gudang'], targetUids: [], link: '//evil.example' };
  const response = await notifications.POST(request(payload));
  assert.equal(response.status, 200);
  assert.equal(persisted[0].actorName, 'Teknisi');
  assert.equal(persisted[0].link, '/');
  assert.equal(sent[0].tokens.join(','), 'token-warehouse');
  assert.equal(sent[0].android.notification.channelId, 'inventory_updates');
  assert.equal(sent[0].data.notificationId, 'notification-1');
  failPush = true;
  assert.equal((await notifications.POST(request(payload))).data.pushDelivered, false);
  assert.equal(persisted.length, 2, 'Push failure does not lose inbox notification');
  await tokens.DELETE(request({ token: 'x'.repeat(30) }));
  assert.equal(removed.length, 0, 'Another account cannot unregister a device');
  await tokens.POST(request({ token: 'x'.repeat(30) }));
  assert.equal(owner, 'tech');
  await tokens.DELETE(request({ token: 'x'.repeat(30) }));
  assert.equal(removed.length, 1);
  const web = load('lib/server/webPush.ts');
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } };
  assert.equal(web.validPushSubscription(subscription), true);
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://127.0.0.1/test', 'https://fcm.googleapis.com.evil.example/test', 'https://user:pass@fcm.googleapis.com/test']) {
    assert.equal(web.validPushSubscription({ ...subscription, endpoint }), false, 'Reject unsafe push destination');
  }
  const worker = load('app/firebase-messaging-sw.js/route.ts');
  const handlers = {};
  const shown = [];
  const opened = [];
  vm.runInNewContext(await worker.GET().text(), {
    self: { location: { origin: 'https://inventory.example' }, addEventListener: (name, callback) => handlers[name] = callback,
      registration: { showNotification: async (...args) => shown.push(args) } },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) }, URL,
  });
  let pending;
  handlers.push({ data: { json: () => ({ title: 'Update', body: 'Approved', link: '/teknisi/riwayat', notificationId: 'n1' }) }, waitUntil: promise => pending = promise });
  await pending;
  assert.equal(shown[0][1].tag, 'n1');
  handlers.notificationclick({ notification: { close() {}, data: { link: '/teknisi/riwayat' } }, waitUntil: promise => pending = promise });
  await pending;
  assert.equal(opened[0], 'https://inventory.example/teknisi/riwayat');
  handlers.notificationclick({ notification: { close() {}, data: { link: 'https://evil.example' } }, waitUntil() { throw Error('External navigation'); } });
  console.log('PASS: push authorization, recipient filtering, trusted actor, safe link, persistence on failure, token ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
