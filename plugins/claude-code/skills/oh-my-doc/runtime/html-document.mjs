import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRootFromModule = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} [skillRoot]
 */
export function loadLocalHtmlIaGraph(skillRoot = skillRootFromModule) {
  const path = join(skillRoot, 'references', 'local-html-ia-graph.json');
  if (!existsSync(path)) {
    throw new Error(`missing local HTML IA graph: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {ReturnType<typeof loadLocalHtmlIaGraph>} graph
 * @param {string} kind
 */
export function catalogForKind(graph, kind) {
  const folder = graph.kindToCatalog?.[kind];
  if (!folder) return null;
  return graph.catalogs.find((c) => c.id === folder) ?? null;
}

/**
 * @param {string | string[] | null | undefined} prefix
 * @param {string} id
 */
export function idMatchesPrefix(prefix, id) {
  if (prefix == null) return true;
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  const upper = id.toUpperCase();
  return prefixes.some((p) => upper.startsWith(String(p).toUpperCase()));
}

/**
 * @param {string} html
 * @param {string} [pathHint]
 */
export function parseHtmlDocument(html, pathHint = 'document.html') {
  const kindAttr = matchAttr(html, 'data-omd-kind');
  const idAttr = matchAttr(html, 'data-omd-id');
  const metas = Object.fromEntries(
    [...html.matchAll(/<meta\s+[^>]*name=["']omd:([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi)].map(
      (m) => [m[1], decodeEntities(m[2])],
    ),
  );
  // also support content before name
  for (const m of html.matchAll(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']omd:([^"']+)["'][^>]*>/gi)) {
    if (metas[m[2]] === undefined) metas[m[2]] = decodeEntities(m[1]);
  }

  const kind = kindAttr || metas.kind;
  const id = idAttr || metas.id;
  if (!kind || !id) {
    throw new Error(`${pathHint}: missing data-omd-kind/data-omd-id (or omd:kind / omd:id meta)`);
  }

  /** @type {Record<string, string>} */
  const fields = { ...metas };
  for (const m of html.matchAll(/data-omd-field=["']([^"']+)["'][^>]*>([^<]*)</gi)) {
    const name = m[1];
    const value = decodeEntities(m[2]).trim();
    if (value) fields[name] = value;
  }
  // attribute after text content forms are rare; also catch <… data-omd-field="x">text</…>
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*\sdata-omd-field=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const name = m[3];
    const inner = stripTags(m[4]).trim();
    if (inner) fields[name] = inner;
  }

  /** @type {Record<string, string[]>} */
  const relations = {};
  for (const m of html.matchAll(/data-omd-rel=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:dd|div|span|td|li|p)>/gi)) {
    const name = m[1];
    const ids = [...m[2].matchAll(/<a\b[^>]*>([^<]+)<\/a>/gi)].map((a) => decodeEntities(a[1]).trim()).filter(Boolean);
    relations[name] = ids;
  }

  const title =
    fields.title ||
    matchTagText(html, 'h1') ||
    (metas.title ?? undefined);

  const hasWireframe = /class=["'][^"']*\bomd-wireframe\b/i.test(html);

  return {
    kind,
    id,
    title,
    status: fields.status || metas.status,
    stage: fields.stage || metas.stage,
    changeType: fields.changeType || metas.changeType,
    fields,
    relations,
    hasWireframe,
    raw: html,
  };
}

/**
 * @param {string} dbsRoot absolute path to .omd/dbs
 */
export function walkHtmlDocuments(dbsRoot) {
  if (!existsSync(dbsRoot)) return [];
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dbsRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === 'index.html') continue;
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(join(dbsRoot, entry.name));
      continue;
    }
    if (!entry.isDirectory()) continue;
    const dir = join(dbsRoot, entry.name);
    for (const child of readdirSync(dir, { withFileTypes: true })) {
      if (!child.isFile() || !child.name.endsWith('.html')) continue;
      if (child.name === 'index.html') continue; // catalog listing, not a row
      files.push(join(dir, child.name));
    }
  }
  return files;
}

/**
 * @param {string} dbsRoot
 * @param {ReturnType<typeof loadLocalHtmlIaGraph>} graph
 */
export function collectHtmlDocuments(dbsRoot, graph) {
  /** @type {Array<ReturnType<typeof parseHtmlDocument> & { file: string, slug: string, catalogId: string }>} */
  const documents = [];
  /** @type {string[]} */
  const problems = [];

  const folderToCatalog = Object.fromEntries(graph.catalogs.map((c) => [c.folder, c]));

  for (const absolute of walkHtmlDocuments(dbsRoot)) {
    const rel = absolute.slice(dbsRoot.length).replace(/^[\\/]/, '').replaceAll('\\', '/');
    const parts = rel.split('/');
    if (parts.length !== 2) {
      problems.push(`${rel}: catalog HTML must live at <catalog>/<ID>.html`);
      continue;
    }
    const [folder, filename] = parts;
    const catalog = folderToCatalog[folder];
    if (!catalog) {
      problems.push(`${rel}: unknown catalog folder ${folder}`);
      continue;
    }
    let parsed;
    try {
      parsed = parseHtmlDocument(readFileSync(absolute, 'utf8'), rel);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (parsed.kind !== catalog.kind) {
      problems.push(`${rel}: kind ${parsed.kind} does not match catalog ${catalog.kind}`);
    }
    if (!idMatchesPrefix(catalog.prefix, parsed.id)) {
      problems.push(
        `${rel}: id ${parsed.id} must match prefix ${Array.isArray(catalog.prefix) ? catalog.prefix.join('|') : catalog.prefix}`,
      );
    }
    const expectedName = `${parsed.id}.html`;
    if (filename !== expectedName && catalog.kind !== 'archive') {
      problems.push(`${rel}: filename must be ${expectedName}`);
    }
    if (catalog.wireframe && !parsed.hasWireframe) {
      problems.push(`${rel}: ${catalog.kind} requires at least one section.omd-wireframe`);
    }
    documents.push({
      ...parsed,
      file: rel,
      slug: basename(filename, '.html'),
      catalogId: catalog.id,
      prd: firstRel(parsed.relations, 'prd'),
      stories: parsed.relations.stories ?? [],
      specs: parsed.relations.specs ?? [],
      features: parsed.relations.features ?? [],
      codeAreas: codeAreasFromFields(parsed.fields),
    });
  }

  return { documents, problems };
}

/**
 * @param {Record<string, string>} fields
 */
function codeAreasFromFields(fields) {
  const raw = fields.codeAreas;
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, string[]>} relations
 * @param {string} name
 */
function firstRel(relations, name) {
  const list = relations[name];
  return list && list.length > 0 ? list[0] : undefined;
}

/**
 * @param {string} html
 * @param {string} name
 */
function matchAttr(html, name) {
  const re = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : undefined;
}

/**
 * @param {string} html
 * @param {string} tag
 */
function matchTagText(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = html.match(re);
  return m ? stripTags(m[1]).trim() : undefined;
}

/**
 * @param {string} value
 */
function stripTags(value) {
  return value.replace(/<[^>]+>/g, '');
}

/**
 * @param {string} value
 */
function decodeEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '&')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}
