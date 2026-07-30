import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readRevalidateEnv,
  revalidateAgentGuidance,
} from '../runtime/content-sources/revalidate-env.mjs';

test('readRevalidateEnv reports missing keys without exposing secrets', () => {
  const status = readRevalidateEnv({
    OMD_DOCS_URL: 'https://docs.example.com/',
    OMD_REVALIDATE_SECRET: 'do-not-echo',
  });
  assert.equal(status.ready, true);
  assert.equal(status.docsUrl, 'https://docs.example.com');
  assert.equal(status.hasSecret, true);
  assert.deepEqual(status.missing, []);
  assert.equal(JSON.stringify(status).includes('do-not-echo'), false);
});

test('readRevalidateEnv lists missing keys', () => {
  const status = readRevalidateEnv({});
  assert.equal(status.ready, false);
  assert.deepEqual(status.missing, ['OMD_DOCS_URL', 'OMD_REVALIDATE_SECRET']);
});

test('revalidateAgentGuidance tells agents to run setup, not users', () => {
  const guidance = revalidateAgentGuidance({ ready: false });
  assert.match(guidance.principle, /agent/i);
  assert.match(guidance.principle, /Do not ask the user to run curl/i);
  assert.equal(guidance.ready, false);
  assert.ok(guidance.steps.length >= 4);
  assert.match(guidance.blockerWhenUnset, /stale/i);
});
