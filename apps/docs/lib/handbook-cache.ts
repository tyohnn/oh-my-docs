/** Next.js cache tag for the whole supabase handbook snapshot. */
export const OMD_HANDBOOK_CACHE_TAG = 'omd-handbook';

/** TTL floor (seconds) when no on-demand revalidate has run. */
export const OMD_HANDBOOK_REVALIDATE_SECONDS = 3600;

export function handbookDocCacheTag(path: string): string {
  return `omd-doc:${path}`;
}
