import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildSectionMetas,
  catalogMetaPayload,
  catalogTitle,
  loadHandbookIa,
} from './pull-supabase-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

test('buildSectionMetas writes root and section folders from handbook IA', () => {
  const ia = loadHandbookIa(repoRoot);
  const metas = buildSectionMetas(ia);

  assert.deepEqual(metas.get('')?.pages?.slice(0, 4), [
    'index',
    'vision',
    'starting',
    'domain',
  ]);
  assert.deepEqual(metas.get('planning')?.pages, ['index', 'prds', 'stories']);
  assert.deepEqual(metas.get('domain')?.pages, ['index', 'glossary', 'models', 'policies']);
  assert.ok(metas.get('spec')?.pages?.includes('data-model'));
  assert.deepEqual(metas.get('workflow')?.pages, ['planning', 'development']);
});

test('catalogMetaPayload omits index so Fumadocs keeps folder.index', () => {
  assert.deepEqual(catalogMetaPayload(['index', 'prd-one', 'prd-two'], 'PRDs'), {
    title: 'PRDs',
    pages: ['prd-one', 'prd-two'],
  });
});

test('catalogTitle prefers IA catalog labels', () => {
  const ia = JSON.parse(
    readFileSync(join(repoRoot, 'skills/oh-my-doc/references/handbook-ia-graph.json'), 'utf8'),
  );
  assert.equal(catalogTitle(ia, 'dbs.prds', 'planning/prds'), 'Product requirements');
  assert.equal(catalogTitle(ia, 'dbs.glossary', 'domain/glossary'), 'Glossary');
});
