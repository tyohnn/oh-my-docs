import assert from 'node:assert/strict';
import test from 'node:test';

import { handbookDocCacheTag, OMD_HANDBOOK_CACHE_TAG } from './handbook-cache.ts';
import { isRevalidateAuthorized, readRevalidateSecret } from './revalidate-auth.ts';
import { handbookPgSchema, restProfileHeaders } from './supabase-handbook.ts';
import { buildSectionMetas, catalogMetaPayload } from './supabase-meta.ts';

test('handbookPgSchema maps handbookId to omd_h_*', () => {
  assert.equal(handbookPgSchema(undefined), 'public');
  assert.equal(handbookPgSchema('oh-my-docs'), 'omd_h_oh_my_docs');
  assert.throws(() => handbookPgSchema('Bad_Id'));
});

test('restProfileHeaders only set for non-public schemas', () => {
  assert.deepEqual(restProfileHeaders('public'), {});
  assert.deepEqual(restProfileHeaders('omd_h_oh_my_docs'), {
    'Accept-Profile': 'omd_h_oh_my_docs',
    'Content-Profile': 'omd_h_oh_my_docs',
  });
});

test('cache tag helpers stay stable', () => {
  assert.equal(OMD_HANDBOOK_CACHE_TAG, 'omd-handbook');
  assert.equal(handbookDocCacheTag('plans/plan-x'), 'omd-doc:plans/plan-x');
});

test('revalidate auth accepts bearer or custom header', () => {
  const bearer = new Request('http://localhost/api/revalidate', {
    headers: { authorization: 'Bearer secret' },
  });
  assert.equal(readRevalidateSecret(bearer), 'secret');
  assert.equal(isRevalidateAuthorized('secret', 'secret'), true);
  assert.equal(isRevalidateAuthorized('nope', 'secret'), false);
  assert.equal(isRevalidateAuthorized('secret', undefined), false);

  const custom = new Request('http://localhost/api/revalidate', {
    headers: { 'x-omd-revalidate-secret': 'secret' },
  });
  assert.equal(readRevalidateSecret(custom), 'secret');
});

test('buildSectionMetas from project IA keeps root order', () => {
  const metas = buildSectionMetas({
    objects: [],
    fromProject: true,
    nav: {
      localRootOrder: ['pages.home', 'pages.vision', 'pages.starting', 'pages.plans'],
      nested: {
        'pages.planning': ['pages.prds', 'pages.stories'],
      },
    },
    sections: [
      { id: 'vision', title: 'Vision' },
      { id: 'starting', title: 'Start here' },
      { id: 'plans', title: 'Plans' },
      { id: 'planning', title: 'Planning' },
    ],
  });
  assert.deepEqual(metas.get('')?.pages?.slice(0, 4), [
    'index',
    'vision',
    'starting',
    'plans',
  ]);
  assert.deepEqual(metas.get('planning')?.pages, ['index', 'prds', 'stories']);
});

test('catalogMetaPayload omits index', () => {
  assert.deepEqual(catalogMetaPayload(['index', 'plan-one'], 'Plans'), {
    title: 'Plans',
    pages: ['plan-one'],
  });
});
