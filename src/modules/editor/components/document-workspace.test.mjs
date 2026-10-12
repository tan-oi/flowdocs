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
const { DocumentManager } = loadModule('../../documents/documents-manager/document.manager.ts');

function workspace() {
  const manager = new DocumentManager([]);
  let pathname = '/document/new';
  let open;
  const serverNavigations = [];
  const historyEntries = [];
  const router = { replace: path => serverNavigations.push(path) };
  const jsx = (type, props) => ({ type, props });
  const workspaceModule = loadModule('./document-workspace.tsx', {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      useCallback: callback => callback,
      useContext: () => open,
      useEffect: callback => callback(),
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
  });
  const { default: DocumentSidebar } = loadModule('./document-sidebar.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'link' },
    './document-rename': { default: () => null },
    '../../documents/documents-manager/document-manager-provider': {
      useDocumentManager: () => manager,
      useDocumentManagerSnapshot: () => manager.getSnapshot(),
    },
  }, {
    window: {
      location: { get pathname() { return pathname; } },
      history: { pushState(_state, _title, path) { historyEntries.push(path); pathname = path; } },
    },
  });
  open = workspaceModule.DocumentWorkspace({ children: null }).props.value;
  return {
    manager,
    serverNavigations,
    historyEntries,
    get active() { return manager.activeRepository; },
    route(path, data) {
      pathname = path;
      workspaceModule.DocumentRouteSync({ document: data });
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
  const updatedAt = new Date();
  const before = app.manager.getSnapshot();
  app.manager.renameDocument('Renamed A', 'A', updatedAt);
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
