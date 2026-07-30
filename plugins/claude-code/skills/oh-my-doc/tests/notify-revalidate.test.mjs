import assert from 'node:assert/strict';
import test from 'node:test';

import { notifyDocsRevalidate } from '../runtime/content-sources/notify-revalidate.mjs';

test('notifyDocsRevalidate skips when env missing', async () => {
  const result = await notifyDocsRevalidate({
    docsUrl: '',
    secret: '',
  });
  assert.equal(result.skipped, true);
  assert.equal(result.ok, false);
});

test('notifyDocsRevalidate posts bearer token without logging secret', async () => {
  /** @type {RequestInit | undefined} */
  let init;
  const result = await notifyDocsRevalidate({
    docsUrl: 'https://docs.example.com',
    secret: 'super-secret',
    paths: ['plans/plan-x'],
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://docs.example.com/api/revalidate');
      init = options;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(init?.method, 'POST');
  assert.equal(init?.headers?.authorization, 'Bearer super-secret');
  assert.match(String(init?.body), /plans\/plan-x/);
});
