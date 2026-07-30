# Repository instructions

This file is the canonical instruction set for coding agents. `CLAUDE.md`
only points here.

## Project

Oh My Docs is a docs-first product workspace. `apps/docs/content/docs` is the
local handbook SSOT for product intent, observable contracts, decisions, and
implementation notes.

- Node.js >= 24
- pnpm 11.5.2 and Turborepo
- TypeScript strict mode and ESM
- SSOT is `local` (see `.omd/project.json`); Notion is the other supported
  option for adopters, not this dogfood repo

Prefer updating a stable ID over duplicating an idea. Register every catalog
document in its sibling `meta.json`. Create artifacts with
`node skills/oh-my-doc/scripts/omd.mjs new prd|story|spec|plan|adr --title "…"`.

## Commands

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm check:planning
pnpm check:release-version   # optional: pass vX.Y.Z to match a release tag
node skills/oh-my-doc/scripts/omd.mjs new <kind> --title "…" [--id ID] [--dry-run] [--yes] [--json]
```

Do not hand-edit generated files in `apps/docs/.source`.

## Release

Public packages and plugin manifests share one version. Tag `vX.Y.Z` only after
`check:release-version` passes. Publishing uses `.github/workflows/release.yml`
with npm Trusted Publishing (OIDC); humans must configure Trusted Publishers on
npmjs.com before the first tag publish. Do not publish from a developer machine.

## Cursor Cloud specific instructions

- Node is provided via `nvm` (default alias points at Node 24, `lts/krypton`).
  The VM ships an `/exec-daemon/node` (Node 22) that wins in non-login shells, so
  a bare `node`/`pnpm` may resolve to Node 22. `~/.bashrc` prepends the nvm Node 24
  bin, so **login shells** (e.g. tmux `bash -l`) get Node 24 automatically — prefer
  starting long-running commands in a tmux login shell. If a command reports Node 22,
  run `source ~/.nvm/nvm.sh && nvm use default` first.
- `pnpm` is provided by corepack (pinned to `pnpm@11.5.2` via the `packageManager`
  field), not by a global install. It lives in the nvm Node 24 bin.
- No lint tooling exists (no ESLint/Biome). The "lint" gate is the check scripts:
  `pnpm check:ui-snapshot`, `pnpm check:skills`, and `pnpm check:planning`.
  Release publishing uses `.github/workflows/release.yml`.
- The only long-running service is the docs handbook (`apps/docs`, Next.js). Run it
  with `pnpm --filter @oh-my-docs/docs dev` (or `pnpm dev`); it serves on
  `http://localhost:3000` with `/docs/*` pages and their `/md/*` Markdown twins.
- SSOT is `local` (`.omd/project.json`). Edit `apps/docs/content/docs` directly;
  no Supabase sync or revalidate setup is required.
- Agent-runtime smoke test (no server needed):
  `node skills/oh-my-doc/scripts/omd.mjs inspect --json` and `... check --json`.
  Test `adopt` against a throwaway temp dir, never the repo root — it scaffolds files.

<!-- oh-my-docs:start -->
# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives in
**one** handbook SSOT — either local docs (`docs/content/docs` or
`apps/docs/content/docs`) or Notion — never more than one as authoritative.

## Content source (SSOT)

1. Read `.omd/project.json` and use `contentSource.ssot`
   (`local` | `notion`).
2. Missing `contentSource` means `local`.
3. If `.omd/project.json` is missing, run `inspect` / ask the user to choose
   SSOT and `adopt` before inventing handbook files.
4. For `local`, edit the Fumadocs MDX tree. For `notion`, edit Home +
   inline catalog DBs via the host Notion MCP. Do not treat an unselected
   provider as truth.

## Documentation is always first

Any decision, agreement, requirement, design choice, open question, or new
discussion that should outlive this chat must be written into the selected SSOT
— not left only in conversation.

1. Before and during the talk, check whether the topic already exists in the SSOT.
2. Create or update the matching handbook artifacts as the discussion progresses.
3. Catalog entries (PRD, story, plan, ADR, …) go in the **catalog store** — a
   Notion inline database row or a local catalog folder + `meta.json` — never
   as ad-hoc section children. **Planning ≠ Plans**: implementation plans
   belong in Plans (`dbs.plans`), not under Planning.
4. Prefer `node <skill>/scripts/omd.mjs new <kind> --title "…" --yes` (local)
   or the Notion catalog workflow (notion) over ad-hoc files or chat-only notes.
5. Run `node <skill>/scripts/omd.mjs check` after meaningful documentation edits.
<!-- oh-my-docs:end -->
