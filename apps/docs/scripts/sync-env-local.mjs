#!/usr/bin/env node
/**
 * Copy keys named in `.env.example` from process.env into `.env.local`.
 *
 * Intended for Cursor Cloud / agent environments where runtime secrets are
 * injected as environment variables, but Next.js loads `apps/docs/.env.local`.
 *
 *   node scripts/sync-env-local.mjs
 *   node scripts/sync-env-local.mjs --dry-run
 *   node scripts/sync-env-local.mjs --force
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const defaultExamplePath = join(docsRoot, '.env.example');
const defaultLocalPath = join(docsRoot, '.env.local');

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * @param {string} content
 * @returns {string[]}
 */
export function parseEnvKeys(content) {
  const keys = [];
  const seen = new Set();
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!KEY_RE.test(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const entries = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!KEY_RE.test(key)) continue;
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

/**
 * @param {string} value
 */
export function serializeEnvValue(value) {
  if (/[\s#"'$`\\]/.test(value) || value.includes('\n')) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * @param {Record<string, string>} entries
 */
export function serializeEnvFile(entries) {
  return `${Object.entries(entries)
    .map(([key, value]) => `${key}=${serializeEnvValue(value)}`)
    .join('\n')}\n`;
}

/**
 * @param {{
 *   keys: string[];
 *   env: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   existing?: Record<string, string>;
 *   force?: boolean;
 * }} options
 */
export function planEnvLocalSync({ keys, env, existing = {}, force = false }) {
  /** @type {Record<string, string>} */
  const next = { ...existing };
  /** @type {string[]} */
  const written = [];
  /** @type {string[]} */
  const skipped = [];
  /** @type {string[]} */
  const missing = [];

  for (const key of keys) {
    const value = env[key];
    if (value === undefined || value === '') {
      missing.push(key);
      continue;
    }
    if (!force && existing[key] !== undefined && existing[key] !== '') {
      skipped.push(key);
      continue;
    }
    next[key] = value;
    written.push(key);
  }

  return { next, written, skipped, missing };
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const flags = argv.filter((arg) => arg !== '--');
  return {
    dryRun: flags.includes('--dry-run'),
    force: flags.includes('--force'),
  };
}

/**
 * @param {{
 *   examplePath?: string;
 *   localPath?: string;
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   argv?: string[];
 *   log?: (line: string) => void;
 *   writeFile?: (path: string, content: string) => void;
 * }} [options]
 */
export function syncEnvLocal(options = {}) {
  const examplePath = options.examplePath ?? defaultExamplePath;
  const localPath = options.localPath ?? defaultLocalPath;
  const env = options.env ?? process.env;
  const { dryRun, force } = parseArgs(options.argv ?? process.argv.slice(2));
  const log = options.log ?? ((line) => console.error(line));
  const writeFile = options.writeFile ?? writeFileSync;

  if (!existsSync(examplePath)) {
    throw new Error(`.env.example not found at ${examplePath}`);
  }

  const keys = parseEnvKeys(readFileSync(examplePath, 'utf8'));
  const existing = existsSync(localPath) ? parseEnvFile(readFileSync(localPath, 'utf8')) : {};
  const { next, written, skipped, missing } = planEnvLocalSync({
    keys,
    env,
    existing,
    force,
  });

  log(`[sync-env-local] example keys: ${keys.length}`);
  if (written.length) log(`[sync-env-local] write: ${written.join(', ')}`);
  if (skipped.length) log(`[sync-env-local] keep existing: ${skipped.join(', ')}`);
  if (missing.length) log(`[sync-env-local] missing in env: ${missing.join(', ')}`);

  const content = serializeEnvFile(next);
  if (dryRun) {
    log(`[sync-env-local] dry-run; would write ${localPath}`);
    return { localPath, written, skipped, missing, content, dryRun: true };
  }

  writeFile(localPath, content);
  log(`[sync-env-local] wrote ${localPath}`);
  return { localPath, written, skipped, missing, content, dryRun: false };
}

function main() {
  try {
    const result = syncEnvLocal();
    if (
      !result.dryRun &&
      result.written.length === 0 &&
      result.missing.length > 0 &&
      result.skipped.length === 0
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[sync-env-local] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
