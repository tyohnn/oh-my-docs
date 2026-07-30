import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';
import { planProvision } from '../runtime/content-sources/notion.mjs';
import {
  renderStackedHomeContent,
  renderSidebarPageContent,
  validateManifestSidebarChrome,
  validateSidebarChrome,
} from '../runtime/content-sources/sidebar.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

test('Notion IA is Home + stacked DBs (no child pages, no sidebar nav)', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.sourcesStrategy, 'stacked-on-home');
  assert.deepEqual(refs.iaGraph.nav.topLevel, ['pages.home']);
  assert.deepEqual(refs.iaGraph.nav.nested, {});
  assert.equal(refs.iaGraph.objects.filter((o) => o.kind === 'page').length, 1);
  assert.ok(refs.iaGraph.objects.every((o) => o.kind !== 'page' || o.key === 'pages.home'));
  assert.ok(
    refs.iaGraph.objects
      .filter((o) => o.kind === 'database')
      .every((o) => o.parent === 'pages.home' && o.inline === true),
  );
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.glossary'), false);
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.vision'), false);
});

test('renderStackedHomeContent stacks inline databases without columns', () => {
  const md = renderStackedHomeContent({
    bodyMarkdown: 'Agent handbook.',
    databases: [
      { key: 'dbs.prds', title: 'PRDs', url: '{{dbs.prds}}' },
      { key: 'dbs.plans', title: 'Plans', url: '{{dbs.plans}}' },
    ],
  });
  assert.match(md, /^Agent handbook\./m);
  assert.match(md, /# PRDs/);
  assert.match(md, /<database url="\{\{dbs\.prds\}\}" inline="true">PRDs<\/database>/);
  assert.match(md, /# Plans/);
  assert.doesNotMatch(md, /<columns>/);
  assert.doesNotMatch(md, /<callout/);
});

test('planProvision stacked home passes chrome validation without sidebar', () => {
  const planned = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(planned.ok, true);
  assert.equal(planned.manifest.sourcesStrategy, 'stacked-on-home');
  assert.equal(planned.manifest.chrome.requiredOn, 'none');
  assert.equal(planned.manifest.chromeValidation.ok, true);

  assert.equal(
    planned.manifest.operations.filter((op) => op.op === 'ensure_page').length,
    0,
  );

  const bodyOps = planned.manifest.operations.filter((op) => op.op === 'write_page_body');
  assert.equal(bodyOps.length, 1);
  assert.equal(bodyOps[0].key, 'pages.home');
  const content = String(bodyOps[0].payload.content);
  assert.doesNotMatch(content, /<columns>/);
  assert.match(content, /<database\b[^>]*inline="true"/);
  assert.match(content, /# Glossary/);
  assert.match(content, /# ADRs/);

  const result = validateManifestSidebarChrome({
    operations: planned.manifest.operations,
    nav: planned.manifest.nav,
    sourcesStrategy: 'stacked-on-home',
  });
  assert.equal(result.ok, true, result.problems.map((p) => p.message).join('; '));
});

test('legacy validateSidebarChrome still rejects broken column chrome', () => {
  const nav = {
    topLevel: ['pages.home', 'pages.prds'],
    nested: {},
  };
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
		</callout>
	</column>
	<column ratio="80">
		# PRDs
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, { activeKey: 'pages.prds', nav });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_nav_item'));
});

test('legacy renderSidebarPageContent still emits columns when called directly', () => {
  const md = renderSidebarPageContent({
    activeKey: 'pages.home',
    mappings: { 'pages.home': { url: '{{pages.home}}' } },
    nav: { topLevel: ['pages.home'], nested: {} },
    bodyMarkdown: '# Home',
  });
  assert.match(md, /<columns>/);
});
