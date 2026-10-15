import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

const source = ts.transpileModule(readFileSync(new URL('./actions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function actions(renameDocument, deleteDocument, globals = {}) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'zod' ? { z } : { renameDocument, deleteDocument },
    console: { error() {} },
    process: { env: { NODE_ENV: 'test' } },
    ...globals,
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

test('delete validates IDs and handles repeated deletion without exposing database errors', async () => {
  const invalid = await actions(null, () => assert.fail('must not query')).deleteDocumentAction('invalid');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'validation');
  const deleted = await actions(null, async documentId => {
    assert.equal(documentId, id);
    return { id };
  }).deleteDocumentAction(id);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.data.id, id);
  const repeated = await actions(null, async () => null).deleteDocumentAction(id);
  assert.equal(repeated.ok, true);
  const failed = await actions(null, async () => { throw new Error('secret database details'); }).deleteDocumentAction(id);
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'internal');
  assert.ok(!failed.error.message.includes('secret database details'));
});

test('rename and delete simulate delayed failures only in development and before database writes', async () => {
  for (const mode of ['development', 'production']) {
    for (const random of [0, 1]) {
      let writes = 0;
      const delays = [];
      const mutation = async () => { writes++; return { id, title: 'Title', updatedAt: new Date() }; };
      const api = actions(mutation, mutation, {
        process: { env: { NODE_ENV: mode } },
        Math: { random: () => random },
        setTimeout: (resolve, milliseconds) => { delays.push(milliseconds); resolve(); },
      });
      const rename = await api.renameDocumentAction('Title', id);
      const deletion = await api.deleteDocumentAction(id);
      const shouldFail = mode === 'development' && random === 0;
      assert.equal(rename.ok, !shouldFail);
      assert.equal(deletion.ok, !shouldFail);
      assert.equal(writes, shouldFail ? 0 : 2);
      assert.deepEqual(delays, mode === 'development' ? [3000, 3000] : []);
    }
  }
});
