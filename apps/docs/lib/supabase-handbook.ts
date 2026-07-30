/**
 * Remote handbook loader for `contentSource.ssot: supabase`.
 * Uses PostgREST (no service_role). Publishable URL + anon/publishable key
 * come from environment — never from `.omd` JSON.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  OMD_HANDBOOK_CACHE_TAG,
  OMD_HANDBOOK_REVALIDATE_SECONDS,
  handbookDocCacheTag,
} from './handbook-cache.ts';
import { readContentSource } from './content-ssot.ts';

export type SupabaseHandbookDocument = {
  id: string;
  kind: string;
  ticker: string | null;
  path: string;
  frontmatter: Record<string, unknown>;
  body_mdx: string;
};

export type SupabaseCatalogMeta = {
  catalog_key: string;
  pages: string[];
};

export function handbookPgSchema(handbookId: string | undefined): string {
  if (!handbookId) return 'public';
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(handbookId)) {
    throw new Error(`invalid handbookId: ${handbookId}`);
  }
  return `omd_h_${handbookId.replace(/-/g, '_')}`;
}

export function restCredentials(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and a publishable/anon key (SUPABASE_* or NEXT_PUBLIC_*) are required for remote handbook reads.',
    );
  }
  return { url: url.replace(/\/$/, ''), key };
}

export function restProfileHeaders(pgSchema: string): Record<string, string> {
  if (!pgSchema || pgSchema === 'public') return {};
  return {
    'Accept-Profile': pgSchema,
    'Content-Profile': pgSchema,
  };
}

export function resolveHandbookPgSchema(): string {
  const handbookId = readContentSource().supabase?.handbookId;
  return handbookPgSchema(handbookId);
}

type FetchCacheMode = 'isr' | 'no-store';

async function restGet<T>(
  table: string,
  query = '',
  options: { cacheMode?: FetchCacheMode; tags?: string[] } = {},
): Promise<T[]> {
  const { url, key } = restCredentials();
  const pgSchema = resolveHandbookPgSchema();
  const cacheMode = options.cacheMode ?? 'isr';
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...restProfileHeaders(pgSchema),
    },
    ...(cacheMode === 'no-store'
      ? { cache: 'no-store' as const }
      : {
          next: {
            revalidate: OMD_HANDBOOK_REVALIDATE_SECONDS,
            tags: options.tags ?? [OMD_HANDBOOK_CACHE_TAG],
          },
        }),
  });
  if (!response.ok) {
    throw new Error(`Supabase REST ${table} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T[];
}

export async function fetchSupabaseDocuments(): Promise<SupabaseHandbookDocument[]> {
  return restGet<SupabaseHandbookDocument>(
    'omd_documents',
    '?select=id,kind,ticker,path,frontmatter,body_mdx&order=path.asc',
    { tags: [OMD_HANDBOOK_CACHE_TAG] },
  );
}

export async function fetchSupabaseCatalogMeta(): Promise<SupabaseCatalogMeta[]> {
  return restGet<SupabaseCatalogMeta>(
    'omd_catalog_meta',
    '?select=catalog_key,pages&order=catalog_key.asc',
    { tags: [OMD_HANDBOOK_CACHE_TAG] },
  );
}

export async function fetchSupabaseDocumentByPath(
  path: string,
): Promise<SupabaseHandbookDocument | null> {
  const rows = await restGet<SupabaseHandbookDocument>(
    'omd_documents',
    `?select=id,kind,ticker,path,frontmatter,body_mdx&path=eq.${encodeURIComponent(path)}&limit=1`,
    { tags: [OMD_HANDBOOK_CACHE_TAG, handbookDocCacheTag(path)] },
  );
  return rows[0] ?? null;
}

/**
 * Serialize a document row to MDX with YAML frontmatter for Fumadocs.
 */
export function documentToMdx(doc: SupabaseHandbookDocument): string {
  const fm = { ...doc.frontmatter };
  if (!fm.id) fm.id = doc.id;
  if (doc.ticker && !fm.ticker) fm.ticker = doc.ticker;
  const lines = Object.entries(fm)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      if (typeof value === 'string') {
        const needsQuotes = value.includes(':') || value.includes('\n') || value.includes('"');
        return `${key}: ${needsQuotes ? JSON.stringify(value) : value}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });
  return `---\n${lines.join('\n')}\n---\n\n${String(doc.body_mdx ?? '').trim()}\n`;
}

export function loadHandbookIaGraph(): {
  objects: Array<Record<string, unknown>>;
  nav: Record<string, unknown>;
  fromProject: boolean;
  sections?: Array<Record<string, unknown>>;
  catalogs?: Array<Record<string, unknown>>;
} {
  const candidates = [
    join(process.cwd(), 'skills/oh-my-doc/references/handbook-ia-graph.json'),
    join(process.cwd(), '../../skills/oh-my-doc/references/handbook-ia-graph.json'),
    join(process.cwd(), '../skills/oh-my-doc/references/handbook-ia-graph.json'),
    join(process.cwd(), '.omd/project.json'),
    join(process.cwd(), '../.omd/project.json'),
    join(process.cwd(), '../../.omd/project.json'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    if (path.endsWith('project.json')) {
      const ia = (raw.informationArchitecture ?? {}) as Record<string, unknown>;
      return {
        objects: [],
        nav: (ia.nav ?? {}) as Record<string, unknown>,
        fromProject: true,
        sections: (ia.sections as Array<Record<string, unknown>>) ?? [],
        catalogs: (ia.catalogs as Array<Record<string, unknown>>) ?? [],
      };
    }
    return {
      objects: (raw.objects as Array<Record<string, unknown>>) ?? [],
      nav: (raw.nav as Record<string, unknown>) ?? {},
      fromProject: false,
    };
  }
  return { objects: [], nav: {}, fromProject: false };
}

export const CATALOG_DIRS: Record<string, string> = {
  'dbs.prds': 'planning/prds',
  'dbs.stories': 'planning/stories',
  'dbs.plans': 'plans',
  'dbs.adrs': 'adr',
  'dbs.glossary': 'domain/glossary',
  'dbs.models': 'domain/models',
  'dbs.policies': 'domain/policies',
  'dbs.data-model': 'spec/data-model',
  'dbs.system-model': 'spec/system-model',
};
