import { createCompiler } from '@fumadocs/mdx-remote';
import { createCatalogNavigation, indexOnlyPageTree } from '@oh-my-docs/ui/navigation';
import { loader } from 'fumadocs-core/source';
import type { VirtualFile } from 'fumadocs-core/source';
import { cache } from 'react';

import handbookIa from '../../../skills/oh-my-doc/references/handbook-ia-graph.json';
import type { CatalogSource } from '@oh-my-docs/ui/navigation';
import {
  documentToMdx,
  fetchSupabaseCatalogMeta,
  fetchSupabaseDocumentByPath,
  fetchSupabaseDocuments,
  loadHandbookIaGraph,
  type SupabaseHandbookDocument,
} from './supabase-handbook.ts';
import { buildCatalogMetas, buildSectionMetas } from './supabase-meta.ts';

const compiler = createCompiler();

const CATALOGS = (
  handbookIa.objects as Array<{
    metaRole?: string;
    catalogLabel?: string;
    title?: string;
    localPath?: string;
    indexUrl?: string;
  }>
)
  .filter((o) => o.metaRole === 'catalog-index' && o.localPath && o.indexUrl)
  .map((o) => ({
    prefix: o.localPath!.split('/') as [string, ...string[]],
    indexUrl: o.indexUrl!,
    label: o.catalogLabel ?? o.title ?? o.localPath!,
  }));

function pathToSlugs(path: string): string[] | undefined {
  if (!path || path === 'index') return undefined;
  return path.split('/');
}

function asTitle(doc: SupabaseHandbookDocument): string {
  const title = doc.frontmatter.title;
  return typeof title === 'string' && title ? title : doc.id;
}

function asDescription(doc: SupabaseHandbookDocument): string | undefined {
  const description = doc.frontmatter.description;
  return typeof description === 'string' ? description : undefined;
}

async function buildVirtualFiles(): Promise<VirtualFile[]> {
  const [documents, catalogs] = await Promise.all([
    fetchSupabaseDocuments(),
    fetchSupabaseCatalogMeta(),
  ]);
  const ia = loadHandbookIaGraph();
  const files: VirtualFile[] = [];

  for (const [dir, payload] of buildSectionMetas(ia)) {
    files.push({
      type: 'meta',
      path: dir ? `${dir}/meta.json` : 'meta.json',
      data: payload,
    });
  }
  for (const [dir, payload] of buildCatalogMetas(catalogs, ia)) {
    files.push({
      type: 'meta',
      path: `${dir}/meta.json`,
      data: payload,
    });
  }

  for (const doc of documents) {
    files.push({
      type: 'page',
      path: `${doc.path}.mdx`,
      slugs: pathToSlugs(doc.path),
      data: {
        title: asTitle(doc),
        description: asDescription(doc),
        // Extended fields used by docs UI / /md; loader PageData is open in practice.
        ticker: typeof doc.ticker === 'string' ? doc.ticker : undefined,
        full: doc.frontmatter.full === true,
        // Placeholder — pages compile MDX on demand via compileSupabasePage.
        body: () => null,
        toc: [],
        async getText() {
          return String(doc.body_mdx ?? '');
        },
      },
    } as VirtualFile);
  }

  return files;
}

export const getSupabaseSource = cache(async () => {
  const files = await buildVirtualFiles();
  const remoteSource = loader({
    baseUrl: '/docs',
    source: { files },
    pageTree: indexOnlyPageTree(CATALOGS.map((catalog) => catalog.indexUrl)),
  });
  const catalogNavigation = createCatalogNavigation(
    remoteSource as unknown as CatalogSource,
    CATALOGS,
  );
  return {
    source: remoteSource,
    catalogIndexLink: catalogNavigation.indexLink,
    catalogFooterItems: catalogNavigation.footerItems,
  };
});

export async function compileSupabasePage(slug?: string[]) {
  const path = !slug || slug.length === 0 ? 'index' : slug.join('/');
  const doc = await fetchSupabaseDocumentByPath(path);
  if (!doc) return null;
  const compiled = await compiler.compile({
    source: documentToMdx(doc),
  });
  return {
    doc,
    title: asTitle(doc),
    description: asDescription(doc),
    ticker: typeof doc.ticker === 'string' ? doc.ticker : undefined,
    full: doc.frontmatter.full === true,
    body: compiled.body,
    toc: compiled.toc,
    getText: async () => String(doc.body_mdx ?? ''),
  };
}

export async function listSupabaseStaticParams() {
  const documents = await fetchSupabaseDocuments();
  return documents.map((doc) => ({
    slug: pathToSlugs(doc.path) ?? [],
  }));
}
