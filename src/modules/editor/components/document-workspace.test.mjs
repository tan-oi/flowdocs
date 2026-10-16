import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, dependencies = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => dependencies[name], crypto, setTimeout, clearTimeout, console, ...globals });
  return exports;
}

const document = id => ({ id, title: id, content: { type: 'doc', content: [] }, revision: 0 });
const { DocumentRepository } = loadModule('../../documents/document-repository/document.repository.ts', {
  '../server/actions': {
    createDocumentAction: async () => document('C'),
    saveDocumentAction: async (_id, _content, revision) => ({ ok: true, data: { revision: revision + 1 } }),
  },
});
function workspace(deleteDocumentAction = async id => ({ ok: true, data: { id } })) {
  const { DocumentManager } = loadModule('../../documents/documents-manager/document.manager.ts', {
    '../server/actions': {
      deleteDocumentAction,
      renameDocumentAction: async (title, id) => ({ ok: true, data: { id, title, updatedAt: new Date() } }),
    },
  });
  const manager = new DocumentManager([]);
  let pathname = '/document/new';
  let open;
  const serverNavigations = [];
  const historyEntries = [];
  const windowListeners = new Map();
  const cleanups = [];
  let deletion;
  let deleteError;
  const router = { replace: path => serverNavigations.push(path) };
  const jsx = (type, props) => ({ type, props });
  const workspaceModule = loadModule('./document-workspace.tsx', {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      useCallback: callback => callback,
      useContext: () => open,
      useEffect: callback => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { usePathname: () => pathname, useRouter: () => router },
    '../../documents/document-repository/document.repository': { DocumentRepository },
    '../../documents/documents-manager/document-manager-provider': {
      useDocumentManager: () => manager,
      useDocumentManagerSnapshot: () => manager.getSnapshot(),
    },
    './active-document': { default: () => null },
    './document-sidebar': { default: () => null },
  }, {
    window: {
      addEventListener: (name, callback) => windowListeners.set(name, callback),
      removeEventListener: (name, callback) => {
        if (windowListeners.get(name) === callback) windowListeners.delete(name);
      },
    },
  });
  const providers = {
    useDocumentManager: () => manager,
    useDocumentManagerSnapshot: () => manager.getSnapshot(),
  };
  const { default: DocumentDelete } = loadModule('./document-delete.tsx', {
    react: {
      useState: initial => [initial, value => { deleteError = value; }],
      useTransition: () => [false, callback => { deletion = callback(); }],
    },
    'next/navigation': { useRouter: () => router },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../documents/documents-manager/document-manager-provider': providers,
  }, {
    window: {
      location: { get pathname() { return pathname; } },
      history: { replaceState(_state, _title, path) { pathname = path; } },
    },
  });
  const { default: DocumentSidebar } = loadModule('./document-sidebar.tsx', {
    react: { useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'link' },
    './document-rename': { default: () => null },
    './document-delete': { default: DocumentDelete },
    '../../documents/documents-manager/document-manager-provider': providers,
  }, {
    window: {
      location: { get pathname() { return pathname; } },
      history: { pushState(_state, _title, path) { historyEntries.push(path); pathname = path; } },
    },
  });
  open = workspaceModule.DocumentWorkspace({ children: null }).props.value;
  return {
    manager,
    unmount: () => cleanups.forEach(cleanup => cleanup()),
    unloadBlocked() {
      let blocked = false;
      windowListeners.get('beforeunload')?.({ preventDefault() { blocked = true; }, returnValue: undefined });
      return blocked;
    },
    serverNavigations,
    historyEntries,
    get active() { return manager.activeRepository; },
    get deleteError() { return deleteError; },
    renderSidebar: () => DocumentSidebar(),
    route(path, data) {
      pathname = path;
      workspaceModule.DocumentRouteSync({ document: data });
    },
    delete(documentId) {
      function findDelete(node) {
        if (!node || typeof node !== 'object') return null;
        if (typeof node.type === 'function') return findDelete(node.type(node.props));
        if (node.props?.['aria-label'] === `Delete ${documentId}`) return node;
        for (const child of [node.props?.children].flat(Infinity)) {
          const found = findDelete(child);
          if (found) return found;
        }
        return null;
      }
      const button = findDelete(DocumentSidebar());
      assert.ok(button);
      button.props.onClick();
      return deletion;
    },
    click(documentId) {
      function findLink(node) {
        if (!node || typeof node !== 'object') return null;
        if (node.props?.href === `/document/${documentId}`) return node;
        for (const child of [node.props?.children].flat(Infinity)) {
          const found = findLink(child);
          if (found) return found;
        }
        return null;
      }
      const link = findLink(DocumentSidebar());
      assert.ok(link);
      assert.equal(link.props.prefetch, false);
      let prevented = false;
      link.props.onNavigate({ preventDefault() { prevented = true; } });
      return prevented;
    },
  };
}

test('Back to a draft-assigned URL restores its cached content despite the old new-page payload', async () => {
  const app = workspace();
  app.route('/document/new');
  const draft = app.active;
  draft.updateState('saved draft text');
  await draft.saveNow();
  app.route('/document/C');
  assert.equal(app.active, draft);
  assert.equal(app.serverNavigations.length, 0);
  app.route('/document/B', document('B'));
  app.route('/document/C');
  assert.equal(app.active.content, 'saved draft text');
  assert.equal(app.active, draft);
  assert.equal(app.manager.getSnapshot().repositories.length, 2);
});

test('cached sidebar navigation preserves repo identity and skips server navigation', () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  const first = app.active;
  app.manager.openDocument(document('A'));
  app.route('/document/B', document('B'));
  app.manager.openDocument(document('B'));
  assert.equal(app.click('A'), true);
  assert.equal(app.active, first);
  assert.deepEqual(app.historyEntries, ['/document/A']);
  app.route('/document/A', document('B'));
  assert.equal(app.active, first);
  assert.equal(app.serverNavigations.length, 0);
  assert.equal(app.click('A'), true);
  assert.equal(app.historyEntries.length, 1);
});

test('uncached sidebar navigation leaves the Next link untouched', () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  const first = app.active;
  app.manager.openDocument(document('B'));
  assert.equal(app.click('B'), false);
  assert.equal(app.active, first);
  assert.equal(app.historyEntries.length, 0);
});

test('renaming updates metadata and survives reopening without disturbing a content save', async () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  const first = app.active;
  app.manager.openDocument(document('A'));
  first.updateState('Keep these edits');
  const saving = first.saveNow();
  app.route('/document/B', document('B'));
  app.manager.openDocument(document('B'));
  const before = app.manager.getSnapshot();
  const result = await app.manager.renameDocument('Renamed A', 'A');
  const updatedAt = result.data.updatedAt;
  const metadata = app.manager.getSnapshot().recentDocuments.find(doc => doc.id === 'A');
  assert.equal(metadata.title, 'Renamed A');
  assert.equal(metadata.updatedAt, updatedAt);
  assert.equal(first.title, 'A');
  assert.notEqual(app.manager.getSnapshot(), before);
  assert.equal(app.active.documentId, 'B');
  assert.equal(app.click('A'), true);
  assert.equal(app.active, first);
  await saving;
  assert.equal(first.content, 'Keep these edits');
  assert.equal(first.getSnapshot(), 'saved');
  app.manager.openDocument({ id: 'A', title: first.title, updatedAt });
  assert.equal(app.manager.getSnapshot().recentDocuments[0].title, 'Renamed A');
});

test('history cache misses load the URL through Next instead of creating a blank repo', () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  const first = app.active;
  app.route('/document/B', document('B'));
  const second = app.active;
  app.manager.unregisterRepository(first.localKey);
  app.route('/document/A', document('B'));
  assert.equal(app.active, second);
  assert.deepEqual(app.serverNavigations, ['/document/A']);
  app.route('/document/A', document('A'));
  assert.equal(app.active.documentId, 'A');
  assert.notEqual(app.active, first);
});

test('URL changes select a new draft instead of stale server-page data', () => {
  const app = workspace();
  const previous = document('A');
  app.route('/document/A', previous);
  const existing = app.active;
  app.route('/document/new', previous);
  assert.notEqual(app.active, existing);
  assert.equal(app.active.documentId, null);
});

test('deleting the active document selects a cached neighbor and Back cannot resurrect it', async () => {
  const app = workspace();
  app.route('/document/B', document('B'));
  const neighbor = app.active;
  app.manager.openDocument(document('B'));
  app.route('/document/A', document('A'));
  app.manager.openDocument(document('A'));
  const pending = app.delete('A');
  assert.equal(app.active.documentId, 'A');
  await pending;
  assert.equal(app.active, neighbor);
  assert.equal(app.serverNavigations.length, 0);
  app.route('/document/A', document('A'));
  assert.equal(app.active, neighbor);
  assert.deepEqual(app.serverNavigations, ['/document/B']);
  await Promise.resolve();
  app.route('/document/A', document('A'));
  assert.equal(app.active, neighbor);
  assert.equal(app.manager.getRepositoryByDocumentId('A'), null);
});

test('deleting an inactive document leaves the editor and URL alone', async () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  app.manager.openDocument(document('A'));
  app.route('/document/B', document('B'));
  app.manager.openDocument(document('B'));
  const current = app.active;
  await app.delete('A');
  assert.equal(app.active, current);
  assert.equal(app.serverNavigations.length, 0);
  assert.equal(app.historyEntries.length, 0);
  await Promise.resolve();
  assert.equal(app.manager.getRepositoryByDocumentId('A'), null);
});

test('deleting the only document navigates to a fresh draft', async () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  app.manager.openDocument(document('A'));
  const removed = app.active;
  await app.delete('A');
  assert.equal(app.active, null);
  assert.deepEqual(app.serverNavigations, ['/document/new']);
  app.route('/document/new', document('A'));
  assert.notEqual(app.active, removed);
  assert.equal(app.active.documentId, null);
});

test('navigation during deletion is preserved when the backend confirms later', async () => {
  let finish;
  const app = workspace(() => new Promise(resolve => { finish = resolve; }));
  app.route('/document/A', document('A'));
  app.manager.openDocument(document('A'));
  const pending = app.delete('A');
  assert.equal(app.active.documentId, 'A');
  app.route('/document/B', document('B'));
  app.manager.openDocument(document('B'));
  const current = app.active;
  finish({ ok: true, data: { id: 'A' } });
  await pending;
  assert.equal(app.active, current);
  assert.equal(app.serverNavigations.length, 0);
});

test('failed sidebar deletion never removes the editor or navigates away', async () => {
  const app = workspace(async () => ({ ok: false, error: { message: 'Offline' } }));
  app.route('/document/A', document('A'));
  app.manager.openDocument(document('A'));
  const current = app.active;
  await app.delete('A');
  assert.equal(app.deleteError, 'Offline');
  assert.equal(app.active, current);
  assert.equal(app.manager.getSnapshot().recentDocuments[0].id, 'A');
  assert.equal(app.serverNavigations.length, 0);
  assert.equal(app.historyEntries.length, 0);
});

test('starting deletion hides the saving label while keeping the document row', async () => {
  let finish;
  const app = workspace(() => new Promise(resolve => { finish = resolve; }));
  app.route('/document/A', document('A'));
  app.manager.openDocument(document('A'));
  const repo = app.active;
  repo.updateState('Pending edit');
  const saving = repo.saveNow();
  await Promise.resolve();
  assert.equal(repo.getSnapshot(), 'saving');
  assert.ok(JSON.stringify(app.renderSidebar()).includes('"data-status":"saving"'));
  const deleting = app.delete('A');
  assert.equal(repo.getSnapshot(), 'paused');
  const sidebar = JSON.stringify(app.renderSidebar());
  assert.ok(!sidebar.includes('"data-status":"saving"'));
  assert.ok(sidebar.includes('/document/A'));
  assert.equal(app.active, repo);
  finish({ ok: true, data: { id: 'A' } });
  await Promise.all([saving, deleting]);
});


test('background draft creation publishes a sidebar link without changing selection', async () => {
  const app = workspace();
  app.route('/document/new');
  const draft = app.active;
  draft.updateState('Background text');
  const saving = draft.saveNow();
  app.route('/document/B', document('B'));
  const selected = app.active;
  await saving;
  assert.equal(app.active, selected);
  assert.ok(app.manager.getSnapshot().recentDocuments.some(doc => doc.id === 'C'));
  assert.equal(app.click('C'), true);
  assert.equal(app.active, draft);
  assert.equal(app.active.content, 'Background text');
});

test('renamed metadata survives falling out of the 50 recent documents', async () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  await app.manager.renameDocument('Renamed A', 'A');
  for (let i = 0; i < 50; i++) {
    app.route(`/document/doc-${i}`, document(`doc-${i}`));
  }
  assert.equal(app.manager.getSnapshot().recentDocuments.length, 50);
  app.route('/document/A', document('A'));
  assert.equal(app.manager.getSnapshot().recentDocuments[0].title, 'Renamed A');
});

test('opening an uncached document during deletion pauses and retires its new repository', async () => {
  let finish;
  const app = workspace(() => new Promise(resolve => { finish = resolve; }));
  app.route('/document/B', document('B'));
  app.manager.openDocument(document('A'));
  const deleting = app.delete('A');
  app.route('/document/A', document('A'));
  const opened = app.active;
  assert.equal(opened.getSnapshot(), 'paused');
  finish({ ok: true, data: { id: 'A' } });
  await deleting;
  assert.notEqual(app.active, opened);
  assert.ok(!app.manager.getSnapshot().repositories.includes(opened));
  opened.updateState('Must not save');
  await opened.saveNow();
  assert.notEqual(opened.content, 'Must not save');
});

test('unload checks inactive edits and removes its listener when the workspace unmounts', async () => {
  const app = workspace();
  app.route('/document/A', document('A'));
  const first = app.active;
  assert.equal(app.unloadBlocked(), false);
  first.updateState('Unsaved A');
  app.route('/document/B', document('B'));
  assert.equal(app.active.getSnapshot(), 'saved');
  assert.equal(app.unloadBlocked(), true);
  await first.saveNow();
  assert.equal(app.unloadBlocked(), false);
  app.unmount();
  first.updateState('Another edit');
  assert.equal(app.unloadBlocked(), false);
  await first.saveNow();
});


test('failed deletion resumes a repository opened while the request was pending', async () => {
  let finish;
  const app = workspace(() => new Promise(resolve => { finish = resolve; }));
  app.manager.openDocument(document('A'));
  const deleting = app.manager.deleteDocument('A');
  app.route('/document/A', document('A'));
  const opened = app.active;
  opened.updateState('Typed while deleting');
  assert.equal(opened.getSnapshot(), 'paused');
  finish({ ok: false, error: { code: 'internal', message: 'Offline' } });
  assert.equal((await deleting).ok, false);
  await opened.saveNow();
  assert.equal(app.active, opened);
  assert.equal(opened.content, 'Typed while deleting');
  assert.equal(opened.getSnapshot(), 'saved');
});

test('overlapping delete callers share one request and saving resumes after failure', async () => {
  let finish;
  let calls = 0;
  const app = workspace(() => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  });
  app.route('/document/A', document('A'));
  const opened = app.active;
  const first = app.manager.deleteDocument('A');
  const second = app.manager.deleteDocument('A');
  assert.equal(first, second);
  assert.equal(calls, 1);
  opened.updateState('Retained');
  finish({ ok: false, error: { code: 'internal', message: 'Offline' } });
  await first;
  await opened.saveNow();
  assert.equal(opened.getSnapshot(), 'saved');
  const retry = app.manager.deleteDocument('A');
  assert.equal(calls, 2);
  finish({ ok: true, data: { id: 'A' } });
  await retry;
  assert.equal(app.manager.getRepositoryByDocumentId('A'), null);
});
