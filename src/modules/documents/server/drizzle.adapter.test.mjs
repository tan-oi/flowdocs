import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import nextEnv from '@next/env';
import * as orm from 'drizzle-orm';
import * as pgCore from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ts from 'typescript';

function loadModule(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => dependencies[name] });
  return exports;
}

// Opt in with FLOWDOCS_DB_TESTS=1. Requires the migrated database in DATABASE_URL.
test('soft delete hides documents and rejects later content saves and renames', {
  skip: process.env.FLOWDOCS_DB_TESTS !== '1',
}, async () => {
  nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    // Shadow the real table so the check cannot modify or list user documents.
    await client.query('CREATE TEMP TABLE documents (LIKE public.documents INCLUDING DEFAULTS) ON COMMIT DROP');
    const schema = loadModule('../../../db/schema.ts', { 'drizzle-orm/pg-core': pgCore });
    const adapter = loadModule('./drizzle.adapter.ts', {
      'drizzle-orm': orm,
      '@/src/db/schema': schema,
      '@/src/db': { db: drizzle({ client }) },
    });

    const document = await adapter.create('Soft delete check');
    const other = await adapter.create('Keep this document');
    const content = { type: 'doc', content: [{ type: 'paragraph' }] };
    assert.equal(await adapter.updateContent(document.id, content, 0), 1);
    assert.equal((await adapter.renameDocument(document.id, 'Before deletion')).title, 'Before deletion');
    assert.equal((await adapter.getDocument(document.id)).id, document.id);
    assert.equal((await adapter.listRecent(5)).length, 2);

    assert.equal((await adapter.deleteDocument(document.id)).id, document.id);
    assert.equal(await adapter.getDocument(document.id), null);
    assert.deepEqual((await adapter.listRecent(5)).map(doc => doc.id), [other.id]);
    assert.equal(await adapter.updateContent(document.id, { type: 'doc', content: [] }, 1), null);
    assert.equal(await adapter.renameDocument(document.id, 'Late rename'), null);

    const { rows: [deleted] } = await client.query(
      'SELECT title, content, revision, deleted_at FROM documents WHERE id = $1', [document.id]
    );
    assert.ok(deleted.deleted_at instanceof Date);
    assert.equal(deleted.title, 'Before deletion');
    assert.deepEqual(deleted.content, content);
    assert.equal(deleted.revision, 1);
    assert.equal(await adapter.deleteDocument(randomUUID()), null);
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
});
