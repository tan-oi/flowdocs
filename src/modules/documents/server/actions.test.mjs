import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

const source = ts.transpileModule(readFileSync(new URL('./actions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function actions(renameDocument) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'zod' ? { z } : { renameDocument },
    console: { error() {} },
  });
  return exports;
}

const id = '65905945-3c94-42c1-8b64-f0aab1e0961a';

test('rename validates untrusted input before touching the database', async () => {
  const { renameDocumentAction } = actions(() => assert.fail('must not query'));
  for (const [title, documentId] of [['   ', id], ['Title', 'invalid'], [null, id], ['Title', null]]) {
    const result = await renameDocumentAction(title, documentId);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'validation');
  }
});

test('rename trims the title and waits for the database result', async () => {
  let finish;
  const databaseResult = new Promise(resolve => { finish = resolve; });
  const { renameDocumentAction } = actions((documentId, title) => {
    assert.equal(documentId, id);
    assert.equal(title, 'Project notes');
    return databaseResult;
  });
  let settled = false;
  const request = renameDocumentAction('  Project notes  ', id).then(result => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  const document = { id, title: 'Project notes', updatedAt: new Date() };
  finish(document);
  const result = await request;
  assert.equal(result.ok, true);
  assert.equal(result.data, document);
});

test('rename reports missing documents and database failures', async () => {
  const missing = await actions(async () => null).renameDocumentAction('Title', id);
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, 'not_found');
  const failed = await actions(async () => { throw new Error('connection lost'); })
    .renameDocumentAction('Title', id);
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'internal');
  assert.ok(!failed.error.message.includes('connection lost'));
});
