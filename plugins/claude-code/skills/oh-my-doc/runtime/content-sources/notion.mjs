import { createHash } from 'node:crypto';

import { digest, stableStringify } from '../omd-contract.mjs';
import { loadNotionReferences } from './load-references.mjs';
import { parseNotionRoot } from './notion-root.mjs';

/**
 * @typedef {{
 *   id: string,
 *   key: string,
 *   op: 'ensure_page' | 'ensure_database' | 'set_inline' | 'move_under_sources' | 'write_page_body' | 'ensure_relation',
 *   dependsOn: string[],
 *   expectedParentKey: string,
 *   title?: string,
 *   schema?: string,
 *   inline?: boolean,
 *   desiredDigest: string,
 * }} ManifestOperation
 */

/**
 * @param {{
 *   skillRoot: string,
 *   notionRoot: string,
 *   mappings?: Record<string, { id: string, type: string }>,
 *   pendingOperationIds?: string[],
 * }} options
 */
export function planProvision(options) {
  const root = parseNotionRoot(options.notionRoot);
  const refs = loadNotionReferences(options.skillRoot);
  const mappings = options.mappings ?? {};
  const operations = [];

  // 1) Create pages and databases in dependency order (parents before children).
  for (const object of refs.iaGraph.objects) {
    const dependsOn =
      object.parent === 'root' ? [] : [`ensure:${object.parent}`];
    if (object.kind === 'page') {
      const payload = {
        key: object.key,
        kind: 'page',
        title: object.title,
        parent: object.parent,
        inlineDatabase: object.inlineDatabase ?? null,
      };
      operations.push({
        id: `ensure:${object.key}`,
        key: object.key,
        op: 'ensure_page',
        dependsOn,
        expectedParentKey: object.parent,
        title: object.title,
        desiredDigest: digest(stableStringify(payload)),
        payload,
      });
    } else if (object.kind === 'database') {
      const schema = refs.catalogSchemas.schemas[object.schema];
      if (!schema) {
        throw new Error(`missing catalog schema: ${object.schema}`);
      }
      const payload = {
        key: object.key,
        kind: 'database',
        title: object.title,
        parent: object.parent,
        inline: object.inline === true,
        schema: object.schema,
        properties: schema.properties,
      };
      operations.push({
        id: `ensure:${object.key}`,
        key: object.key,
        op: 'ensure_database',
        dependsOn: [`ensure:${object.parent}`],
        expectedParentKey: object.parent,
        title: object.title,
        schema: object.schema,
        inline: object.inline === true,
        desiredDigest: digest(stableStringify(payload)),
        payload,
      });
      if (object.inline === true) {
        operations.push({
          id: `inline:${object.key}`,
          key: object.key,
          op: 'set_inline',
          dependsOn: [`ensure:${object.key}`],
          expectedParentKey: object.parent,
          inline: true,
          desiredDigest: digest(`inline:${object.key}`),
          payload: { key: object.key, inline: true },
        });
      }
    }
  }

  // 2) Move managed children under sources toggle (logical op for agent/MCP).
  operations.push({
    id: 'sources:toggle',
    key: refs.iaGraph.sourcesToggle.key,
    op: 'move_under_sources',
    dependsOn: refs.iaGraph.objects
      .filter((o) => o.parent === 'root' && o.key !== 'pages.home')
      .map((o) => `ensure:${o.key}`),
    expectedParentKey: 'root',
    title: refs.iaGraph.sourcesToggle.title,
    desiredDigest: digest(stableStringify(refs.iaGraph.sourcesToggle)),
    payload: refs.iaGraph.sourcesToggle,
  });

  // 3) Relations after both endpoints exist.
  for (const [schemaName, schema] of Object.entries(refs.catalogSchemas.schemas)) {
    for (const relation of schema.relations ?? []) {
      const fromDb = refs.iaGraph.objects.find(
        (o) => o.kind === 'database' && o.schema === schemaName,
      );
      if (!fromDb) continue;
      const targets = relation.toDatabaseKey
        ? [relation.toDatabaseKey]
        : (relation.toDatabaseKeys ?? []);
      for (const toKey of targets) {
        const payload = {
          from: fromDb.key,
          property: relation.from,
          to: toKey,
        };
        operations.push({
          id: `relation:${fromDb.key}:${relation.from}:${toKey}`,
          key: fromDb.key,
          op: 'ensure_relation',
          dependsOn: [`ensure:${fromDb.key}`, `ensure:${toKey}`],
          expectedParentKey: fromDb.parent,
          desiredDigest: digest(stableStringify(payload)),
          payload,
        });
      }
    }
  }

  // 4) Write page bodies with placeholders (substitution happens after MCP IDs exist).
  for (const object of refs.iaGraph.objects.filter((o) => o.kind === 'page')) {
    const payload = {
      key: object.key,
      template: 'shared-sidebar',
      activeSection: resolveActiveSection(object.key, refs.iaGraph.nav),
    };
    operations.push({
      id: `body:${object.key}`,
      key: object.key,
      op: 'write_page_body',
      dependsOn: [`ensure:${object.key}`, ...refs.iaGraph.nav.topLevel.map((k) => `ensure:${k}`)],
      expectedParentKey: object.parent,
      desiredDigest: digest(stableStringify(payload)),
      payload,
    });
  }

  const pending = new Set(options.pendingOperationIds ?? []);
  const planned = operations.map((op) => {
    const mapped = mappings[op.key];
    let action = 'create';
    if (mapped) {
      action = pending.has(op.id) ? 'retry' : 'skip_or_update';
    } else if (pending.has(op.id)) {
      action = 'retry';
    }
    return { ...op, action, mappedId: mapped?.id ?? null };
  });

  const manifest = {
    schemaVersion: '1.0',
    provider: 'notion',
    root,
    references: {
      iaGraph: 'references/notion-ia-graph.json',
      catalogSchemas: 'references/notion-catalog-schemas.json',
      sidebar: 'references/notion-sidebar.md',
      pageTemplates: 'references/notion-page-templates.md',
      manualChecklist: 'references/notion-manual-checklist.md',
    },
    nav: refs.iaGraph.nav,
    operations: planned,
    manualChecklist: ['page-full-width'],
  };

  return {
    ok: true,
    provider: 'notion',
    manifest,
    manifestDigest: digest(stableStringify(manifest)),
    blockers: [],
    refs,
  };
}

/**
 * @param {string} pageKey
 * @param {{ nested: Record<string, string[]> }} nav
 */
function resolveActiveSection(pageKey, nav) {
  if (nav.nested[pageKey]) return pageKey;
  for (const [parent, children] of Object.entries(nav.nested)) {
    if (children.includes(pageKey)) return parent;
  }
  return pageKey;
}

/**
 * Validate a provider snapshot against the planned manifest.
 * @param {{
 *   manifest: ReturnType<typeof planProvision>['manifest'],
 *   snapshot: {
 *     rootPageId: string,
 *     objects?: Record<string, { id: string, type: string, parentId?: string }>,
 *     inline?: Record<string, boolean>,
 *   },
 * }} options
 */
export function validateSnapshot(options) {
  const problems = [];
  const { manifest, snapshot } = options;
  if (snapshot.rootPageId !== manifest.root.rootPageId) {
    problems.push({
      code: 'root_boundary_violation',
      message: 'snapshot root does not match configured root',
    });
  }
  const objects = snapshot.objects ?? {};
  for (const op of manifest.operations) {
    if (op.op !== 'ensure_page' && op.op !== 'ensure_database') continue;
    const found = objects[op.key];
    if (!found) {
      problems.push({ code: 'partial_apply', message: `missing mapped object ${op.key}` });
      continue;
    }
    const expectedType = op.op === 'ensure_page' ? 'page' : 'database';
    if (found.type !== expectedType) {
      problems.push({
        code: 'mapping_conflict',
        message: `${op.key} mapped as ${found.type}, expected ${expectedType}`,
      });
    }
  }
  for (const op of manifest.operations.filter((o) => o.op === 'set_inline')) {
    if (snapshot.inline && snapshot.inline[op.key] !== true) {
      problems.push({ code: 'schema_drift', message: `${op.key} is not inline` });
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Merge MCP/agent results into Notion state mappings.
 * @param {{
 *   previous?: Record<string, unknown>,
 *   manifest: ReturnType<typeof planProvision>['manifest'],
 *   manifestDigest: string,
 *   results: Array<{ operationId: string, status: 'completed' | 'skipped' | 'failed', object?: { key: string, id: string, type: string } }>,
 * }} options
 */
export function recordResult(options) {
  const previous = options.previous ?? {};
  const mappings = { ...(previous.mappings ?? {}) };
  const completed = [];
  const pending = [];
  for (const result of options.results) {
    if (result.status === 'completed' || result.status === 'skipped') {
      completed.push(result.operationId);
      if (result.object) {
        mappings[result.object.key] = {
          id: result.object.id,
          type: result.object.type,
        };
      }
    } else {
      pending.push(result.operationId);
    }
  }
  const allIds = new Set(options.manifest.operations.map((op) => op.id));
  for (const id of allIds) {
    if (!completed.includes(id) && !pending.includes(id)) pending.push(id);
  }
  return {
    notion: {
      schemaVersion: '1.0',
      schemaDigest: createHash('sha256')
        .update(options.manifestDigest, 'utf8')
        .digest('hex'),
      lastObservedAt: new Date().toISOString(),
      lastManifestDigest: options.manifestDigest,
      mappings,
      pendingOperationIds: pending,
      completedOperationIds: completed,
    },
  };
}

/**
 * Capability blockers before any Notion write.
 * @param {{ mcpAvailable?: boolean, authenticated?: boolean, rootAccessible?: boolean }} flags
 */
export function capabilityBlockers(flags = {}) {
  /** @type {Array<{ code: string, message: string }>} */
  const blockers = [];
  if (flags.mcpAvailable === false) {
    blockers.push({
      code: 'capability_missing',
      message: 'Notion MCP is not available in this host',
    });
  }
  if (flags.authenticated === false) {
    blockers.push({
      code: 'authentication_required',
      message: 'Notion MCP authentication is required before writes',
    });
  }
  if (flags.rootAccessible === false) {
    blockers.push({
      code: 'root_inaccessible',
      message: 'Configured Notion root is not accessible',
    });
  }
  return blockers;
}

/**
 * Plan a catalog row create for Notion SSOT (manifest only).
 * @param {{
 *   skillRoot: string,
 *   kind: string,
 *   title: string,
 *   id: string,
 *   mappings?: Record<string, { id: string, type: string }>,
 * }} options
 */
export function planCreateDocument(options) {
  const kindToDb = {
    prd: 'dbs.prds',
    story: 'dbs.stories',
    plan: 'dbs.plans',
    adr: 'dbs.adrs',
    spec: 'dbs.data-model',
  };
  const dbKey = kindToDb[options.kind];
  if (!dbKey) {
    throw new Error(`unsupported Notion document kind: ${options.kind}`);
  }
  const mapped = options.mappings?.[dbKey];
  const payload = {
    databaseKey: dbKey,
    title: options.title,
    omdId: options.id,
  };
  return {
    ok: true,
    provider: 'notion',
    requiresMappedDatabase: !mapped,
    operation: {
      id: `row:${dbKey}:${options.id}`,
      key: dbKey,
      op: 'ensure_row',
      dependsOn: mapped ? [] : [`ensure:${dbKey}`],
      expectedParentKey: dbKey,
      desiredDigest: digest(stableStringify(payload)),
      payload,
      mappedDatabaseId: mapped?.id ?? null,
    },
  };
}
