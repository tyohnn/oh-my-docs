import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { adoptProject } from '../runtime/adopt.mjs';
import { planCreateDocument } from '../runtime/create-document.mjs';
import { applyFileOperations } from '../runtime/fs-ops.mjs';
import {
  isWholeProductIaTitle,
  loadLocalHtmlIaGraph,
  parseHtmlDocument,
} from '../runtime/html-document.mjs';
import { validateHtmlPlanning } from '../runtime/planning.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(skillRoot, 'templates/default');
const schemasDir = join(skillRoot, 'schemas');

test('whole-product IA titles are rejected', () => {
  assert.equal(isWholeProductIaTitle('Inbox'), false);
  assert.equal(isWholeProductIaTitle('Settings / account'), false);
  assert.equal(isWholeProductIaTitle('Information architecture'), true);
  assert.equal(isWholeProductIaTitle('전체 IA'), true);
  assert.equal(isWholeProductIaTitle('사이트맵'), true);
  assert.equal(isWholeProductIaTitle('sitemap'), true);
});

test('omd new ia splits by unit title and requires unitType', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-ia-unit-'));
  try {
    adoptProject({ cwd: root, templateRoot, skillRoot, schemasDir, force: true });
    const inbox = planCreateDocument({ cwd: root, kind: 'ia', title: 'Inbox', skillRoot });
    assert.deepEqual(inbox.validationProblems, []);
    applyFileOperations(root, inbox.operations, { dryRun: false, force: true });
    const html = readFileSync(join(root, inbox.relativePath), 'utf8');
    const parsed = parseHtmlDocument(html);
    assert.equal(parsed.fields.unitType, '목록');
    assert.match(html, /data-omd-rel="parent"/);
    assert.match(html, /data-omd-rel="children"/);

    const whole = planCreateDocument({
      cwd: root,
      kind: 'ia',
      title: 'Information architecture',
      skillRoot,
    });
    assert.ok(
      whole.validationProblems.some((problem) => /one information unit/i.test(problem)),
      whole.validationProblems.join('\n'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('layout and screen-state templates put mobile then desktop above the body', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-wire-top-'));
  try {
    adoptProject({ cwd: root, templateRoot, skillRoot, schemasDir, force: true });
    for (const kind of ['layout', 'screen-state']) {
      const planned = planCreateDocument({ cwd: root, kind, title: `Sample ${kind}`, skillRoot });
      assert.deepEqual(planned.validationProblems, []);
      applyFileOperations(root, planned.operations, { dryRun: false, force: true });
      const html = readFileSync(join(root, planned.relativePath), 'utf8');
      const parsed = parseHtmlDocument(html);
      assert.deepEqual(parsed.wireframes.kinds.filter((k) => k === 'mobile' || k === 'desktop'), [
        'mobile',
        'desktop',
      ]);
      assert.equal(parsed.wireframes.placedAtTop, true);
      assert.ok(parsed.wireframes.frames.every((frame) => frame.hasDevice && frame.hasKit));
    }
    assert.deepEqual(
      validateHtmlPlanning(join(root, '.omd/dbs'), loadLocalHtmlIaGraph(skillRoot)),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check rejects wireframes below the body or missing a viewport', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-wire-bad-'));
  const dir = join(root, 'layouts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'LAY-late.html'),
    `<!doctype html>
<html lang="ko" data-omd-kind="layout" data-omd-id="LAY-late">
<head>
  <meta name="omd:id" content="LAY-late" />
  <meta name="omd:kind" content="layout" />
  <title>LAY-late · Late</title>
</head>
<body>
  <header class="omd-doc-header">
    <p class="omd-id" data-omd-field="id">LAY-late</p>
    <h1 data-omd-field="title">Late</h1>
  </header>
  <main class="omd-doc-body"><p>Narrative first</p></main>
  <section class="omd-wireframe" data-omd-wireframe="mobile"><h2>Mobile</h2></section>
  <section class="omd-wireframe" data-omd-wireframe="desktop"><h2>Desktop</h2></section>
</body>
</html>
`,
  );
  const problems = validateHtmlPlanning(root, loadLocalHtmlIaGraph(skillRoot));
  assert.ok(
    problems.some((problem) => /before main\.omd-doc-body/i.test(problem)),
    problems.join('\n'),
  );

  writeFileSync(
    join(dir, 'LAY-one.html'),
    `<!doctype html>
<html lang="ko" data-omd-kind="layout" data-omd-id="LAY-one">
<head>
  <meta name="omd:id" content="LAY-one" />
  <meta name="omd:kind" content="layout" />
  <title>LAY-one · One</title>
</head>
<body>
  <header class="omd-doc-header">
    <p class="omd-id" data-omd-field="id">LAY-one</p>
    <h1 data-omd-field="title">One</h1>
  </header>
  <section class="omd-wireframe" data-omd-wireframe="shell"><h2>Shell</h2></section>
  <main class="omd-doc-body"><p>Body</p></main>
</body>
</html>
`,
  );
  const missing = validateHtmlPlanning(root, loadLocalHtmlIaGraph(skillRoot));
  assert.ok(
    missing.some((problem) => /requires data-omd-wireframe="mobile"/i.test(problem)),
    missing.join('\n'),
  );
});

test('check rejects wireframes missing device chrome or kit blocks', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-wire-kit-'));
  const dir = join(root, 'layouts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'LAY-bare.html'),
    `<!doctype html>
<html lang="ko" data-omd-kind="layout" data-omd-id="LAY-bare">
<head>
  <meta name="omd:id" content="LAY-bare" />
  <meta name="omd:kind" content="layout" />
  <title>LAY-bare · Bare</title>
</head>
<body>
  <header class="omd-doc-header">
    <p class="omd-id" data-omd-field="id">LAY-bare</p>
    <h1 data-omd-field="title">Bare</h1>
  </header>
  <section class="omd-wireframe" data-omd-wireframe="mobile"><h2>Mobile</h2><p>freeform</p></section>
  <section class="omd-wireframe" data-omd-wireframe="desktop"><h2>Desktop</h2><p>freeform</p></section>
  <main class="omd-doc-body"><p>Body</p></main>
</body>
</html>
`,
  );
  const problems = validateHtmlPlanning(root, loadLocalHtmlIaGraph(skillRoot));
  assert.ok(
    problems.some((problem) => /omd-wire-device-mobile/.test(problem)),
    problems.join('\n'),
  );
  assert.ok(
    problems.some((problem) => /kit block/.test(problem)),
    problems.join('\n'),
  );
});
