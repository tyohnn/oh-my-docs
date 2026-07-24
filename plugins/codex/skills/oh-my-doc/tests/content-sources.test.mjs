import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { adoptProject } from '../runtime/adopt.mjs';
import { normalizeContentSource } from '../runtime/omd-contract.mjs';
import { parseNotionRoot } from '../runtime/content-sources/notion-root.mjs';
import {
  planProvision,
  recordResult,
  validateSnapshot,
  capabilityBlockers,
} from '../runtime/content-sources/notion.mjs';
import { adoptNotionProject } from '../runtime/content-sources/adopt-notion.mjs';
import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(skillRoot, 'templates/default');
const schemasDir = join(skillRoot, 'schemas');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

test('references Notion templates load from references/ (not ref/)', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.schemaVersion, '1.0');
  assert.ok(refs.iaGraph.objects.some((o) => o.key === 'pages.prds' && o.inlineDatabase === 'dbs.prds'));
  assert.ok(refs.catalogSchemas.schemas.prds);
  assert.match(refs.sidebar, /yellow_bg/);
  assert.match(refs.manualChecklist, /Full width/);
});

test('parseNotionRoot accepts dashed id and URL', () => {
  const fromId = parseNotionRoot(dogfoodRoot);
  assert.equal(fromId.rootPageId, dogfoodRoot);
  const fromUrl = parseNotionRoot(
    `https://www.notion.so/oh-my-doc-${dogfoodRoot.replaceAll('-', '')}`,
  );
  assert.equal(fromUrl.rootPageId, dogfoodRoot);
});

test('local adopt writes explicit contentSource.local', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-local-ssot-'));
  try {
    const result = adoptProject({
      cwd: root,
      templateRoot,
      skillRoot,
      schemasDir,
      force: true,
    });
    assert.equal(result.contract.contentSource.ssot, 'local');
    const project = JSON.parse(readFileSync(join(root, '.omd/project.json'), 'utf8'));
    assert.equal(normalizeContentSource(project).ssot, 'local');
    assert.equal(normalizeContentSource({}).ssot, 'local');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('notion planProvision is deterministic and idempotent with mappings', () => {
  const first = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  const second = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(first.manifestDigest, second.manifestDigest);
  assert.ok(first.manifest.operations.length > 10);
  assert.ok(first.manifest.operations.every((op) => op.expectedParentKey));

  const ensureOps = first.manifest.operations.filter(
    (op) => op.op === 'ensure_page' || op.op === 'ensure_database',
  );
  const results = ensureOps.map((op) => ({
    operationId: op.id,
    status: /** @type {'completed'} */ ('completed'),
    object: {
      key: op.key,
      id: `id-${op.key}`,
      type: op.op === 'ensure_page' ? 'page' : 'database',
    },
  }));
  const provider = recordResult({
    manifest: first.manifest,
    manifestDigest: first.manifestDigest,
    results,
  });
  const replay = planProvision({
    skillRoot,
    notionRoot: dogfoodRoot,
    mappings: provider.notion.mappings,
  });
  for (const op of replay.manifest.operations.filter(
    (o) => o.op === 'ensure_page' || o.op === 'ensure_database',
  )) {
    assert.equal(op.action, 'skip_or_update');
    assert.ok(op.mappedId);
  }

  const snapshot = {
    rootPageId: dogfoodRoot,
    objects: Object.fromEntries(
      Object.entries(provider.notion.mappings).map(([key, value]) => [key, value]),
    ),
    inline: Object.fromEntries(
      first.manifest.operations
        .filter((op) => op.op === 'set_inline')
        .map((op) => [op.key, true]),
    ),
  };
  const validation = validateSnapshot({ manifest: first.manifest, snapshot });
  assert.equal(validation.ok, true);
});

test('capabilityBlockers report missing MCP and auth', () => {
  const blockers = capabilityBlockers({ mcpAvailable: false, authenticated: false });
  assert.deepEqual(
    blockers.map((b) => b.code).sort(),
    ['authentication_required', 'capability_missing'],
  );
});

test('adoptNotion dry-run returns manifest without writing', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-notion-adopt-'));
  try {
    const result = adoptNotionProject({
      cwd: root,
      skillRoot,
      schemasDir,
      notionRoot: dogfoodRoot,
      dryRun: true,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.contentSource.ssot, 'notion');
    assert.ok(result.manifest.operations.length > 0);
    assert.equal(existsSync(join(root, '.omd/project.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adoptNotion --yes writes contract and pending operations', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-notion-write-'));
  try {
    const result = adoptNotionProject({
      cwd: root,
      skillRoot,
      schemasDir,
      notionRoot: `https://www.notion.so/${dogfoodRoot.replaceAll('-', '')}`,
      dryRun: false,
    });
    assert.equal(result.ok, true);
    assert.ok(existsSync(join(root, '.omd/project.json')));
    const project = JSON.parse(readFileSync(join(root, '.omd/project.json'), 'utf8'));
    assert.equal(project.contentSource.ssot, 'notion');
    assert.equal(project.contentSource.notion.rootPageId, dogfoodRoot);
    const state = JSON.parse(readFileSync(join(root, '.omd/state.json'), 'utf8'));
    assert.ok(state.provider.notion.pendingOperationIds.length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
