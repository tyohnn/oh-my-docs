import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { planCatalogIndexRebuild } from './catalog-index.mjs';
import { loadLocalHtmlIaGraph } from './html-document.mjs';
import { LOCAL_HTML_ASSETS_PATH, LOCAL_HTML_CONTENT_PATH } from './omd-contract.mjs';
import { readTextIfExists } from './fs-ops.mjs';

/**
 * Scaffold `.omd/dbs` catalogs + shared CSS for local HTML SSOT.
 * @param {string} root project root
 * @param {string} skillRoot
 * @param {string} templateRoot
 * @param {boolean} force
 */
export function planLocalHtmlScaffold(root, skillRoot, templateRoot, force = false) {
  const graph = loadLocalHtmlIaGraph(skillRoot);
  const omdTemplate = join(templateRoot, 'omd');
  /** @type {Array<{ path: string, kind: string, reason: string, content?: string, conflict?: boolean }>} */
  const operations = [];

  const cssSource = join(omdTemplate, 'assets/omd-doc.css');
  if (existsSync(cssSource)) {
    operations.push(
      decide(
        root,
        `${LOCAL_HTML_ASSETS_PATH}/omd-doc.css`,
        readFileSync(cssSource, 'utf8'),
        'install local HTML stylesheet',
        force,
      ),
    );
  }

  const homeSource = join(omdTemplate, 'dbs/_home.index.html');
  if (existsSync(homeSource)) {
    operations.push(
      decide(
        root,
        `${LOCAL_HTML_CONTENT_PATH}/index.html`,
        readFileSync(homeSource, 'utf8'),
        'install local HTML catalog home',
        force,
      ),
    );
  }

  for (const catalog of graph.catalogs) {
    const keep = `${LOCAL_HTML_CONTENT_PATH}/${catalog.folder}/.gitkeep`;
    operations.push(
      decide(root, keep, '', `ensure catalog folder ${catalog.folder}`, force),
    );
  }

  // Generated catalog listings (empty or filled from existing rows).
  operations.push(...planCatalogIndexRebuild(root, skillRoot, { force }));

  return operations;
}

/**
 * @param {string} root
 * @param {string} relativePath
 * @param {string} content
 * @param {string} reason
 * @param {boolean} force
 */
function decide(root, relativePath, content, reason, force) {
  const existing = readTextIfExists(join(root, relativePath));
  if (existing === null) {
    return { path: relativePath, kind: 'create', reason, content };
  }
  if (existing === content) {
    return { path: relativePath, kind: 'skip', reason: 'already up to date', content };
  }
  if (force) {
    return { path: relativePath, kind: 'update', reason: `${reason} (forced)`, content };
  }
  // Keep existing catalog files / customized home; only .gitkeep empty is soft.
  if (relativePath.endsWith('.gitkeep') && existing === '') {
    return { path: relativePath, kind: 'skip', reason: 'catalog folder present', content };
  }
  return {
    path: relativePath,
    kind: 'skip',
    reason: 'exists with different content',
    content,
    conflict: true,
  };
}
