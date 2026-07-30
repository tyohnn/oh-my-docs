/**
 * Best-effort handbook cache invalidation after content-port writes.
 *
 * Env:
 *   OMD_DOCS_URL — docs site origin (e.g. https://foo.vercel.app)
 *   OMD_REVALIDATE_SECRET — shared secret for POST /api/revalidate
 *
 * Returns { ok, skipped?, status?, error? }. Never throws.
 */

/**
 * @param {{
 *   paths?: string[];
 *   tags?: string[];
 *   docsUrl?: string;
 *   secret?: string;
 *   fetchImpl?: typeof fetch;
 * }} [options]
 */
export async function notifyDocsRevalidate(options = {}) {
  const docsUrl = (options.docsUrl ?? process.env.OMD_DOCS_URL ?? '').replace(/\/$/, '');
  const secret = options.secret ?? process.env.OMD_REVALIDATE_SECRET;
  if (!docsUrl || !secret) {
    return {
      ok: false,
      skipped: true,
      error: 'OMD_DOCS_URL and OMD_REVALIDATE_SECRET required for revalidate notify',
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, skipped: true, error: 'fetch unavailable' };
  }

  try {
    const response = await fetchImpl(`${docsUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        paths: options.paths ?? [],
        tags: options.tags ?? [],
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `revalidate failed: ${response.status}`,
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
