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
  let reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
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
  await repo.saveNow();
  assert.equal(repo.getSnapshot(), 'retrying');
  await repo.saveNow();
  assert.equal(repo.getSnapshot(), 'retrying');
  await repo.saveNow();
  assert.equal(creates, 2);
  assert.equal(writes, 2);
  assert.equal(repo.getSnapshot(), 'saved');
});

const failed = code => ({ ok: false, error: { code, message: code } });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('conflict shows an error immediately without retrying', async () => {
  let writes = 0;
  const repo = repository({
    saveDocumentAction: async () => { writes++; return failed('conflict'); },
  }, document);
  repo.updateState('edit');
  await assert.rejects(repo.saveNow());
  assert.equal(repo.getSnapshot(), 'conflict');
  await wait(1100);
  assert.equal(writes, 1);
});

test('temporary failures retry three times before showing an error', async () => {
  let writes = 0;
  const repo = repository({
    saveDocumentAction: async () => { writes++; return failed('internal'); },
  }, document);
  repo.updateState('edit');
  for (let attempt = 0; attempt < 3; attempt++) {
    await repo.saveNow();
    assert.equal(repo.getSnapshot(), 'retrying');
  }
  await assert.rejects(repo.saveNow());
  assert.equal(repo.getSnapshot(), 'error');
  assert.equal(writes, 4);
});

test('a successful save resets the retry count', async () => {
  let writes = 0;
  const repo = repository({
    saveDocumentAction: async (id, content, revision) => {
      writes++;
      return writes === 2 ? saved(revision + 1) : failed('internal');
    },
  }, document);
  repo.updateState('first');
  await repo.saveNow();
  await repo.saveNow();
  assert.equal(repo.getSnapshot(), 'saved');
  repo.updateState('second');
  for (let attempt = 0; attempt < 3; attempt++) await repo.saveNow();
  assert.equal(repo.getSnapshot(), 'retrying');
  await assert.rejects(repo.saveNow());
  assert.equal(writes, 6);
});

test('pausing cancels a waiting retry', async () => {
  let writes = 0;
  const repo = repository({
    saveDocumentAction: async () => { writes++; throw new Error('offline'); },
  }, document);
  repo.updateState('edit');
  await repo.saveNow();
  repo.pauseSaving();
  await wait(1100);
  assert.equal(writes, 1);
  assert.equal(repo.getSnapshot(), 'paused');
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

test('confirmed deletion cancels queued saves and editor cleanup cannot flush them', async () => {
  let writes = 0;
  const repo = repository({ saveDocumentAction: async () => { writes++; return saved(1); } }, document);
  repo.updateState('Last edit');
  const saving = repo.saveNow();
  repo.markDeleted();
  repo.close();
  await saving;
  await repo.saveNow();
  assert.equal(writes, 0);
});

test('late save completion cannot schedule another write after confirmed deletion', async () => {
  const first = deferred();
  let writes = 0;
  const repo = repository({ saveDocumentAction: () => { writes++; return first.promise; } }, document);
  repo.updateState('First edit');
  const saving = repo.saveNow();
  await Promise.resolve();
  repo.updateState('Latest edit');
  repo.markDeleted();
  let notifications = 0;
  repo.subscribe(() => notifications++);
  first.resolve(saved(1));
  await saving;
  assert.equal(writes, 1);
  assert.equal(notifications, 0);
});

test('pausing for deletion cancels queued saves and retains typing for a failed delete', async () => {
  const writes = [];
  const repo = repository({ saveDocumentAction: async (_id, content) => {
    writes.push(content);
    return saved(1);
  } }, document);
  repo.updateState('Before delete');
  const queued = repo.saveNow();
  repo.pauseSaving();
  repo.updateState('Typed while delete was pending');
  assert.equal(repo.getSnapshot(), 'paused');
  repo.close();
  await queued;
  await repo.saveNow();
  assert.equal(writes.length, 0);
  await repo.resumeSaving();
  assert.deepEqual(writes, ['Typed while delete was pending']);
  assert.equal(repo.getSnapshot(), 'saved');
});

test('pausing an in-flight save stops follow-up writes and resumes with its acknowledged revision', async () => {
  const first = deferred();
  const writes = [];
  const repo = repository({ saveDocumentAction: async (_id, content, revision) => {
    writes.push({ content, revision });
    return writes.length === 1 ? first.promise : saved(revision + 1);
  } }, document);
  repo.updateState('First edit');
  const saving = repo.saveNow();
  await Promise.resolve();
  repo.updateState('Second edit');
  repo.pauseSaving();
  repo.updateState('Latest edit');
  assert.equal(repo.getSnapshot(), 'paused');
  first.resolve(saved(1));
  await saving;
  assert.equal(writes.length, 1);
  assert.equal(repo.getSnapshot(), 'paused');
  await repo.resumeSaving();
  assert.deepEqual(writes, [
    { content: 'First edit', revision: 0 },
    { content: 'Latest edit', revision: 1 },
  ]);
  assert.equal(repo.getSnapshot(), 'saved');
});

test('a save failure during deletion preserves content for resuming if deletion also fails', async () => {
  const first = deferred();
  let writes = 0;
  const repo = repository({ saveDocumentAction: async (_id, content, revision) => {
    assert.equal(content, 'Retained content');
    assert.equal(revision, 0);
    return ++writes === 1 ? first.promise : saved(1);
  } }, document);
  repo.updateState('Retained content');
  const saving = repo.saveNow();
  await Promise.resolve();
  repo.pauseSaving();
  first.reject(new Error('offline'));
  await saving;
  await repo.resumeSaving();
  assert.equal(writes, 2);
  assert.equal(repo.getSnapshot(), 'saved');
});
