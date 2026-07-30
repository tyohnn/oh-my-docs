# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives in
**one** handbook SSOT — either local docs (`docs/content/docs` or
`apps/docs/content/docs`), Notion, or BYO Supabase — never more than one as
authoritative.

## Content source (SSOT)

1. Read `.omd/project.json` and use `contentSource.ssot`
   (`local` | `notion` | `supabase`).
2. Missing `contentSource` means `local`.
3. If `.omd/project.json` is missing, run `inspect` / ask the user to choose
   SSOT and `adopt` before inventing handbook files.
4. For `notion`, edit the mapped Notion handbook (via the host Notion MCP).
   For `supabase`, mutate handbook rows via the content port (host Supabase
   CLI/MCP); Fumadocs only reads. For `local`, edit the docs content tree.
   Do not treat an unselected provider as truth.

## Documentation is always first

Any decision, agreement, requirement, design choice, open question, or new
discussion that should outlive this chat must be written into the selected SSOT
— not left only in conversation.

1. Before and during the talk, check whether the topic already exists in the SSOT.
2. Create or update the matching handbook artifacts as the discussion progresses.
3. Catalog entries (PRD, story, plan, ADR, …) go in the **catalog store** — a
   Notion inline database row, Supabase `omd_catalog_meta` + `omd_documents`,
   or a local catalog folder + `meta.json` — never as ad-hoc section children.
   **Planning ≠ Plans**: implementation plans belong in Plans (`dbs.plans`),
   not under Planning.
4. Prefer `node <skill>/scripts/omd.mjs new <kind> --title "…" --yes` (local)
   or the provider catalog workflow (notion/supabase) over ad-hoc files or
   chat-only notes.
5. Run `node <skill>/scripts/omd.mjs check` after meaningful documentation edits.
6. For `supabase`, the agent configures `OMD_DOCS_URL` +
   `OMD_REVALIDATE_SECRET` (same secret on the docs deploy), calls
   revalidate after content-port writes, and explains status in chat — do not
   ask the user to run terminal revalidate commands. See the skill reference
   `supabase-handbook-freshness.md`.

## Docs-first gate

1. Classify the change as `product`, `bugfix`, `maintenance`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification, and a ready plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable contract changes.
5. If required documents are missing, create and review a docs-only change first.
6. Open separate PRs that both target `main` and merge sequentially:
   docs-only planning PR to `main` first, then the implementation PR to
   `main` (do not use the planning branch as the implementation PR base).
7. An implementation PR must reference a plan that already exists on `main`
   (the PR base) with `stage: ready|active` and covering `codeAreas`.
8. Docs-only edits under the docs content/templates trees (plus root `README.md` / `CHANGELOG.md`) are exempt. There is no general bypass.

Dependency direction:

`product vision → PRD → story → specification/ADR → implementation plan → code`

> Managed by Oh My Docs (`adopt` / `sync`). Prefer re-running the skill runtime over hand-editing this body.
