# Supabase handbook freshness (ISR + revalidate)

When `.omd/project.json` has `contentSource.ssot: supabase`, the docs app
reads handbook rows over PostgREST with a Next.js cache (ISR / tags). After
content-port writes, agents must invalidate that cache so `/docs` and `/md`
update without Redeploy.

## Agent owns the flow

Users should not be told to run terminal commands for this. **You** (the agent):

1. Check readiness: `node <skill>/scripts/omd.mjs inspect --json` → `revalidate`.
2. If `revalidate.ready` is false, configure env (see below) and explain status
   in chat.
3. After a successful upsert, call revalidate (runtime helper or
   `POST $OMD_DOCS_URL/api/revalidate` with Bearer secret).
4. Report success/failure to the user in natural language.

## Environment keys

| Key | Where | Purpose |
|---|---|---|
| `OMD_DOCS_URL` | Agent/host runtime | Docs site origin for notify calls |
| `OMD_REVALIDATE_SECRET` | Agent/host **and** docs deploy (Vercel) | Shared secret gating `POST /api/revalidate` |
| `NEXT_PUBLIC_SUPABASE_URL` / publishable key | Docs deploy + local `.env.local` | Read path only — not the revalidate secret |

`OMD_REVALIDATE_SECRET` is **not** from Supabase. Generate a random value
(`openssl rand -hex 32`). Use the same string in both places. Never commit it;
never use `service_role`.

## Setup sequence (agent)

1. Generate a secret if missing.
2. Set `OMD_REVALIDATE_SECRET` on the **docs Vercel project** (Production +
   Preview as needed) via Vercel CLI/MCP when available; otherwise give the
   user the one value to paste in the Vercel env UI.
3. Set `OMD_DOCS_URL` and the same secret in the **agent runtime** (Cursor Cloud
   secrets, local shell env, etc.).
4. For local docs runs, keep publishable Supabase keys in `apps/docs/.env.local`
   (`pnpm sync:env` when runtime secrets are injected).
5. Smoke: POST revalidate (or run a handbook write that notifies) and confirm
   `/docs` refreshes.

## After writes

Best-effort: if URL/secret are unset, writes still succeed; tell the user that
freshness is delayed until TTL or Redeploy, then offer to finish setup.
