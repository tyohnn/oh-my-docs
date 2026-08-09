import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { detectProject, listFilesRecursive, relativePosix } from './detect.mjs';
import { applyFileOperations } from './fs-ops.mjs';
import { inspectProject } from './inspect.mjs';
import {
  DEFAULT_AGENTS_MARKER_BODY,
  DEFAULT_CLAUDE_MARKER_BODY,
  mergeMarkerBlock,
} from './markers.mjs';
import {
  acquireLock,
  createDefaultProject,
  createDefaultState,
  digest,
  releaseLock,
  resolveSafePath,
  stableStringify,
  writeOmdContract,
} from './omd-contract.mjs';
import { loadHandbookIaGraph, planMetaSkeletonOperations } from './ia-graph.mjs';
import { planInit } from './plan-init.mjs';
import { planSetup } from './plan-setup.mjs';
import { readTextIfExists } from './fs-ops.mjs';
import { planLocalHtmlScaffold } from './local-html-scaffold.mjs';
import { normalizeContentSource } from './omd-contract.mjs';

/**
 * Adopt Oh My Docs into a project (greenfield scaffold or brownfield import).
 * @param {{
 *   cwd: string,
 *   templateRoot: string,
 *   skillRoot: string,
 *   schemasDir: string,
 *   uiPath?: string,
 *   packageManager?: string,
 *   dryRun?: boolean,
 *   force?: boolean,
 *   contentSource?: { ssot: 'local' | 'notion', notion?: { rootPageId: string, rootPageUrl: string, schemaVersion?: string } },
 * }} options
 */
export function adoptProject(options) {
  const inspection = inspectProject({ cwd: options.cwd, uiPath: options.uiPath });
  const project = inspection.project;
  const mode = inspection.mode;

  const initPlan =
    mode === 'greenfield' || !project.docsPath
      ? planInit(
          {
            cwd: project.root,
            force: options.force,
            uiPath: options.uiPath ?? 'packages/docs-ui',
            ...(options.packageManager ? { packageManager: options.packageManager } : {}),
          },
          options.templateRoot,
        )
      : { project, operations: [], conflicts: [] };

  // Ensure UI vocabulary snapshot exists from the skill template.
  const uiOps = planUiSnapshot(project.root, options.templateRoot, options.uiPath ?? 'packages/docs-ui', options.force === true);

  const setupPlan = planSetup({
    cwd: project.root,
    force: options.force,
    agent: 'all',
    scope: 'project',
    skillRoot: options.skillRoot,
  });

  const htmlOps = planLocalHtmlScaffold(
    project.root,
    options.skillRoot,
    options.templateRoot,
    options.force === true,
  );

  const operations = [...initPlan.operations, ...uiOps, ...setupPlan.operations, ...htmlOps];
  const conflicts = operations.filter((op) => op.conflict);

  const contract = createDefaultProject(project.root, {
    mode,
    docsPath: project.docsPath ?? 'docs',
    uiPath: options.uiPath ?? project.uiPath ?? 'packages/docs-ui',
    ...(options.contentSource ? { contentSource: options.contentSource } : {}),
  });

  if (mode === 'brownfield' && inspection.documents.length > 0) {
    contract.ownership.importedOwned = inspection.documents.map((doc) => doc.path);
  }

  // Fumadocs shell meta skeletons (optional viewer) — not the local HTML SSOT.
  if (mode === 'greenfield' || options.force) {
    const graph = loadHandbookIaGraph(options.skillRoot);
    const docsContent = `${contract.paths.docs}/content/docs`;
    const metaOps = planMetaSkeletonOperations(docsContent, graph, {
      readExisting: (rel) => readTextIfExists(join(project.root, rel)),
    });
    operations.push(...metaOps);
  }

  const fileDigests = {};
  for (const op of operations) {
    if (op.content !== undefined && !op.conflict) {
      fileDigests[op.path] = {
        ownership: op.path.startsWith('.omd/') ? 'omd-generated' : 'omd-managed',
        digest: digest(op.content),
      };
    }
  }

  const state = createDefaultState(contract, { files: fileDigests });

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      mode,
      inspection,
      operations,
      conflicts,
      contract,
      state,
      applied: null,
    };
  }

  acquireLock(project.root);
  try {
    const applied = applyFileOperations(project.root, operations, {
      dryRun: false,
      force: options.force,
    });
    writeOmdContract(project.root, contract, state, options.schemasDir);
    return {
      ok: true,
      dryRun: false,
      mode,
      inspection,
      operations,
      conflicts,
      contract,
      state,
      applied,
    };
  } finally {
    releaseLock(project.root);
  }
}

/**
 * Copy UI vocabulary from the skill template into the consumer project.
 * @param {string} root
 * @param {string} templateRoot
 * @param {string} uiPath
 * @param {boolean} force
 */
function planUiSnapshot(root, templateRoot, uiPath, force) {
  const sourceUi = join(templateRoot, 'packages/docs-ui');
  if (!existsSync(sourceUi)) return [];
  const operations = [];
  for (const absolute of listFilesRecursive(sourceUi)) {
    const rel = relativePosix(sourceUi, absolute);
    const targetRel = `${uiPath.replace(/\\/g, '/')}/${rel}`;
    resolveSafePath(root, targetRel);
    const content = readFileSync(absolute, 'utf8');
    const existing = readTextIfExists(join(root, targetRel));
    if (existing === null) {
      operations.push({ path: targetRel, kind: 'create', reason: 'install UI vocabulary from skill template', content });
    } else if (existing === content) {
      operations.push({ path: targetRel, kind: 'skip', reason: 'UI snapshot up to date', content });
    } else if (force) {
      operations.push({ path: targetRel, kind: 'update', reason: 'refresh UI vocabulary from skill template', content });
    } else {
      operations.push({
        path: targetRel,
        kind: 'skip',
        reason: 'UI file differs from skill template snapshot',
        content,
        conflict: true,
      });
    }
  }
  return operations;
}

/**
 * Sync managed local HTML scaffold + markers from .omd/project.json.
 * @param {{ cwd: string, force?: boolean, dryRun?: boolean, schemasDir: string, skillRoot?: string, templateRoot?: string }} options
 */
export function syncProject(options) {
  const project = detectProject(options.cwd);
  const contract = createDefaultProject(project.root, {
    mode: existsSync(join(project.root, '.omd/project.json')) ? 'brownfield' : 'greenfield',
    docsPath: project.docsPath ?? 'docs',
    uiPath: project.uiPath ?? 'packages/docs-ui',
  });

  // Prefer existing contract when present.
  const existingPath = join(project.root, '.omd/project.json');
  const contractData = existsSync(existingPath)
    ? JSON.parse(readFileSync(existingPath, 'utf8'))
    : contract;

  // Refresh structure metadata stamp when missing.
  if (!contractData.informationArchitecture?.graphDigest) {
    const fresh = createDefaultProject(project.root, {
      mode: contractData.mode,
      docsPath: contractData.paths?.docs,
      uiPath: contractData.paths?.ui,
      contentSource: contractData.contentSource,
    });
    contractData.informationArchitecture = fresh.informationArchitecture;
  }

  // Ensure paths.content points at local HTML root for local SSOT.
  const ssot = normalizeContentSource(contractData).ssot;
  if (ssot === 'local') {
    contractData.paths = {
      ...contractData.paths,
      content: contractData.paths?.content?.includes('.omd/dbs')
        ? contractData.paths.content
        : '.omd/dbs',
      assets: contractData.paths?.assets ?? '.omd/assets',
    };
  }

  const templateRoot =
    options.templateRoot ?? join(options.skillRoot ?? '', 'templates/default');
  const htmlOps =
    ssot === 'local' && options.skillRoot
      ? planLocalHtmlScaffold(project.root, options.skillRoot, templateRoot, options.force === true)
      : [];

  const operations = [...htmlOps];

  // Optional Fumadocs shell meta (viewer) — never treat as SSOT write target.
  if (ssot === 'local' && contractData.paths?.docs) {
    const graph = loadHandbookIaGraph(options.skillRoot);
    const docsContent = `${contractData.paths.docs}/content/docs`;
    const metaOps = planMetaSkeletonOperations(docsContent, graph, {
      readExisting: (rel) => readTextIfExists(join(project.root, rel)),
    });
    operations.push(...metaOps);
  }

  // Refresh markers (managed).
  for (const [file, body] of [
    ['AGENTS.md', DEFAULT_AGENTS_MARKER_BODY],
    ['CLAUDE.md', DEFAULT_CLAUDE_MARKER_BODY],
  ]) {
    const existing = readTextIfExists(join(project.root, file));
    const merged = mergeMarkerBlock(existing, body, { force: true });
    operations.push({
      path: file,
      kind: merged.kind,
      reason: 'sync managed marker',
      content: merged.content,
    });
  }

  if (options.dryRun) {
    return { ok: true, dryRun: true, operations, contract: contractData, applied: null };
  }

  acquireLock(project.root);
  try {
    const applied = applyFileOperations(project.root, operations, {
      dryRun: false,
      force: options.force ?? true,
    });
    const state = createDefaultState(contractData, {
      files: Object.fromEntries(
        operations
          .filter((op) => op.content)
          .map((op) => [op.path, { ownership: 'omd-managed', digest: digest(op.content) }]),
      ),
    });
    writeOmdContract(project.root, contractData, state, options.schemasDir);
    return { ok: true, dryRun: false, operations, contract: contractData, applied };
  } finally {
    releaseLock(project.root);
  }
}
