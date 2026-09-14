// Regression checks for the upload API envelope; no network or Firebase writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

let responseBody;
let responseOk = true;
const source = fs.readFileSync(path.join(__dirname, '../lib/utils/cloudinary.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
vm.runInNewContext(outputText, {
  exports: mod.exports,
  require: name => {
    assert.equal(name, '@/lib/firebase/config');
    return { auth: { currentUser: null } };
  },
  FormData,
  fetch: async () => ({ ok: responseOk, json: async () => responseBody }),
});

async function main() {
  const file = new Blob(['photo'], { type: 'image/png' });
  responseBody = { success: true, data: { url: 'https://res.cloudinary.com/demo/image/upload/photo.png', publicId: 'guest/photo' } };
  const image = await mod.exports.uploadImage(file);
  assert.equal(image.url, responseBody.data.url, 'Preview and transaction must receive the uploaded URL');
  assert.equal(image.publicId, responseBody.data.publicId);

  for (const body of [null, {}, { success: true }, { success: true, data: {} },
    { success: true, data: { url: '', publicId: 'photo' } },
    { success: true, data: { url: 'https://example.com/photo.png' } }]) {
    responseBody = body;
    await assert.rejects(mod.exports.uploadImage(file), /Respons upload tidak valid/);
  }
  responseOk = false;
  responseBody = { success: false, error: 'Upload ditolak' };
  await assert.rejects(mod.exports.uploadImage(file), /Upload ditolak/);
  console.log('PASS: upload envelope, preview URL, invalid payload rejection, API errors');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
