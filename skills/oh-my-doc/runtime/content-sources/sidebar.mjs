/**
 * Build and validate Notion-flavored Markdown sidebar chrome for a managed page.
 *
 * Layout contract (enforced by `validateSidebarChrome`):
 * - Two columns (20 / 80) with a gray callout nav on the left
 * - Top-level items are bulleted mentions
 * - Active section with children expands as a nested list under a yellow parent
 * - Active leaf mention also gets yellow_bg
 *
 * Highlight form Notion round-trips (suffix):
 *   - <mention-page url="..."/> {color="yellow_bg"}
 */

/**
 * @param {{
 *   activeKey: string,
 *   mappings: Record<string, { id?: string, url?: string }>,
 *   nav: { topLevel: string[], nested: Record<string, string[]> },
 *   bodyMarkdown?: string,
 *   childBlocks?: string[],
 * }} options
 */
export function renderSidebarPageContent(options) {
  const { activeKey, mappings, nav, bodyMarkdown = '', childBlocks = [] } = options;
  const activeSection = resolveActiveSection(activeKey, nav);
  const lines = [];

  lines.push('<columns>');
  lines.push('\t<column ratio="20">');
  lines.push('\t\t<callout icon="📌" color="gray_bg">');

  for (const key of nav.topLevel) {
    const nested = nav.nested[key] ?? [];
    const isActiveParent = key === activeSection;
    const parentHighlight = isActiveParent || key === activeKey;
    lines.push(`\t\t\t- ${renderMention(key, mappings, parentHighlight)}`);
    if (isActiveParent && nested.length > 0) {
      for (const childKey of nested) {
        lines.push(`\t\t\t\t- ${renderMention(childKey, mappings, childKey === activeKey)}`);
      }
    }
  }

  lines.push('\t\t</callout>');
  lines.push('\t</column>');
  lines.push('\t<column ratio="80">');
  for (const line of String(bodyMarkdown).split('\n')) {
    lines.push(line.length ? `\t\t${line}` : '\t\t');
  }
  lines.push('\t</column>');
  lines.push('</columns>');

  for (const block of childBlocks) {
    lines.push(block);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Machine-check sidebar chrome against the double-layer nav contract.
 * @param {string} markdown
 * @param {{
 *   activeKey: string,
 *   nav: { topLevel: string[], nested: Record<string, string[]> },
 *   requirePlaceholders?: boolean,
 * }} options
 * @returns {{ ok: boolean, problems: Array<{ code: string, message: string }> }}
 */
export function validateSidebarChrome(markdown, options) {
  const problems = [];
  const text = String(markdown ?? '');
  const activeKey = options.activeKey;
  const nav = options.nav;
  const activeSection = resolveActiveSection(activeKey, nav);
  const nested = nav.nested[activeSection] ?? [];

  if (!text.includes('<columns>')) {
    problems.push({ code: 'chrome_missing_columns', message: `${activeKey}: missing <columns>` });
  }
  if (!/ratio="20"/.test(text) || !/ratio="80"/.test(text)) {
    problems.push({
      code: 'chrome_column_ratios',
      message: `${activeKey}: expected column ratios 20/80`,
    });
  }
  if (!/<callout\b[^>]*color="gray_bg"/.test(text)) {
    problems.push({
      code: 'chrome_missing_callout',
      message: `${activeKey}: missing gray_bg callout nav`,
    });
  }

  for (const key of nav.topLevel) {
    if (!mentionPresent(text, key)) {
      problems.push({
        code: 'chrome_missing_nav_item',
        message: `${activeKey}: top-level nav missing ${key}`,
      });
    }
  }

  if (!parentYellowPresent(text, activeSection)) {
    problems.push({
      code: 'chrome_missing_yellow_group',
      message: `${activeKey}: active section ${activeSection} must have yellow_bg`,
    });
  }

  if (nested.length > 0) {
    for (const childKey of nested) {
      if (!nestedMentionPresent(text, activeSection, childKey)) {
        problems.push({
          code: 'chrome_missing_nested_child',
          message: `${activeKey}: expected indented nested child ${childKey} under ${activeSection}`,
        });
      }
    }
    if (nested.includes(activeKey) && !childYellowPresent(text, activeKey)) {
      problems.push({
        code: 'chrome_missing_yellow_leaf',
        message: `${activeKey}: active nested page must have yellow_bg`,
      });
    }
  } else if (activeKey === activeSection && !parentYellowPresent(text, activeKey)) {
    problems.push({
      code: 'chrome_missing_yellow_leaf',
      message: `${activeKey}: active top-level page must have yellow_bg`,
    });
  }

  // Inactive nested groups must stay collapsed (no accidental nested bullets).
  for (const [parent, children] of Object.entries(nav.nested)) {
    if (parent === activeSection) continue;
    for (const childKey of children) {
      if (nestedMentionPresent(text, parent, childKey)) {
        problems.push({
          code: 'chrome_unexpected_nested',
          message: `${activeKey}: nested child ${childKey} must not expand under inactive ${parent}`,
        });
      }
    }
  }

  if (options.requirePlaceholders) {
    for (const key of nav.topLevel) {
      if (!text.includes(`{{${key}}}`) && !text.includes(`url="{{${key}}}"`)) {
        // Allow either placeholder form or resolved URLs in planned bodies with {{key}} urls.
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Validate every write_page_body payload in a provision manifest.
 * @param {{
 *   operations: Array<{ op: string, key: string, payload?: { content?: string } }>,
 *   nav: { topLevel: string[], nested: Record<string, string[]> },
 * }} options
 */
export function validateManifestSidebarChrome(options) {
  const problems = [];
  for (const op of options.operations) {
    if (op.op !== 'write_page_body' || !op.key.startsWith('pages.')) continue;
    const content = op.payload?.content;
    if (!content) {
      problems.push({
        code: 'chrome_missing_body',
        message: `${op.key}: write_page_body missing content`,
      });
      continue;
    }
    const result = validateSidebarChrome(content, {
      activeKey: op.key,
      nav: options.nav,
    });
    problems.push(...result.problems);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * @param {string} pageKey
 * @param {{ nested: Record<string, string[]> }} nav
 */
export function resolveActiveSection(pageKey, nav) {
  if (nav.nested[pageKey]) return pageKey;
  for (const [parent, children] of Object.entries(nav.nested)) {
    if (children.includes(pageKey)) return parent;
  }
  return pageKey;
}

/**
 * @param {string} key
 * @param {Record<string, { id?: string, url?: string }>} mappings
 * @param {boolean} highlight
 */
function renderMention(key, mappings, highlight) {
  const url = resolveUrl(key, mappings);
  const mention = `<mention-page url="${url}"/>`;
  return highlight ? `${mention} {color="yellow_bg"}` : mention;
}

/**
 * @param {string} key
 * @param {Record<string, { id?: string, url?: string }>} mappings
 */
function resolveUrl(key, mappings) {
  const mapped = mappings[key];
  if (!mapped) return `{{${key}}}`;
  if (mapped.url) return mapped.url;
  if (mapped.id) {
    const compact = mapped.id.replaceAll('-', '');
    return `https://app.notion.com/p/${compact}`;
  }
  return `{{${key}}}`;
}

function mentionPresent(text, key) {
  return (
    text.includes(`url="{{${key}}}"`) ||
    text.includes(`url="https://app.notion.com/p/${key}"`) ||
    new RegExp(`url="[^"]*${escapeRegExp(key)}[^"]*"`).test(text) ||
    text.includes(key)
  );
}

function parentYellowPresent(text, key) {
  // Top-level bullet with yellow_bg for this key.
  const patterns = [
    new RegExp(
      String.raw`^\t\t\t- <mention-page url="[^"]*${escapeRegExp(key)}[^"]*"/> \{color="yellow_bg"\}`,
      'm',
    ),
    new RegExp(
      String.raw`^\t\t\t- <mention-page url="\{\{${escapeRegExp(key)}\}\}"/> \{color="yellow_bg"\}`,
      'm',
    ),
  ];
  return patterns.some((re) => re.test(text));
}

function childYellowPresent(text, key) {
  const patterns = [
    new RegExp(
      String.raw`^\t\t\t\t- <mention-page url="[^"]*${escapeRegExp(key)}[^"]*"/> \{color="yellow_bg"\}`,
      'm',
    ),
    new RegExp(
      String.raw`^\t\t\t\t- <mention-page url="\{\{${escapeRegExp(key)}\}\}"/> \{color="yellow_bg"\}`,
      'm',
    ),
  ];
  return patterns.some((re) => re.test(text));
}

function nestedMentionPresent(text, parentKey, childKey) {
  // Child must appear as an indented nested bullet after the yellow parent group opens.
  const parentRe = new RegExp(
    String.raw`^\t\t\t- <mention-page url="(?:\{\{${escapeRegExp(parentKey)}\}\}|[^"]*${escapeRegExp(parentKey)}[^"]*)"/> \{color="yellow_bg"\}\n(?:\t\t\t\t- <mention-page[^\n]+\n)*?\t\t\t\t- <mention-page url="(?:\{\{${escapeRegExp(childKey)}\}\}|[^"]*${escapeRegExp(childKey)}[^"]*)"/>`,
    'm',
  );
  return parentRe.test(text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract preservable child blocks from a fetched Notion page markdown body.
 * @param {string} pageMarkdown
 * @returns {string[]}
 */
export function extractChildBlocks(pageMarkdown) {
  const text = String(pageMarkdown ?? '');
  const blocks = [];
  const pageRe = /<page\b[^>]*>[\s\S]*?<\/page>/g;
  const dbRe = /<database\b[^>]*(?:\/>|>[\s\S]*?<\/database>)/g;
  for (const match of text.match(pageRe) ?? []) blocks.push(match.trim());
  for (const match of text.match(dbRe) ?? []) blocks.push(match.trim());
  return blocks;
}

/**
 * Default short body copy per OMD page key.
 * @param {string} key
 * @param {string} title
 */
export function defaultPageBody(key, title) {
  const bodies = {
    'pages.home':
      '# Home\nOh My Docs handbook entry point. Use the left nav to reach Vision, Workflow, Domain, Planning, Spec, Plans, and ADRs.',
    'pages.vision': '# Vision\nProduct intent and long-term direction for this handbook.',
    'pages.starting': '# Start here\nShortest path into the docs-first workflow.',
    'pages.workflow': '# Workflow\nPlanning and development contracts for agents and humans.',
    'pages.workflow-planning':
      '# Workflow Planning\nHow discovery becomes an approved plan before code.',
    'pages.development': '# Development\nHow implementation stays covered by a ready plan.',
    'pages.domain': '# Domain\nLiving glossary, models, and policies.',
    'pages.glossary':
      '# Glossary\nStable TERM definitions. Catalog rows live in the inline database below.',
    'pages.models': '# Models\nDomain models. Catalog rows live in the inline database below.',
    'pages.policies':
      '# Policies\nDomain policies. Catalog rows live in the inline database below.',
    'pages.planning': '# Planning\nPRDs and user stories for bounded product changes.',
    'pages.prds':
      '# PRDs\nProduct requirements. Catalog rows live in the inline database below.',
    'pages.stories':
      '# Stories\nUser outcomes. Catalog rows live in the inline database below.',
    'pages.spec': '# Spec\nObservable contracts for data model, system model, and CLI.',
    'pages.data-model':
      '# Data model\nLiving data contracts. Catalog rows live in the inline database below.',
    'pages.system-model':
      '# System model\nLiving system contracts. Catalog rows live in the inline database below.',
    'pages.cli': '# CLI\nAgent-facing runtime and command contracts.',
    'pages.plans':
      '# Plans\nImplementation plans. Catalog rows live in the inline database below.',
    'pages.adrs':
      '# ADRs\nArchitecture decisions. Catalog rows live in the inline database below.',
  };
  return bodies[key] ?? `# ${title}\n`;
}
