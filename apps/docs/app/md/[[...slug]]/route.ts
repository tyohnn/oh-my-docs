import { notFound } from 'next/navigation';

import { shouldUseSupabaseRemote, source as localSource } from '@/lib/source';
import { compileSupabasePage, listSupabaseStaticParams } from '@/lib/supabase-remote-source';

// Next.js requires a literal segment config (keep in sync with OMD_HANDBOOK_REVALIDATE_SECONDS).
export const revalidate = 3600;
export const dynamicParams = true;

export async function GET(_request: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;

  if (shouldUseSupabaseRemote()) {
    const compiled = await compileSupabasePage(slug);
    if (!compiled) notFound();
    return new Response(await compiled.getText(), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  const page = localSource.getPage(slug);
  if (!page) notFound();

  return new Response(await page.data.getText('processed'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
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
