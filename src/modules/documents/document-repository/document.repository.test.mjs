import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('./document.repository.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function repository(actions, data) {
  const exports = {};
  vm.runInNewContext(source, { exports, require: () => actions, crypto, setTimeout, clearTimeout, console });
  return new exports.DocumentRepository(data);
}
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
const document = { id: 'server-id', title: 'Untitled', content: { type: 'doc', content: [] }, revision: 0 };
const saved = revision => ({ ok: true, data: { revision } });

test('typing during creation and saving survives with the same local identity', async () => {
  const create = deferred();
  const save = deferred();
  const saveStarted = deferred();
  let creates = 0;
  const writes = [];
  const repo = repository({
    createDocumentAction: () => { creates++; return create.promise; },
    saveDocumentAction: async (id, content, revision) => {
      writes.push({ id, content, revision });
      saveStarted.resolve();
      return writes.length === 1 ? save.promise : saved(revision + 1);
    },
  });
  const key = repo.localKey;
  const pending = repo.saveNow();
  const repeated = repo.saveNow();
  repo.updateState('first');
  repo.updateState('latest');
  await Promise.resolve();
  assert.equal(creates, 1);
  assert.equal(writes.length, 0);
  create.resolve(document);
  await saveStarted.promise;
  repo.updateState('typed during save');
  save.resolve(saved(1));
  await Promise.all([pending, repeated]);
  await repo.saveNow();
  assert.deepEqual(writes, [
    { id: 'server-id', content: 'latest', revision: 0 },
    { id: 'server-id', content: 'typed during save', revision: 1 },
  ]);
  assert.equal(repo.localKey, key);
  assert.equal(repo.documentId, 'server-id');
  assert.equal(repo.getSnapshot(), 'saved');
  assert.equal(repo.content, 'typed during save');
});

test('existing document skips creation and uses the loaded revision', async () => {
  const repo = repository({
    createDocumentAction: () => assert.fail('must not create'),
    saveDocumentAction: async (id, content, revision) => {
      assert.equal(revision, 8);
      assert.equal(content, 'edit');
      return saved(9);
    },
  }, { ...document, revision: 8 });
  await repo.saveNow();
  repo.updateState('edit');
  await repo.saveNow();
  assert.equal(repo.getSnapshot(), 'saved');
});

test('creation failure retains content and save retry does not recreate', async () => {
  let creates = 0;
  let writes = 0;
  const repo = repository({
    createDocumentAction: async () => {
      if (++creates === 1) throw new Error('offline');
      return document;
    },
    saveDocumentAction: async (id, content) => {
      if (++writes === 1) throw new Error('offline');
      assert.equal(content, 'retained');
      return saved(1);
    },
  });
  repo.updateState('retained');
  await assert.rejects(repo.saveNow());
  assert.equal(repo.getSnapshot(), 'error');
  await assert.rejects(repo.saveNow());
  await repo.saveNow();
  assert.equal(creates, 2);
  assert.equal(writes, 2);
  assert.equal(repo.getSnapshot(), 'saved');
});

test('closing the editor during creation still persists its pending content', async () => {
  const create = deferred();
  let written;
  const repo = repository({
    createDocumentAction: () => create.promise,
    saveDocumentAction: async (id, content) => { written = content; return saved(1); },
  });
  repo.updateState('keep me');
  const pending = repo.saveNow();
  repo.close();
  create.resolve(document);
  await pending;
  assert.equal(written, 'keep me');
});
