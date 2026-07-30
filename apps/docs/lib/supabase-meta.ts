import {
  CATALOG_DIRS,
  type SupabaseCatalogMeta,
  loadHandbookIaGraph,
} from './supabase-handbook.ts';

type MetaPayload = {
  title: string;
  pages: string[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

/**
 * Build root + section meta.json payloads from handbook IA.
 * Mirrors apps/docs/scripts/pull-supabase-content.mjs#buildSectionMetas.
 */
export function buildSectionMetas(
  ia: ReturnType<typeof loadHandbookIaGraph> = loadHandbookIaGraph(),
): Map<string, MetaPayload> {
  const metas = new Map<string, MetaPayload>();

  if (ia.fromProject) {
    const sections = Array.isArray(ia.sections) ? ia.sections : [];
    const byId = new Map(sections.map((s) => [String(s.id), s]));
    const rootOrder = (
      (ia.nav?.localRootOrder as string[] | undefined) ??
      (ia.nav?.topLevel as string[] | undefined) ??
      []
    )
      .map((key) => String(key).replace(/^pages\./, ''))
      .map((id) => (id === 'home' ? 'index' : id === 'adrs' ? 'adr' : id));
    const rootPages = rootOrder.filter((id) => id === 'index' || byId.has(id) || id === 'adr');
    metas.set('', {
      title: 'Handbook',
      pages: rootPages.length ? rootPages : ['index'],
    });

    const nested = (ia.nav?.nested ?? {}) as Record<string, string[]>;
    for (const [parentKey, childKeys] of Object.entries(nested)) {
      const parentId = String(parentKey).replace(/^pages\./, '');
      const parent = byId.get(parentId);
      const dir = parentId === 'adrs' ? 'adr' : parentId;
      const childPages = (Array.isArray(childKeys) ? childKeys : []).map((key) => {
        const id = String(key).replace(/^pages\./, '');
        if (id.startsWith(`${parentId}-`)) return id.slice(parentId.length + 1);
        if (id === 'workflow-planning') return 'planning';
        return id.includes('/') ? (id.split('/').pop() ?? id) : id;
      });
      const pages = ['index', ...childPages.filter((p) => p && p !== 'index')];
      metas.set(dir, {
        title: String(parent?.title ?? dir),
        pages: [...new Set(pages)],
        ...(dir === 'spec' ? { collapsible: true, defaultOpen: true } : {}),
      });
    }
    return metas;
  }

  const objects = Array.isArray(ia.objects) ? ia.objects : [];
  const byKey = new Map(objects.map((o) => [String(o.key), o]));
  const pathOf = (key: string) => {
    const obj = byKey.get(key);
    const localPath = obj?.localPath;
    if (typeof localPath !== 'string') return undefined;
    return localPath === 'index' ? '' : localPath;
  };
  const leafName = (key: string) => {
    const path = pathOf(key);
    if (!path) return undefined;
    return path.includes('/') ? path.split('/').pop() : path;
  };

  const rootKeys =
    (ia.nav?.localRootOrder as string[] | undefined) ??
    (ia.nav?.topLevel as string[] | undefined) ??
    [];
  const rootPages = rootKeys
    .map((key) => {
      const path = pathOf(String(key));
      if (path === '') return 'index';
      if (!path) return undefined;
      return path.includes('/') ? undefined : path;
    })
    .filter((p): p is string => Boolean(p));
  metas.set('', {
    title: 'Handbook',
    pages: rootPages.length ? rootPages : ['index'],
  });

  const nested = (ia.nav?.nested ?? {}) as Record<string, string[]>;
  for (const [parentKey, childKeys] of Object.entries(nested)) {
    const parent = byKey.get(parentKey);
    const dir = pathOf(parentKey);
    if (!dir || dir.includes('/')) continue;
    const childPages = (Array.isArray(childKeys) ? childKeys : [])
      .map((key) => leafName(String(key)))
      .filter((p): p is string => Boolean(p));
    const pages = ['index', ...childPages.filter((p) => p !== 'index')];
    metas.set(dir, {
      title: String(parent?.title ?? dir),
      pages: [...new Set(pages)],
      ...(dir === 'spec' ? { collapsible: true, defaultOpen: true } : {}),
    });
  }

  if (metas.has('workflow')) {
    const workflow = metas.get('workflow')!;
    workflow.pages = workflow.pages.filter((p) => p !== 'index');
    if (workflow.pages.length === 0) metas.delete('workflow');
  }

  return metas;
}

export function catalogMetaPayload(pages: string[], title: string): MetaPayload {
  const detailPages = (Array.isArray(pages) ? pages : []).filter((p) => p && p !== 'index');
  return { title, pages: detailPages };
}

export function catalogTitle(
  ia: ReturnType<typeof loadHandbookIaGraph>,
  catalogKey: string,
  dir: string,
): string {
  const objects = Array.isArray(ia.objects) ? ia.objects : [];
  const match = objects.find(
    (o) => o.metaRole === 'catalog-index' && o.databaseKey === catalogKey,
  );
  if (match?.catalogLabel || match?.title) {
    return String(match.catalogLabel ?? match.title);
  }
  return dir.split('/').at(-1) ?? catalogKey;
}

export function buildCatalogMetas(
  catalogs: SupabaseCatalogMeta[],
  ia: ReturnType<typeof loadHandbookIaGraph> = loadHandbookIaGraph(),
): Map<string, MetaPayload> {
  const metas = new Map<string, MetaPayload>();
  for (const catalog of catalogs) {
    const dir = CATALOG_DIRS[catalog.catalog_key];
    if (!dir || !Array.isArray(catalog.pages)) continue;
    metas.set(dir, catalogMetaPayload(catalog.pages, catalogTitle(ia, catalog.catalog_key, dir)));
  }
  return metas;
}
