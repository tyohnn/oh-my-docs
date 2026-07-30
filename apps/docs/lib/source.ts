import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { createCatalogNavigation, indexOnlyPageTree } from '@oh-my-docs/ui/navigation';
import handbookIa from '../../../skills/oh-my-doc/references/handbook-ia-graph.json';

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

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  pageTree: indexOnlyPageTree(CATALOGS.map((catalog) => catalog.indexUrl)),
});

const catalogNavigation = createCatalogNavigation(source, CATALOGS);

export const catalogIndexLink = catalogNavigation.indexLink;
export const catalogFooterItems = catalogNavigation.footerItems;
