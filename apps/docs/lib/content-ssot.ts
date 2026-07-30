import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ContentSsot = 'local' | 'notion';

export type ContentSourceContract = {
  ssot: ContentSsot;
  notion?: { rootPageId: string; rootPageUrl: string; schemaVersion: string };
};

function resolveProjectJson(): string | null {
  const candidates = [
    join(process.cwd(), '.omd/project.json'),
    join(process.cwd(), '../.omd/project.json'),
    join(process.cwd(), '../../.omd/project.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * Read handbook SSOT from repo-root `.omd/project.json`.
 * Missing contract ⇒ local.
 */
export function readContentSource(): ContentSourceContract {
  const path = resolveProjectJson();
  if (!path) return { ssot: 'local' };
  const project = JSON.parse(readFileSync(path, 'utf8')) as {
    contentSource?: ContentSourceContract & { ssot?: string };
  };
  const ssot = project.contentSource?.ssot;
  if (ssot === 'notion') {
    return {
      ssot: 'notion',
      ...(project.contentSource?.notion ? { notion: project.contentSource.notion } : {}),
    };
  }
  return { ssot: 'local' };
}
