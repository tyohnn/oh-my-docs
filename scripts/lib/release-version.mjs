/**
 * Shared release-version checks for skill + agent plugin manifests.
 * Public npm packages are no longer part of the release surface.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PLUGIN_MANIFEST_RELATIVE_PATHS = Object.freeze([
  'plugins/claude-code/.claude-plugin/plugin.json',
  'plugins/codex/.codex-plugin/plugin.json',
  'plugins/cursor/.cursor-plugin/plugin.json',
]);

/** Cursor marketplace descriptors that carry an explicit version field. */
export const MARKETPLACE_VERSION_PATHS = Object.freeze([
  '.cursor-plugin/marketplace.json',
  'marketplaces/cursor/marketplace.json',
]);

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/**
 * @param {string} tag
 * @returns {string}
 */
export function versionFromTag(tag) {
  const want = tag.replace(/^v/, '');
  if (!SEMVER.test(want)) {
    throw new Error(`tag ${tag} is not a semver version`);
  }
  return want;
}

/**
 * @param {string} root
 * @returns {string}
 */
export function readSkillVersion(root) {
  const versionFile = join(root, 'skills/oh-my-doc/VERSION');
  if (existsSync(versionFile)) return readFileSync(versionFile, 'utf8').trim();
  const contract = join(root, 'skills/oh-my-doc/runtime/omd-contract.mjs');
  if (!existsSync(contract)) throw new Error('skills/oh-my-doc VERSION/contract missing');
  const match = /export const SKILL_VERSION = '([^']+)'/.exec(readFileSync(contract, 'utf8'));
  if (!match) throw new Error('SKILL_VERSION not found');
  return match[1];
}

/**
 * @param {string} root
 * @returns {{ name: string, version: string, path: string }[]}
 */
export function collectPublicPackages(root) {
  const pkgsDir = join(root, 'packages');
  if (!existsSync(pkgsDir)) return [];
  /** @type {{ name: string, version: string, path: string }[]} */
  const found = [];
  for (const name of readdirSync(pkgsDir)) {
    const path = join(pkgsDir, name, 'package.json');
    if (!existsSync(path)) continue;
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    if (pkg.private) continue;
    found.push({ name: pkg.name, version: pkg.version, path });
  }
  return found;
}

/**
 * @param {string} root
 * @returns {{ name: string, version: string, path: string }[]}
 */
export function collectPluginManifests(root) {
  return PLUGIN_MANIFEST_RELATIVE_PATHS.map((rel) => {
    const path = join(root, rel);
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    return { name: rel, version: pkg.version, path };
  });
}

/**
 * @param {string} root
 * @returns {{ name: string, version: string, path: string }[]}
 */
export function collectMarketplaceVersions(root) {
  /** @type {{ name: string, version: string, path: string }[]} */
  const found = [];
  for (const rel of MARKETPLACE_VERSION_PATHS) {
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    const metaVersion = doc?.metadata?.version;
    if (typeof metaVersion === 'string') {
      found.push({ name: `${rel}#metadata.version`, version: metaVersion, path });
    }
    const pluginVersion = doc?.plugins?.[0]?.version;
    if (typeof pluginVersion === 'string') {
      found.push({ name: `${rel}#plugins[0].version`, version: pluginVersion, path });
    }
  }
  return found;
}

/**
 * @param {string} root
 * @param {string} [wantVersion]
 */
export function checkReleaseVersions(root, wantVersion) {
  const skillVersion = readSkillVersion(root);
  const packages = collectPublicPackages(root);
  const manifests = collectPluginManifests(root);
  const marketplaces = collectMarketplaceVersions(root);
  const checked = ['skills/oh-my-doc', ...manifests.map((m) => m.name), ...marketplaces.map((m) => m.name)];
  /** @type {string[]} */
  const problems = [];

  const version = wantVersion ?? skillVersion;
  if (!SEMVER.test(version)) problems.push(`version ${version} is not a semver version`);
  if (skillVersion !== version) {
    problems.push(`skills/oh-my-doc: ${skillVersion}, expected ${version}`);
  }
  for (const pkg of packages) {
    problems.push(`public npm package still present: ${pkg.name}`);
  }
  for (const manifest of manifests) {
    if (manifest.version !== version) {
      problems.push(`${manifest.name}: says ${manifest.version}, expected ${version}`);
    }
  }
  for (const marketplace of marketplaces) {
    if (marketplace.version !== version) {
      problems.push(`${marketplace.name}: says ${marketplace.version}, expected ${version}`);
    }
  }

  if (problems.length > 0) return { ok: false, version, problems, checked };
  return { ok: true, version, checked };
}

/**
 * @param {{
 *   version?: string,
 *   manifestVersions?: Record<string, string>,
 *   includePublicPackage?: boolean,
 * }} [options]
 */
export function createVersionFixture(options = {}) {
  const version = options.version ?? '0.1.0';
  const root = mkdtempSync(join(tmpdir(), 'omdocs-release-version-'));
  mkdirSync(join(root, 'skills/oh-my-doc/runtime'), { recursive: true });
  writeFileSync(join(root, 'skills/oh-my-doc/VERSION'), `${version}\n`);
  writeFileSync(
    join(root, 'skills/oh-my-doc/runtime/omd-contract.mjs'),
    `export const SKILL_VERSION = '${version}';\n`,
  );

  if (options.includePublicPackage) {
    mkdirSync(join(root, 'packages/cli'), { recursive: true });
    writeFileSync(
      join(root, 'packages/cli', 'package.json'),
      JSON.stringify({ name: 'oh-my-docs', version }, null, 2),
    );
  }

  mkdirSync(join(root, 'packages/docs-ui'), { recursive: true });
  writeFileSync(
    join(root, 'packages/docs-ui', 'package.json'),
    JSON.stringify({ name: '@oh-my-docs/ui', version, private: true }, null, 2),
  );

  for (const rel of PLUGIN_MANIFEST_RELATIVE_PATHS) {
    const manifestVersion = options.manifestVersions?.[rel] ?? version;
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), JSON.stringify({ name: 'oh-my-docs', version: manifestVersion }, null, 2));
  }

  return root;
}

/**
 * @param {string} root
 */
export function removeFixture(root) {
  rmSync(root, { recursive: true, force: true });
}
