// Run with: node android/test-download-hook.cjs
// Exercise the injected browser code with detached anchors used by file-saver/XLSX.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,
  'app/src/main/java/id/co/telkomsat/inventory/MainActivity.java'), 'utf8');
const method = source.split('private void installDownloadHook() {')[1].split('private void printPage()')[0];
const script = [...method.matchAll(/"(?:[^"\\]|\\.)*"/g)].map(m => JSON.parse(m[0])).join('');

async function check() {
  const messages = [];
  let normalClicks = 0;
  let listener;
  class Anchor {
    constructor(href) { this.href = href; this.download = 'laporan.xlsx'; }
    click() { normalClicks++; }
    dispatchEvent() { normalClicks++; return true; }
  }
  const sandbox = {
    HTMLAnchorElement: Anchor,
    document: { addEventListener(type, callback) { listener = callback; } },
    TelkomsatFiles: { postMessage(value) { messages.push(JSON.parse(value)); } },
    fetch: async url => ({ blob: async () => ({ size: url.includes('large') ? 21 * 1024 * 1024 : 10,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }),
    FileReader: class {
      readAsDataURL() { this.result = 'data:application/octet-stream;base64,dGVzdA=='; this.onload(); }
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(script, sandbox);
  vm.runInNewContext(script, sandbox); // Next.js navigations must not install duplicate hooks.
  new Anchor('https://example.com/page').click();
  assert.equal(normalClicks, 1);
  new Anchor('blob:https://example.com/one').click();
  new Anchor('blob:https://example.com/two').dispatchEvent({ type: 'click' });
  let prevented = false;
  listener({ target: { closest: () => new Anchor('data:text/plain;base64,dGVzdA==') },
    preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 3);
  assert.ok(prevented);
  for (const message of messages) {
    assert.equal(message.name, 'laporan.xlsx');
    assert.equal(message.data, 'dGVzdA==');
  }
  new Anchor('blob:https://example.com/large').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.at(-1).action, 'error');
  sandbox.print();
  assert.equal(messages.at(-1).action, 'print');
  console.log('PASS: regular links, detached exports, user clicks, size limit, print, repeated installation');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
