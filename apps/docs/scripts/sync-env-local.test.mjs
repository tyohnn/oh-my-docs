import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseArgs,
  parseEnvFile,
  parseEnvKeys,
  planEnvLocalSync,
  serializeEnvFile,
  serializeEnvValue,
  syncEnvLocal,
} from './sync-env-local.mjs';

const docsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('parseEnvKeys ignores comments, blanks, and duplicates', () => {
  const keys = parseEnvKeys(`
# comment
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x

# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://ignored-duplicate.supabase.co
`);
  assert.deepEqual(keys, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]);
});

test('planEnvLocalSync writes env values and preserves unrelated local keys', () => {
  const { next, written, skipped, missing } = planEnvLocalSync({
    keys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://from-runtime.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_from_runtime',
    },
    existing: {
      OTHER_LOCAL: 'keep-me',
    },
  });

  assert.deepEqual(written, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]);
  assert.deepEqual(skipped, []);
  assert.deepEqual(missing, []);
  assert.equal(next.OTHER_LOCAL, 'keep-me');
  assert.equal(next.NEXT_PUBLIC_SUPABASE_URL, 'https://from-runtime.supabase.co');
});

test('planEnvLocalSync skips existing keys unless force', () => {
  const existing = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://already-local.supabase.co',
  };
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://from-runtime.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_from_runtime',
  };

  const keep = planEnvLocalSync({
    keys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    env,
    existing,
  });
  assert.deepEqual(keep.skipped, ['NEXT_PUBLIC_SUPABASE_URL']);
  assert.deepEqual(keep.written, ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
  assert.equal(keep.next.NEXT_PUBLIC_SUPABASE_URL, 'https://already-local.supabase.co');

  const forced = planEnvLocalSync({
    keys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    env,
    existing,
    force: true,
  });
  assert.deepEqual(forced.written, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]);
  assert.equal(forced.next.NEXT_PUBLIC_SUPABASE_URL, 'https://from-runtime.supabase.co');
});

test('serializeEnvValue quotes values that need it', () => {
  assert.equal(serializeEnvValue('plain'), 'plain');
  assert.equal(serializeEnvValue('has space'), '"has space"');
  assert.equal(parseEnvFile('KEY="has space"\n').KEY, 'has space');
  assert.equal(
    serializeEnvFile({ A: '1', B: 'two words' }),
    'A=1\nB="two words"\n',
  );
});

test('syncEnvLocal dry-run does not write and never logs secret values', () => {
  const lines = [];
  const writes = [];
  const secret = 'sb_publishable_super_secret_value';

  const result = syncEnvLocal({
    examplePath: join(docsRoot, '.env.example'),
    localPath: '/tmp/omd-sync-env-local-test.env',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://from-runtime.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret,
    },
    argv: ['--dry-run'],
    log: (line) => lines.push(line),
    writeFile: (path, content) => writes.push({ path, content }),
  });

  assert.equal(result.dryRun, true);
  assert.deepEqual(writes, []);
  assert.ok(result.written.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
  assert.ok(lines.every((line) => !line.includes(secret)));
});

test('parseArgs recognizes dry-run and force', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--force']), { dryRun: true, force: true });
  assert.deepEqual(parseArgs([]), { dryRun: false, force: false });
});
