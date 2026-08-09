import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectHtmlDocuments, loadLocalHtmlIaGraph, parseHtmlDocument } from './html-document.mjs';
import { omdDocumentHeadExtras } from './omd-head.mjs';
import { LOCAL_HTML_CONTENT_PATH } from './omd-contract.mjs';
import { readTextIfExists } from './fs-ops.mjs';

/**
 * Escape text for HTML body / attributes.
 * @param {string} value
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {string} a
 * @param {string} b
 */
function naturalIdCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * @param {{
 *   label: string,
 *   folder: string,
 *   kind: string,
 *   rows: Array<{ id: string, title?: string, status?: string, summary?: string, href: string }>,
 * }} opts
 */
export function renderCatalogIndexHtml(opts) {
  const { label, folder, kind, rows } = opts;
  const sorted = [...rows].sort((x, y) => naturalIdCompare(x.id, y.id));

  const rowHtml =
    sorted.length === 0
      ? `<p class="text-sm text-muted-foreground px-1 py-6">아직 문서가 없습니다. <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">omd new ${kind} --title "…"</code>로 추가하세요.</p>`
      : `<div class="rounded-md border bg-card text-card-foreground shadow-sm">
      <div class="relative w-full overflow-auto">
        <table class="w-full caption-bottom text-sm">
          <thead class="[&_tr]:border-b">
            <tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[7.5rem]">ID</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Title</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Summary</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[7rem]">Status</th>
            </tr>
          </thead>
          <tbody class="[&_tr:last-child]:border-0">
${sorted
  .map((row) => {
    const title = escapeHtml(row.title || row.id);
    const status = row.status ? escapeHtml(row.status) : '—';
    const summary = row.summary ? escapeHtml(row.summary) : '—';
    const href = escapeHtml(row.href);
    const id = escapeHtml(row.id);
    const statusClass = row.status
      ? 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors text-foreground'
      : 'text-muted-foreground';
    return `            <tr class="border-b transition-colors hover:bg-muted/50">
              <td class="p-4 align-middle whitespace-nowrap"><a class="inline-flex" href="${href}"><span class="omd-id">${id}</span></a></td>
              <td class="p-4 align-middle font-medium"><a class="hover:underline underline-offset-4" href="${href}">${title}</a></td>
              <td class="p-4 align-middle text-muted-foreground max-w-md">${summary}</td>
              <td class="p-4 align-middle"><span class="${statusClass}"${row.status ? ` data-status="${status}"` : ''}>${status}</span></td>
            </tr>`;
  })
  .join('\n')}
          </tbody>
        </table>
      </div>
    </div>`;

  return `<!doctype html>
<html lang="ko" data-omd-catalog="${escapeHtml(folder)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(label)} · catalog</title>
${omdDocumentHeadExtras('../../assets/omd-doc.css')}
</head>
<body class="omd-catalog-page min-h-screen bg-background text-foreground antialiased">
  <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <nav class="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <a class="font-medium text-primary hover:underline underline-offset-4" href="../index.html">Catalogs</a>
      <span aria-hidden="true">/</span>
      <span class="text-foreground">${escapeHtml(label)}</span>
    </nav>
    <header class="mb-6 rounded-xl border bg-card text-card-foreground shadow-sm px-5 py-4">
      <p class="omd-id mb-2">${escapeHtml(folder)}</p>
      <h1 class="font-display text-2xl font-bold tracking-tight">${escapeHtml(label)}</h1>
    </header>
    <main>
      ${rowHtml}
    </main>
  </div>
</body>
</html>
`;
}

/**
 * Build index.html for every catalog under project `.omd/dbs`.
 * @param {string} projectRoot
 * @param {string} skillRoot
 * @param {{ force?: boolean }} [options]
 */
export function planCatalogIndexRebuild(projectRoot, skillRoot, options = {}) {
  const force = options.force === true;
  const graph = loadLocalHtmlIaGraph(skillRoot);
  const dbsAbs = join(projectRoot, LOCAL_HTML_CONTENT_PATH);
  /** @type {Array<{ path: string, kind: string, reason: string, content?: string, conflict?: boolean }>} */
  const operations = [];

  if (!existsSync(dbsAbs)) {
    return operations;
  }

  let documents = [];
  try {
    documents = collectHtmlDocuments(dbsAbs, graph).documents;
  } catch {
    documents = [];
  }

  /** @type {Record<string, typeof documents>} */
  const byFolder = Object.fromEntries(graph.catalogs.map((c) => [c.folder, []]));
  for (const doc of documents) {
    const folder = doc.catalogId;
    if (!byFolder[folder]) byFolder[folder] = [];
    byFolder[folder].push(doc);
  }

  for (const catalog of graph.catalogs) {
    const docs = byFolder[catalog.folder] ?? [];
    const rows = docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status || doc.stage || doc.fields?.status || doc.fields?.stage,
      summary: doc.fields?.summary,
      href: `./${doc.id}.html`,
    }));

    // Fallback: scan folder if collect skipped (e.g. empty prefix archive quirks)
    if (rows.length === 0) {
      const dir = join(dbsAbs, catalog.folder);
      if (existsSync(dir)) {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith('.html') || name === 'index.html') continue;
          try {
            const html = readFileSync(join(dir, name), 'utf8');
            const parsed = parseHtmlDocument(html, `${catalog.folder}/${name}`);
            rows.push({
              id: parsed.id,
              title: parsed.title,
              status: parsed.status || parsed.stage,
              summary: parsed.fields?.summary,
              href: `./${name}`,
            });
          } catch {
            rows.push({
              id: name.replace(/\.html$/i, ''),
              href: `./${name}`,
            });
          }
        }
      }
    }

    const content = renderCatalogIndexHtml({
      label: catalog.label,
      folder: catalog.folder,
      kind: catalog.kind,
      rows,
    });
    const relativePath = `${LOCAL_HTML_CONTENT_PATH}/${catalog.folder}/index.html`;
    operations.push(decideIndex(projectRoot, relativePath, content, force));
  }

  return operations;
}

/**
 * @param {string} root
 * @param {string} relativePath
 * @param {string} content
 * @param {boolean} force
 */
function decideIndex(root, relativePath, content, force) {
  const existing = readTextIfExists(join(root, relativePath));
  if (existing === null) {
    return { path: relativePath, kind: 'create', reason: 'write catalog index', content };
  }
  if (existing === content) {
    return { path: relativePath, kind: 'skip', reason: 'catalog index up to date', content };
  }
  // Generated indexes always refresh when content drifts (force kept for API symmetry).
  void force;
  return { path: relativePath, kind: 'update', reason: 'refresh catalog index', content };
}
