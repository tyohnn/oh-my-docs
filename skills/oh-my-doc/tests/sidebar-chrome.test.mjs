import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';
import { planProvision } from '../runtime/content-sources/notion.mjs';
import {
  renderSidebarPageContent,
  resolveActiveSection,
  validateManifestSidebarChrome,
  validateSidebarChrome,
} from '../runtime/content-sources/sidebar.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

function placeholderMappings(nav) {
  const keys = new Set(nav.topLevel);
  for (const children of Object.values(nav.nested)) {
    for (const key of children) keys.add(key);
  }
  return Object.fromEntries([...keys].map((key) => [key, { url: `{{${key}}}` }]));
}

test('slim Notion IA is Home + catalog pages with flat nav', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.sourcesStrategy, 'catalogs-on-home');
  assert.deepEqual(refs.iaGraph.nav.nested, {});
  assert.deepEqual(refs.iaGraph.nav.topLevel, [
    'pages.home',
    'pages.glossary',
    'pages.models',
    'pages.policies',
    'pages.prds',
    'pages.stories',
    'pages.data-model',
    'pages.system-model',
    'pages.plans',
    'pages.adrs',
  ]);
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.vision'), false);
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.workflow'), false);
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.cli'), false);
  assert.equal(refs.iaGraph.nav.topLevel.includes('pages.prds'), true);
  assert.equal(refs.iaGraph.nav.topLevel.includes('pages.planning'), false);
});

test('sidebar highlights active top-level catalog without details toggles', () => {
  const refs = loadNotionReferences(skillRoot);
  const mappings = placeholderMappings(refs.iaGraph.nav);

  for (const activeKey of refs.iaGraph.nav.topLevel) {
    const md = renderSidebarPageContent({
      activeKey,
      mappings,
      nav: refs.iaGraph.nav,
      bodyMarkdown: `# ${activeKey}`,
    });
    assert.match(md, /<columns>/);
    assert.match(md, /ratio="20"/);
    assert.doesNotMatch(md, /<details>/);
    assert.equal(resolveActiveSection(activeKey, refs.iaGraph.nav), activeKey);

    const result = validateSidebarChrome(md, {
      activeKey,
      nav: refs.iaGraph.nav,
    });
    assert.equal(
      result.ok,
      true,
      `${activeKey}: ${result.problems.map((p) => p.message).join('; ')}`,
    );

    assert.match(
      md,
      new RegExp(
        `- <mention-page url="\\{\\{${activeKey}\\}\\}"/> \\{color="yellow_bg"\\}`,
      ),
    );
  }
});

test('validateSidebarChrome rejects missing top-level nav item', () => {
  const refs = loadNotionReferences(skillRoot);
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.prds}}"/> {color="yellow_bg"}
		</callout>
	</column>
	<column ratio="80">
		# PRDs
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, {
    activeKey: 'pages.prds',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_nav_item'));
});

test('validateSidebarChrome rejects missing yellow active leaf', () => {
  const refs = loadNotionReferences(skillRoot);
  const lines = [
    '<columns>',
    '\t<column ratio="20">',
    '\t\t<callout icon="📌" color="gray_bg">',
    ...refs.iaGraph.nav.topLevel.map(
      (key) => `\t\t\t- <mention-page url="{{${key}}}"/>`,
    ),
    '\t\t</callout>',
    '\t</column>',
    '\t<column ratio="80">',
    '\t\t# PRDs',
    '\t</column>',
    '</columns>',
    '',
  ].join('\n');
  const result = validateSidebarChrome(lines, {
    activeKey: 'pages.prds',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.problems.some(
      (p) => p.code === 'chrome_missing_yellow_group' || p.code === 'chrome_missing_yellow_leaf',
    ),
  );
});

test('planProvision bodies all pass validateManifestSidebarChrome', () => {
  const planned = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(planned.ok, true);
  assert.equal(planned.manifest.chromeValidation.ok, true);
  const result = validateManifestSidebarChrome({
    operations: planned.manifest.operations,
    nav: planned.manifest.nav,
  });
  assert.equal(result.ok, true, result.problems.map((p) => p.message).join('; '));

  const bodyOps = planned.manifest.operations.filter(
    (op) => op.op === 'write_page_body' && op.key.startsWith('pages.'),
  );
  assert.ok(bodyOps.length >= 10);
  for (const op of bodyOps) {
    const content = String(op.payload.content);
    assert.match(content, /<columns>/);
    assert.doesNotMatch(content, /<\/columns>\s*<(?:page|database|details)\b/);
    assert.doesNotMatch(content, /pages\.vision|pages\.workflow/);
  }
});

test('validateSidebarChrome rejects content left after columns', () => {
  const refs = loadNotionReferences(skillRoot);
  const lines = [
    '<columns>',
    '\t<column ratio="20">',
    '\t\t<callout icon="📌" color="gray_bg">',
    ...refs.iaGraph.nav.topLevel.map((key) =>
      key === 'pages.prds'
        ? `\t\t\t- <mention-page url="{{${key}}}"/> {color="yellow_bg"}`
        : `\t\t\t- <mention-page url="{{${key}}}"/>`,
    ),
    '\t\t</callout>',
    '\t</column>',
    '\t<column ratio="80">',
    '\t\t# PRDs',
    '\t</column>',
    '</columns>',
    '<page url="{{pages.extra}}">Extra</page>',
    '',
  ].join('\n');
  const result = validateSidebarChrome(lines, {
    activeKey: 'pages.prds',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_content_outside_right_column'));
});
