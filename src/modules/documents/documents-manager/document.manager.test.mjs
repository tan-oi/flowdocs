import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = ts.transpileModule(readFileSync(new URL('./document.manager.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(source, { exports });

test('reopening moves existing metadata to the top without replacing it with stale data', () => {
  const updatedAt = new Date('2026-10-13T10:00:00Z');
  const first = { id: 'A', title: 'Original title', updatedAt };
  const second = { id: 'B', title: 'B', updatedAt };
  const manager = new exports.DocumentManager([second, first]);
  manager.renameDocument('Renamed A', 'A', updatedAt);
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
  assert.equal(after.activeDocumentId, 'A');
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
