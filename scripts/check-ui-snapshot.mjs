/**
 * Ensure skill template UI snapshot matches packages/docs-ui (dogfood source).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'packages/docs-ui/src');
const snapshot = join(root, 'skills/oh-my-doc/templates/default/packages/docs-ui/src');

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return [path];
  });
}

function relativePosix(from, to) {
  return relative(from, to).split('\\').join('/');
}

const problems = [];
const leftFiles = listFiles(source);
const rightFiles = listFiles(snapshot);
const leftRel = new Set(leftFiles.map((f) => relativePosix(source, f)));
const rightRel = new Set(rightFiles.map((f) => relativePosix(snapshot, f)));

for (const rel of leftRel) {
  if (!rightRel.has(rel)) {
    problems.push(`missing in skill template UI snapshot: ${rel}`);
    continue;
  }
  const a = readFileSync(join(source, rel));
  const b = readFileSync(join(snapshot, rel));
  if (!a.equals(b)) problems.push(`drift in skill template UI snapshot: ${rel}`);
}
for (const rel of rightRel) {
  if (!leftRel.has(rel)) problems.push(`extra in skill template UI snapshot: ${rel}`);
}

if (problems.length > 0) {
  console.error('UI snapshot check failed:\n');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('packages/docs-ui matches skills/oh-my-doc/templates/default/packages/docs-ui.');
