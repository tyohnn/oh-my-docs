import { DocKind, docKindFromSlug } from '@oh-my-docs/ui/doc-kind';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  createRelativeLink,
} from '@oh-my-docs/ui/fumadocs';
import { DocsInlineToc } from '@oh-my-docs/ui/inline-toc';
import { getMDXComponents } from '@oh-my-docs/ui/mdx';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OMD_HANDBOOK_REVALIDATE_SECONDS } from '@/lib/handbook-cache';
import {
  catalogFooterItems as localCatalogFooterItems,
  catalogIndexLink as localCatalogIndexLink,
  shouldUseSupabaseRemote,
  source as localSource,
} from '@/lib/source';
import { compileSupabasePage, getSupabaseSource, listSupabaseStaticParams } from '@/lib/supabase-remote-source';

export const revalidate = OMD_HANDBOOK_REVALIDATE_SECONDS;
export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;

  if (shouldUseSupabaseRemote()) {
    const [{ source, catalogFooterItems, catalogIndexLink }, compiled] = await Promise.all([
      getSupabaseSource(),
      compileSupabasePage(slug),
    ]);
    if (!compiled) notFound();
    const kind = docKindFromSlug(slug);
    const footerItems = catalogFooterItems(slug);
    const indexLink = catalogIndexLink(slug);
    const MDX = compiled.body;
    const page = source.getPage(slug);

    return (
      <DocsPage
        toc={compiled.toc}
        {...(compiled.full ? { full: true } : {})}
        {...(footerItems ? { footer: { items: footerItems } } : {})}
      >
        {indexLink ? (
          <Link
            href={indexLink.href}
            className="-mt-1 inline-flex w-fit items-center rounded-lg border px-2.5 py-1.5 text-sm text-fd-muted-foreground no-underline transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
          >
            <span aria-hidden>←</span>&nbsp;{indexLink.label}
          </Link>
        ) : null}
        <DocsTitle>
          <span className="inline-flex flex-wrap items-center gap-2">
            {kind ? <DocKind kind={kind} {...(compiled.ticker ? { ticker: compiled.ticker } : {})} /> : null}
            {compiled.title}
          </span>
        </DocsTitle>
        <DocsDescription>{compiled.description}</DocsDescription>
        <DocsInlineToc items={compiled.toc} />
        <DocsBody>
          <MDX
            components={getMDXComponents(
              page ? { a: createRelativeLink(source, page) } : undefined,
            )}
          />
        </DocsBody>
      </DocsPage>
    );
  }

  const page = localSource.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const kind = docKindFromSlug(slug);
  const ticker = typeof page.data.ticker === 'string' ? page.data.ticker : undefined;
  const footerItems = localCatalogFooterItems(slug);
  const indexLink = localCatalogIndexLink(slug);

  return (
    <DocsPage
      toc={page.data.toc}
      {...(page.data.full ? { full: true } : {})}
      {...(footerItems ? { footer: { items: footerItems } } : {})}
    >
      {indexLink ? (
        <Link
          href={indexLink.href}
          className="-mt-1 inline-flex w-fit items-center rounded-lg border px-2.5 py-1.5 text-sm text-fd-muted-foreground no-underline transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
        >
          <span aria-hidden>←</span>&nbsp;{indexLink.label}
        </Link>
      ) : null}
      <DocsTitle>
        <span className="inline-flex flex-wrap items-center gap-2">
          {kind ? <DocKind kind={kind} {...(ticker ? { ticker } : {})} /> : null}
          {page.data.title}
        </span>
      </DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsInlineToc items={page.data.toc} />
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(localSource, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  if (shouldUseSupabaseRemote()) {
    try {
      return await listSupabaseStaticParams();
    } catch {
      return localSource.generateParams();
    }
  }
  return localSource.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (shouldUseSupabaseRemote()) {
    const compiled = await compileSupabasePage(slug);
    if (!compiled) notFound();
    return { title: compiled.title, description: compiled.description };
  }
  const page = localSource.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
