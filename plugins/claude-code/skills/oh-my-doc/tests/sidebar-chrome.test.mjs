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

test('sidebar uses nested bullets and yellow group for every nested section', () => {
  const refs = loadNotionReferences(skillRoot);
  const mappings = placeholderMappings(refs.iaGraph.nav);

  for (const [parent, children] of Object.entries(refs.iaGraph.nav.nested)) {
    for (const activeKey of [parent, ...children]) {
      const md = renderSidebarPageContent({
        activeKey,
        mappings,
        nav: refs.iaGraph.nav,
        bodyMarkdown: `# ${activeKey}`,
      });
      assert.match(md, /<columns>/);
      assert.match(md, /ratio="20"/);
      assert.match(md, /- <mention-page/);
      assert.equal(resolveActiveSection(activeKey, refs.iaGraph.nav), parent);

      const result = validateSidebarChrome(md, {
        activeKey,
        nav: refs.iaGraph.nav,
      });
      assert.equal(
        result.ok,
        true,
        `${activeKey}: ${result.problems.map((p) => p.message).join('; ')}`,
      );

      assert.match(md, new RegExp(`- <mention-page url="\\{\\{${parent}\\}\\}"/> \\{color="yellow_bg"\\}`));
      for (const child of children) {
        assert.match(
          md,
          new RegExp(`\\t\\t\\t\\t- <mention-page url="\\{\\{${child}\\}\\}"/>`),
        );
      }
      if (children.includes(activeKey)) {
        assert.match(
          md,
          new RegExp(
            `\\t\\t\\t\\t- <mention-page url="\\{\\{${activeKey}\\}\\}"/> \\{color="yellow_bg"\\}`,
          ),
        );
      }
    }
  }
});

test('sidebar keeps inactive nested groups collapsed', () => {
  const refs = loadNotionReferences(skillRoot);
  const mappings = placeholderMappings(refs.iaGraph.nav);
  const md = renderSidebarPageContent({
    activeKey: 'pages.vision',
    mappings,
    nav: refs.iaGraph.nav,
    bodyMarkdown: '# Vision',
  });
  const result = validateSidebarChrome(md, {
    activeKey: 'pages.vision',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, true, result.problems.map((p) => p.message).join('; '));
  assert.doesNotMatch(md, /\t\t\t\t- <mention-page/);
  assert.match(md, new RegExp('- <mention-page url="\\{\\{pages\\.vision\\}\\}"/> \\{color="yellow_bg"\\}'));
});

test('validateSidebarChrome rejects missing yellow nested group', () => {
  const refs = loadNotionReferences(skillRoot);
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.spec}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Spec
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, {
    activeKey: 'pages.spec',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_yellow_group'));
});

test('validateSidebarChrome rejects missing nested children under open group', () => {
  const refs = loadNotionReferences(skillRoot);
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.vision}}"/>
			- <mention-page url="{{pages.starting}}"/>
			- <mention-page url="{{pages.workflow}}"/>
			- <mention-page url="{{pages.domain}}"/>
			- <mention-page url="{{pages.planning}}"/>
			- <mention-page url="{{pages.spec}}"/> {color="yellow_bg"}
			- <mention-page url="{{pages.prds}}"/>
			- <mention-page url="{{pages.plans}}"/>
			- <mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Spec
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, {
    activeKey: 'pages.spec',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_nested_child'));
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
  assert.ok(bodyOps.length >= 18);
  for (const op of bodyOps) {
    assert.match(String(op.payload.content), /- <mention-page/);
    assert.match(String(op.payload.content), /<columns>/);
  }
});
