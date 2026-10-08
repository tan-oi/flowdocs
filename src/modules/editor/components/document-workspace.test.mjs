import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => dependencies[name], crypto, setTimeout, clearTimeout, console });
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
  const jsx = (type, props) => ({ type, props });
  const workspaceModule = loadModule('./document-workspace.tsx', {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      useCallback: callback => callback,
      useContext: () => open,
      useEffect: callback => callback(),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { usePathname: () => pathname },
    '../../documents/document-repository/document.repository': { DocumentRepository },
    '../../documents/documents-manager/document-manager-provider': {
      useDocumentManager: () => manager,
      useDocumentManagerSnapshot: () => manager.getSnapshot(),
    },
    './active-document': { default: () => null },
    './document-sidebar': { default: () => null },
  });
  open = workspaceModule.DocumentWorkspace({ children: null }).props.value;
  return {
    manager,
    get active() { return manager.activeRepository; },
    route(path, data) {
      pathname = path;
      workspaceModule.DocumentRouteSync({ document: data });
    },
  };
}

test('Back to a draft-assigned URL restores its cached content despite the old new-page payload', async () => {
  const app = workspace();
  app.route('/document/new');
  const draft = app.active;
  draft.updateState('saved draft text');
  await draft.saveNow();
  app.route('/document/B', document('B'));
  app.route('/document/C');
  assert.equal(app.active.content, 'saved draft text');
  assert.equal(app.active, draft);
  assert.equal(app.manager.getSnapshot().repositories.length, 2);
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
