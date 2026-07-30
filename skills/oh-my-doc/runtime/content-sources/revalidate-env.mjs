/**
 * Readiness helpers for docs on-demand revalidate (ISR freshness).
 * Never returns or logs secret values — only presence and setup guidance.
 */

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function readRevalidateEnv(env = process.env) {
  const docsUrl = String(env.OMD_DOCS_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  const secret = String(env.OMD_REVALIDATE_SECRET ?? '').trim();
  /** @type {string[]} */
  const missing = [];
  if (!docsUrl) missing.push('OMD_DOCS_URL');
  if (!secret) missing.push('OMD_REVALIDATE_SECRET');
  return {
    docsUrl: docsUrl || null,
    hasSecret: Boolean(secret),
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Structured agent-facing steps. Agents execute these; do not dump raw
 * shell homework on the user unless a host UI requires their confirmation.
 *
 * @param {{ ready?: boolean, missing?: string[] } | null} [status]
 */
export function revalidateAgentGuidance(status = null) {
  const ready = status?.ready === true;
  return {
    principle:
      'You (the agent) configure and call revalidate. Do not ask the user to run curl, openssl, or pnpm just to refresh /docs.',
    when: 'contentSource.ssot is supabase and the docs site serves with ISR + POST /api/revalidate',
    ready,
    steps: [
      'Ensure OMD_DOCS_URL is the public docs origin (e.g. https://<project>.vercel.app), no trailing slash.',
      'Ensure OMD_REVALIDATE_SECRET is a long random shared secret (generate with `openssl rand -hex 32` if missing).',
      'Put the **same** secret on the docs deploy (Vercel env for the docs app) and in the agent/host runtime secrets. Never commit it; never use service_role.',
      'Prefer host tools (Vercel env CLI/MCP, Cursor Cloud runtime secrets UI guidance) over asking the user to open a terminal.',
      'After a successful handbook upsert (`omd new`, catalog write, …), call `notifyDocsRevalidate` / POST `/api/revalidate` with `Authorization: Bearer $OMD_REVALIDATE_SECRET`.',
      'Tell the user in chat what you configured (URL + that a secret is set) and whether cache refresh succeeded — not the secret value unless they must paste it into a host UI you cannot write.',
    ],
    blockerWhenUnset:
      'Without OMD_DOCS_URL + OMD_REVALIDATE_SECRET, content-port writes still succeed but /docs and /md may stay stale until the ISR TTL (~1h) or a Redeploy.',
  };
}
