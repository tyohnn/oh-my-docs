import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalogForKind,
  collectHtmlDocuments,
  idMatchesPrefix,
  loadLocalHtmlIaGraph,
} from './html-document.mjs';
import { renderCatalogIndexHtml } from './catalog-index.mjs';
import { validateHtmlPlanning } from './planning.mjs';
import { readProject } from './omd-contract.mjs';

function op(path, kind, reason, content, conflict) {
  return {
    path,
    kind,
    reason,
    ...(content !== undefined ? { content } : {}),
    ...(conflict ? { conflict: true } : {}),
  };
}

/** Lowercase kebab slug from a human title. */
export function slugifyTitle(title) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) throw new Error('title produces an empty slug');
  return slug;
}

/**
 * @param {string | string[] | null} prefix
 */
function primaryPrefix(prefix) {
  if (prefix == null) return '';
  return Array.isArray(prefix) ? prefix[0] : prefix;
}

/**
 * @param {string} skillRoot
 * @param {string} kind
 * @param {string} templateFile
 */
function readHtmlTemplate(skillRoot, kind, templateFile) {
  const candidates = [
    join(skillRoot, 'templates/default/omd/templates', templateFile),
    join(fileURLToPath(new URL('../templates/default/omd/templates', import.meta.url)), templateFile),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
  }
  throw new Error(`HTML template for ${kind} not found (${templateFile})`);
}

/**
 * @param {string} template
 * @param {{ kind: string, id: string, title: string, catalog: { prefix: string | string[] | null } }} ctx
 */
function renderHtmlDocument(template, ctx) {
  const { kind, id, title } = ctx;
  let body = template;
  body = body.replaceAll(`data-omd-id="${placeholderId(kind)}"`, `data-omd-id="${id}"`);
  body = body.replaceAll(`content="${placeholderId(kind)}"`, `content="${id}"`);
  body = body.replaceAll(`>${placeholderId(kind)}<`, `>${id}<`);
  body = body.replaceAll(`${placeholderId(kind)} · `, `${id} · `);
  body = body.replaceAll(`<title>${placeholderId(kind)} · `, `<title>${id} · `);

  // Title placeholders in templates
  const titlePlaceholders = [
    '<initiative>',
    '<user outcome>',
    '<feature>',
    '<release>',
    '<policy>',
    '<decision>',
    '<implementation>',
    '<area>',
    '<page>',
    '<layout>',
    '<screen · state>',
    '<archived title>',
    '<term>',
    '<model>',
    '<contract>',
  ];
  for (const ph of titlePlaceholders) {
    body = body.replaceAll(ph, title);
  }
  body = body.replace(
    /(<h1[^>]*data-omd-field="title"[^>]*>)[\s\S]*?(<\/h1>)/i,
    `$1${escapeHtml(title)}$2`,
  );
  body = body.replace(/<title>([^<]*)<\/title>/i, `<title>${escapeHtml(id)} · ${escapeHtml(title)}</title>`);

  if (kind === 'plan') {
    body = setMeta(body, 'stage', 'draft');
    body = setMeta(body, 'changeType', 'maintenance');
    body = setField(body, 'stage', 'draft');
    body = setField(body, 'changeType', 'maintenance');
    body = setField(body, 'codeAreas', 'packages/');
  }
  if (kind === 'prd' || kind === 'feature' || kind === 'release') {
    body = setMeta(body, 'status', 'draft');
    body = setField(body, 'status', 'draft');
  }
  if (kind === 'spec') {
    body = setMeta(body, 'stage', 'draft');
    body = setField(body, 'stage', 'draft');
  }
  if (kind === 'adr') {
    body = setMeta(body, 'stage', 'accepted');
    body = setField(body, 'stage', 'accepted');
  }
  return body;
}

function placeholderId(kind) {
  const map = {
    prd: 'PRD-<initiative>',
    story: 'US-<story>',
    feature: 'FEAT-<feature>',
    release: 'REL-<release>',
    policy: 'POL-<policy>',
    adr: 'ADR-NNN',
    plan: 'PLAN-<initiative>',
    ia: 'IA-<area>',
    page: 'PAGE-<page>',
    layout: 'LAY-<layout>',
    'screen-state': 'STA-<state>',
    archive: '<original-id>',
    term: 'TERM-<term>',
    model: 'MODEL-<model>',
    spec: 'SPEC-<contract>',
  };
  return map[kind] ?? `<${kind}-id>`;
}

function setMeta(html, name, value) {
  const re = new RegExp(`(<meta\\s+[^>]*name=["']omd:${name}["'][^>]*content=["'])([^"']*)(["'])`, 'i');
  if (re.test(html)) return html.replace(re, `$1${value}$3`);
  return html.replace(
    /<\/head>/i,
    `  <meta name="omd:${name}" content="${value}" />\n</head>`,
  );
}

function setField(html, name, value) {
  const re = new RegExp(
    `(<(?:dd|span|p|div)([^>]*\\sdata-omd-field=["']${name}["'][^>]*)>)([\\s\\S]*?)(<\\/(?:dd|span|p|div)>)`,
    'i',
  );
  if (re.test(html)) return html.replace(re, `$1${escapeHtml(value)}$4`);
  return html;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Resolve `.omd/dbs` root for the project.
 * @param {string} cwd
 */
export function resolveDbsRoot(cwd) {
  const project = readProject(cwd);
  const rel = project?.paths?.content ?? '.omd/dbs';
  return { relative: rel.replaceAll('\\', '/'), absolute: join(cwd, rel) };
}

/**
 * Plan creation of a local HTML catalog document.
 * @param {{
 *   cwd: string,
 *   kind: string,
 *   title: string,
 *   id?: string,
 *   skillRoot?: string,
 * }} options
 */
export function planCreateDocument(options) {
  const title = options.title.trim();
  if (!title) throw new Error('--title is required');

  const skillRoot =
    options.skillRoot ?? join(dirname(fileURLToPath(import.meta.url)), '..');
  const graph = loadLocalHtmlIaGraph(skillRoot);
  const catalog = catalogForKind(graph, options.kind);
  if (!catalog) {
    throw new Error(
      `unsupported kind: ${options.kind}. Expected one of: ${Object.keys(graph.kindToCatalog).join(', ')}`,
    );
  }

  const templateFile = graph.templateFile?.[options.kind];
  if (!templateFile) throw new Error(`no template mapping for kind ${options.kind}`);

  const baseSlug = slugifyTitle(title);
  const prefix = primaryPrefix(catalog.prefix);
  const id = options.id?.trim() || `${prefix}${baseSlug}`;
  if (!idMatchesPrefix(catalog.prefix, id)) {
    throw new Error(
      `${options.kind} id must start with ${Array.isArray(catalog.prefix) ? catalog.prefix.join('|') : catalog.prefix}`,
    );
  }

  const { relative: dbsRel, absolute: dbsAbsolute } = resolveDbsRoot(options.cwd);
  if (!existsSync(dbsAbsolute)) {
    throw new Error(
      `${dbsRel} not found — run adopt --ssot local first (or create .omd/dbs catalogs).`,
    );
  }

  const existing = collectHtmlDocuments(dbsAbsolute, graph);
  if (existing.documents.some((doc) => doc.id === id)) {
    throw new Error(`id ${id} already exists`);
  }

  const relativePath = `${dbsRel}/${catalog.folder}/${id}.html`.replaceAll('\\', '/');
  const absolutePath = join(options.cwd, relativePath);
  if (existsSync(absolutePath)) {
    throw new Error(`file already exists: ${relativePath}`);
  }

  const template = readHtmlTemplate(skillRoot, options.kind, templateFile);
  const content = renderHtmlDocument(template, {
    kind: options.kind,
    id,
    title,
    catalog,
  });

  const operations = [
    op(relativePath, 'create', `create ${options.kind} ${id}`, content),
  ];

  // Refresh catalog indexes; include the staged row in its own catalog listing.
  const existingDocs = collectHtmlDocuments(dbsAbsolute, graph).documents;
  for (const cat of graph.catalogs) {
    const rows = existingDocs
      .filter((d) => d.catalogId === cat.id)
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        status: doc.status || doc.stage || doc.fields?.status || doc.fields?.stage,
        summary: doc.fields?.summary,
        href: `./${doc.id}.html`,
      }));
    if (cat.id === catalog.id) {
      rows.push({
        id,
        title,
        status: undefined,
        summary: undefined,
        href: `./${id}.html`,
      });
    }
    const indexContent = renderCatalogIndexHtml({
      label: cat.label,
      folder: cat.folder,
      kind: cat.kind,
      rows,
    });
    operations.push(
      op(
        `${dbsRel}/${cat.folder}/index.html`,
        'update',
        `refresh ${cat.folder} catalog index`,
        indexContent,
      ),
    );
  }

  const validationProblems = validateAfterCreate(dbsAbsolute, graph, {
    folder: catalog.folder,
    filename: `${id}.html`,
    content,
  });

  return {
    kind: options.kind,
    id,
    slug: id,
    relativePath,
    operations,
    validationProblems,
  };
}

/**
 * @param {string} dbsAbsolute
 * @param {ReturnType<typeof loadLocalHtmlIaGraph>} graph
 * @param {{ folder: string, filename: string, content: string }} staged
 */
function validateAfterCreate(dbsAbsolute, graph, staged) {
  const root = mkdtempSync(join(tmpdir(), 'oh-my-docs-html-new-'));
  try {
    // Mirror existing catalogs lightly: copy only html files via re-read collect path
    // Simpler: write staged into temp tree + copy siblings by reading from real dbs.
    const { documents } = collectHtmlDocuments(dbsAbsolute, graph);
    for (const doc of documents) {
      const dest = join(root, doc.file);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(join(dbsAbsolute, doc.file), 'utf8'));
    }
    const stagedPath = join(root, staged.folder, staged.filename);
    mkdirSync(dirname(stagedPath), { recursive: true });
    writeFileSync(stagedPath, staged.content);
    // ensure empty catalog dirs exist for folder classification
    for (const catalog of graph.catalogs) {
      mkdirSync(join(root, catalog.folder), { recursive: true });
    }
    return validateHtmlPlanning(root, graph);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export { loadLocalHtmlIaGraph, catalogForKind };
