import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = ts.transpileModule(readFileSync(new URL('./document.manager.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function loadManager(
  deleteDocumentAction = async id => ({ ok: true, data: { id } }),
  renameDocumentAction = async (title, id) => ({ ok: true, data: { id, title, updatedAt: new Date() } }),
) {
  const exports = {};
  vm.runInNewContext(source, { exports, require: () => ({ deleteDocumentAction, renameDocumentAction }), console });
  return exports.DocumentManager;
}
exports.DocumentManager = loadManager();

test('reopening moves existing metadata to the top without replacing it with stale data', async () => {
  const updatedAt = new Date('2026-10-13T10:00:00Z');
  const first = { id: 'A', title: 'Original title', updatedAt };
  const second = { id: 'B', title: 'B', updatedAt };
  const DocumentManager = loadManager(undefined, async (title, id) => ({ ok: true, data: { id, title, updatedAt } }));
  const manager = new DocumentManager([second, first]);
  assert.equal(manager.activeDocumentId, null);
  assert.equal(manager.getSnapshot().activeDocumentId, null);
  await manager.renameDocument('Renamed A', 'A');
  const before = manager.getSnapshot();
  const renamed = before.recentDocuments[1];
  let notifications = 0;
  manager.subscribe(() => notifications++);

  manager.openDocument({ ...first, updatedAt: new Date('2026-10-14T10:00:00Z') });

  const after = manager.getSnapshot();
  assert.notEqual(after.recentDocuments, before.recentDocuments);
  assert.equal(after.recentDocuments[0], renamed);
  assert.equal(after.recentDocuments[0].title, 'Renamed A');
  assert.equal(after.recentDocuments[0].updatedAt, updatedAt);
  assert.equal(after.recentDocuments[1], second);
  assert.equal(after.activeDocumentId, null);
  assert.equal(after.activeRepository, null);
  assert.equal(notifications, 1);

  const created = { id: 'C', title: 'Untitled', updatedAt };
  manager.openDocument(created);
  assert.equal(manager.getSnapshot().recentDocuments[0], created);
  assert.equal(manager.getSnapshot().recentDocuments[1], renamed);
});

test('registration publishes once, forwards repo changes, and cleans up on removal', () => {
  const manager = new exports.DocumentManager([]);
  const listeners = new Set();
  const repo = {
    localKey: 'local-A',
    documentId: 'A',
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  let notifications = 0;
  manager.subscribe(() => notifications++);

  manager.registerRepository(repo);
  const snapshot = manager.getSnapshot();
  assert.equal(snapshot.repositories[0], repo);
  manager.registerRepository(repo);
  assert.equal(listeners.size, 1);
  assert.equal(notifications, 1);

  listeners.forEach(listener => listener());
  assert.equal(notifications, 2);
  assert.notEqual(manager.getSnapshot(), snapshot);

  manager.unregisterRepository(repo.localKey);
  assert.equal(listeners.size, 0);
  assert.equal(manager.getSnapshot().repositories.length, 0);
});

test('document lookup finds the same repo after a draft receives its server ID', () => {
  const manager = new exports.DocumentManager([]);
  const repo = { localKey: 'local-draft', documentId: null, subscribe: () => () => {} };
  manager.registerRepository(repo);
  assert.equal(manager.getRepositoryByDocumentId('C'), null);
  repo.documentId = 'C';
  assert.equal(manager.getRepositoryByDocumentId('C'), repo);
  assert.equal(manager.getRepositoryByDocumentId('missing'), null);
});

test('activation preserves repo identity and repo notifications do not change selection', () => {
  const manager = new exports.DocumentManager([]);
  let notifyDraft;
  const draft = {
    localKey: 'draft', documentId: null,
    subscribe(listener) { notifyDraft = listener; return () => {}; },
  };
  const other = { localKey: 'other', documentId: 'B', subscribe: () => () => {} };
  manager.registerRepository(draft);
  manager.registerRepository(other);
  manager.activateRepository(draft);
  assert.equal(manager.activeRepository, draft);
  assert.equal(manager.getSnapshot().activeRepository, draft);
  assert.equal(manager.getSnapshot().activeDocumentId, null);

  const snapshot = manager.getSnapshot();
  manager.activateRepository(draft);
  assert.equal(manager.getSnapshot(), snapshot);
  draft.documentId = 'C';
  notifyDraft();
  assert.equal(manager.getSnapshot().activeDocumentId, 'C');
  assert.equal(manager.activeDocumentId, 'C');
  assert.equal(manager.activeRepository, draft);

  manager.activateRepository(other);
  notifyDraft();
  assert.equal(manager.getSnapshot().activeRepository, other);
  assert.equal(manager.getSnapshot().activeDocumentId, 'B');
  manager.activateRepository(draft);
  assert.equal(manager.activeRepository, draft);
  manager.unregisterRepository(draft.localKey);
  assert.equal(manager.getSnapshot().activeRepository, null);
  assert.equal(manager.getSnapshot().activeDocumentId, null);
});

test('deletion keeps the row and repo until success, then evicts and prevents stale reopening', async () => {
  let finish;
  const DocumentManager = loadManager(() => new Promise(resolve => { finish = resolve; }));
  const manager = new DocumentManager([{ id: 'A', title: 'A', updatedAt: new Date() }]);
  let stopped = false;
  let deleted = false;
  let paused = false;
  const repo = {
    localKey: 'local-A', documentId: 'A',
    subscribe: () => () => { stopped = true; },
    markDeleted: () => { deleted = true; },
    pauseSaving: () => { paused = true; },
    resumeSaving: async () => assert.fail('successful deletion must not resume saves'),
  };
  manager.registerRepository(repo);
  manager.activateRepository(repo);
  const deleting = manager.deleteDocument('A');
  assert.equal(paused, true);
  assert.equal(deleted, false);
  assert.equal(manager.activeRepository, repo);
  assert.equal(manager.getSnapshot().recentDocuments.length, 1);
  assert.equal(manager.getSnapshot().repositories[0], repo);
  assert.equal(manager.getRepositoryByDocumentId('A'), repo);
  assert.equal(stopped, false);
  finish({ ok: true, data: { id: 'A' } });
  assert.equal((await deleting).ok, true);
  assert.equal(deleted, true);
  assert.equal(stopped, true);
  assert.equal(manager.getRepository(repo.localKey), null);
  assert.equal(manager.getSnapshot().recentDocuments.length, 0);
  assert.equal(manager.activeRepository, null);
  assert.equal(manager.isDocumentUnavailable('A'), true);
  manager.openDocument({ id: 'A', title: 'Stale', updatedAt: new Date() });
  manager.activateRepository(repo);
  assert.equal(manager.activeRepository, null);
  assert.equal(manager.getSnapshot().recentDocuments.length, 0);
});

test('failed deletion leaves repo, content, metadata and selection intact and allows retry', async () => {
  let attempts = 0;
  const DocumentManager = loadManager(async () => ++attempts === 1
    ? { ok: false, error: { message: 'Try again' } }
    : { ok: true, data: { id: 'A' } });
  const metadata = { id: 'A', title: 'Latest title', updatedAt: new Date() };
  const manager = new DocumentManager([metadata]);
  let resumed = false;
  const repo = {
    localKey: 'local-A', documentId: 'A', content: 'Unsaved edits',
    subscribe: () => () => {}, markDeleted: () => {},
    pauseSaving: () => {}, resumeSaving: async () => { resumed = true; },
  };
  manager.registerRepository(repo);
  manager.activateRepository(repo);
  const failure = await manager.deleteDocument('A');
  assert.equal(failure.ok, false);
  assert.equal(failure.error.message, 'Try again');
  assert.equal(resumed, true);
  assert.equal(manager.getRepositoryByDocumentId('A'), repo);
  assert.equal(manager.getSnapshot().recentDocuments[0], metadata);
  assert.equal(manager.activeRepository, repo);
  assert.equal(repo.content, 'Unsaved edits');
  assert.equal((await manager.deleteDocument('A')).ok, true);
});

test('rename waits for backend confirmation and returns failures without publishing metadata changes', async () => {
  let finish;
  let attempts = 0;
  const failure = { ok: false, error: { message: 'Invalid title' } };
  const DocumentManager = loadManager(undefined, (title, id) => {
    assert.equal(id, 'A');
    assert.equal(title, 'Requested title');
    return ++attempts === 1 ? new Promise(resolve => { finish = resolve; }) : failure;
  });
  const manager = new DocumentManager([{ id: 'A', title: 'Original', updatedAt: new Date() }]);
  const before = manager.getSnapshot();
  const renaming = manager.renameDocument('Requested title', 'A');
  assert.equal(manager.getSnapshot(), before);
  const success = { ok: true, data: { id: 'A', title: 'Canonical title', updatedAt: new Date() } };
  finish(success);
  assert.equal(await renaming, success);
  assert.equal(manager.getSnapshot().recentDocuments[0].title, 'Canonical title');
  const renamed = manager.getSnapshot();
  assert.equal(await manager.renameDocument('Requested title', 'A'), failure);
  assert.equal(manager.getSnapshot(), renamed);
});

test('rename and delete turn rejected requests into returned errors without mutating document state', async () => {
  const reject = async () => { throw new Error('Network failure'); };
  const DocumentManager = loadManager(reject, reject);
  const manager = new DocumentManager([{ id: 'A', title: 'Original', updatedAt: new Date() }]);
  const snapshot = manager.getSnapshot();
  const rename = await manager.renameDocument('New', 'A');
  const deletion = await manager.deleteDocument('A');
  assert.equal(rename.ok, false);
  assert.equal(deletion.ok, false);
  assert.match(rename.error.message, /rename/);
  assert.match(deletion.error.message, /delete/);
  assert.equal(manager.getSnapshot(), snapshot);
});

test('a clean cached document left over 3 minutes ago is dropped, unsaved ones are kept', () => {
  const DocumentManager = loadManager();
  const manager = new DocumentManager([]);
  const repo = (id, clean) => ({
    documentId: id, localKey: `key-${id}`, title: id, updatedAt: new Date(),
    lastUsedAt: Date.now() - 4 * 60_000, isClean: () => clean, subscribe: () => () => {},
  });
  const old = repo('old', true);
  const dirty = repo('dirty', false);
  const recent = { ...repo('recent', true), lastUsedAt: Date.now() };
  [old, dirty, recent].forEach(r => manager.registerRepository(r));

  assert.equal(manager.getCachedRepository('old'), null);
  assert.equal(manager.getRepositoryByDocumentId('old'), null);
  assert.equal(manager.getCachedRepository('dirty'), dirty);
  assert.equal(manager.getCachedRepository('recent'), recent);
});
