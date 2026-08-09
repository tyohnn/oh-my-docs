import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { parseFrontmatter } from '../runtime/frontmatter.mjs';
import { inspectProject } from '../runtime/inspect.mjs';
import { adoptProject } from '../runtime/adopt.mjs';
import { validatePlanning, validateHtmlPlanning } from '../runtime/planning.mjs';
import { planCreateDocument } from '../runtime/create-document.mjs';
import { parseHtmlDocument, loadLocalHtmlIaGraph } from '../runtime/html-document.mjs';
import { applyFileOperations } from '../runtime/fs-ops.mjs';
import { LOCAL_HTML_CONTENT_PATH } from '../runtime/omd-contract.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(skillRoot, 'templates/default');
const schemasDir = join(skillRoot, 'schemas');

test('frontmatter parses scalars and block arrays', () => {
  const data = parseFrontmatter(
    `---\ntitle: Hello\nstories:\n  - US-one\n  - US-two\nspecs: [SPEC-a, SPEC-b]\n---\n\nBody\n`,
    'sample.mdx',
  );
  assert.equal(data.title, 'Hello');
  assert.deepEqual(data.stories, ['US-one', 'US-two']);
  assert.deepEqual(data.specs, ['SPEC-a', 'SPEC-b']);
});

test('inspect classifies empty directory as greenfield', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-inspect-'));
  try {
    const report = inspectProject({ cwd: root });
    assert.equal(report.mode, 'greenfield');
    assert.equal(report.omd.present, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adopt greenfield writes .omd, docs skeleton, and HTML catalogs', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-adopt-'));
  try {
    const result = adoptProject({
      cwd: root,
      templateRoot,
      skillRoot,
      schemasDir,
      force: true,
    });
    assert.equal(result.mode, 'greenfield');
    assert.ok(existsSync(join(root, '.omd/project.json')));
    assert.ok(existsSync(join(root, '.omd/state.json')));
    assert.ok(existsSync(join(root, 'docs/content/docs/meta.json')));
    assert.ok(existsSync(join(root, 'packages/docs-ui/package.json')));
    assert.ok(existsSync(join(root, '.omd/dbs/index.html')));
    assert.ok(existsSync(join(root, '.omd/assets/omd-doc.css')));
    assert.ok(existsSync(join(root, '.omd/dbs/prds/.gitkeep')));
    assert.ok(existsSync(join(root, '.omd/dbs/layouts/.gitkeep')));
    assert.equal(existsSync(join(root, 'packages/ui')), false);
    assert.equal(existsSync(join(root, '.cursor/skills/oh-my-doc/SKILL.md')), false);
    assert.equal(existsSync(join(root, '.claude/skills/oh-my-doc/SKILL.md')), false);
    assert.equal(existsSync(join(root, '.agents/skills/oh-my-doc/SKILL.md')), false);
    const meta = JSON.parse(readFileSync(join(root, 'docs/content/docs/meta.json'), 'utf8'));
    assert.deepEqual(meta.pages, [
      'index',
      'vision',
      'starting',
      'domain',
      'workflow',
      'planning',
      'plans',
      'adr',
      'spec',
    ]);
    assert.equal(result.contract.ui.base, 'fumadocs');
    assert.equal(result.contract.ui.distribution, 'skill-template');
    assert.equal(result.contract.paths.ui, 'packages/docs-ui');
    assert.equal(result.contract.paths.content, LOCAL_HTML_CONTENT_PATH);
    assert.ok(result.contract.ui.shellDependencies.includes('fumadocs-ui'));
    assert.ok(result.contract.informationArchitecture.graphDigest);
    assert.equal(result.contract.informationArchitecture.kindToDatabase.plan, 'dbs.plans');
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    assert.match(agents, /contentSource\.ssot/);
    assert.match(agents, /Documentation is always first/);
    assert.match(agents, /not left only in conversation/);
    assert.match(agents, /\.omd\/dbs/);
    assert.match(agents, /Planning ≠ Plans|dbs\.plans/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('planning validator accepts ADR locked stage (legacy MDX)', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-plan-'));
  const adrDir = join(root, 'adr');
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(
    join(adrDir, 'meta.json'),
    `${JSON.stringify({ pages: ['index', 'adr-lock'] }, null, 2)}\n`,
  );
  writeFileSync(join(adrDir, 'index.mdx'), '---\ntitle: ADR index\n---\n');
  writeFileSync(
    join(adrDir, 'adr-lock.mdx'),
    `---\ntitle: Lock\nid: ADR-lock\nstage: locked\n---\n\nBody\n`,
  );
  const problems = validatePlanning(root);
  assert.deepEqual(problems, []);
  rmSync(root, { recursive: true, force: true });
});

test('html planning validates ADR locked stage under .omd/dbs', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-html-adr-'));
  const adrDir = join(root, 'adr');
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(
    join(adrDir, 'ADR-lock.html'),
    `<!doctype html>
<html lang="ko" data-omd-kind="adr" data-omd-id="ADR-lock">
<head>
  <meta charset="utf-8" />
  <meta name="omd:id" content="ADR-lock" />
  <meta name="omd:kind" content="adr" />
  <meta name="omd:stage" content="locked" />
  <title>ADR-lock · Lock</title>
</head>
<body>
  <header class="omd-doc-header">
    <p class="omd-id" data-omd-field="id">ADR-lock</p>
    <h1 data-omd-field="title">Lock</h1>
    <dl class="omd-props">
      <dt>stage</dt>
      <dd data-omd-field="stage">locked</dd>
    </dl>
  </header>
  <main class="omd-doc-body"><p>Body</p></main>
</body>
</html>
`,
  );
  const problems = validateHtmlPlanning(root, loadLocalHtmlIaGraph(skillRoot));
  assert.deepEqual(problems, []);
  rmSync(root, { recursive: true, force: true });
});

test('omd new creates HTML under .omd/dbs', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-new-html-'));
  try {
    adoptProject({
      cwd: root,
      templateRoot,
      skillRoot,
      schemasDir,
      force: true,
    });
    const planned = planCreateDocument({
      cwd: root,
      kind: 'prd',
      title: 'Sample Initiative',
      skillRoot,
    });
    assert.equal(planned.id, 'PRD-sample-initiative');
    assert.equal(planned.relativePath, '.omd/dbs/prds/PRD-sample-initiative.html');
    assert.deepEqual(planned.validationProblems, []);
    applyFileOperations(root, planned.operations, { dryRun: false, force: true });
    const html = readFileSync(join(root, planned.relativePath), 'utf8');
    const parsed = parseHtmlDocument(html);
    assert.equal(parsed.kind, 'prd');
    assert.equal(parsed.id, 'PRD-sample-initiative');
    assert.equal(parsed.status, 'draft');
    assert.match(html, /Sample Initiative/);

    const layout = planCreateDocument({
      cwd: root,
      kind: 'layout',
      title: 'App Shell',
      skillRoot,
    });
    assert.equal(layout.relativePath, '.omd/dbs/layouts/LAY-app-shell.html');
    applyFileOperations(root, layout.operations, { dryRun: false, force: true });
    const layoutHtml = readFileSync(join(root, layout.relativePath), 'utf8');
    assert.match(layoutHtml, /omd-wireframe/);
    assert.deepEqual(
      validateHtmlPlanning(join(root, '.omd/dbs'), loadLocalHtmlIaGraph(skillRoot)),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('greenfield adopt without --ssot returns needsSsot local|notion only', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-needs-ssot-'));
  const prev = process.cwd();
  const originalExit = process.exitCode;
  try {
    process.chdir(root);
    process.exitCode = 0;
    const { main } = await import('../scripts/omd.mjs');
    const chunks = [];
    const originalLog = console.log;
    console.log = (...args) => {
      chunks.push(args.map(String).join(' '));
    };
    try {
      await main(['adopt', '--dry-run', '--json']);
    } finally {
      console.log = originalLog;
    }
    assert.equal(process.exitCode, 1);
    const payload = JSON.parse(chunks.join('\n'));
    assert.equal(payload.code, 'needsSsot');
    assert.deepEqual(payload.options, ['local', 'notion']);
    assert.ok(!payload.options.includes('supabase'));
  } finally {
    process.exitCode = originalExit;
    process.chdir(prev);
    rmSync(root, { recursive: true, force: true });
  }
});

test('adopt --ssot supabase errors', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-supabase-removed-'));
  const prev = process.cwd();
  const originalExit = process.exitCode;
  try {
    process.chdir(root);
    process.exitCode = 0;
    const { main } = await import('../scripts/omd.mjs');
    const chunks = [];
    const originalLog = console.log;
    console.log = (...args) => {
      chunks.push(args.map(String).join(' '));
    };
    try {
      await main(['adopt', '--ssot', 'supabase', '--dry-run', '--json']);
    } finally {
      console.log = originalLog;
    }
    assert.equal(process.exitCode, 1);
    const payload = JSON.parse(chunks.join('\n'));
    assert.equal(payload.code, 'supabase_removed');
    assert.match(payload.error, /supabase.*removed/i);
  } finally {
    process.exitCode = originalExit;
    process.chdir(prev);
    rmSync(root, { recursive: true, force: true });
  }
});
