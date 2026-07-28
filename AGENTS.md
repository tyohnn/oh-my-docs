# Repository instructions

This file is the canonical instruction set for coding agents. `CLAUDE.md`
only points here.

## Project

Oh My Docs is a docs-first product workspace. `apps/docs/content/docs` is the
single source of truth for product intent, observable contracts, decisions,
and implementation plans.

- Node.js >= 24
- pnpm 11.5.2 and Turborepo
- TypeScript strict mode and ESM

## Docs-first gate

Read `workflow/planning.mdx` and `workflow/development.mdx` before changing
product code.

1. Classify the change as `product`, `bugfix`, `maintenance`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification,
   and a ready implementation plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable
   contract changes.
5. If required documents are missing, create and review a docs-only change
   first. Do not combine a new plan and its implementation.
6. Open **separate PRs that both target `main`**, and merge them
   **sequentially**: (1) docs-only planning PR → merge to `main`;
   (2) implementation PR → merge to `main` after the plan is on `main`.
   Do not stack the implementation PR on the planning branch as its base.
7. An implementation PR must include
   `Plan: apps/docs/content/docs/plans/plan-….mdx`; that plan must
   already exist on the PR base (`main` after step 6) with
   `stage: ready|active` and `codeAreas` covering every non-docs path in
   the diff. Until the planning PR is merged, the implementation PR’s
   docs-first check against `main` is expected to fail.
8. If scope changes during implementation, update and review the plan first
   (another docs PR to `main` if needed).
9. Mark the plan `done` only after implementation and verification complete.

### Exemptions

- **Docs-only** changes under `apps/docs/content/docs/`, `apps/docs/templates/`,
  plus root `README.md` / `CHANGELOG.md`, do not require a prior plan.
- There is **no** general bypass for product, bugfix, or maintenance code.
- Local runs without `BASE_SHA` skip the docs-first script (CI always sets it
  on pull requests).

The dependency direction is:

`product vision → PRD → story → specification/ADR → implementation plan → code`

Earlier documents describe user needs without relying on later implementation
terminology. Use stable IDs and update existing documents instead of duplicating
an idea under a new ID. Register every catalog document in its sibling
`meta.json`.

Create artifacts with `node skills/oh-my-doc/scripts/omd.mjs new prd|story|spec|plan|adr --title "…"`.

## Commands

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm check:planning
pnpm check:docs-first   # requires BASE_SHA in CI; skips locally when unset
pnpm check:release-version   # optional: pass vX.Y.Z to match a release tag
pnpm check:pack-smoke        # build → npm pack → temp install → CLI smoke
node skills/oh-my-doc/scripts/omd.mjs new <kind> --title "…" [--id ID] [--dry-run] [--yes] [--json]
```

Do not hand-edit generated files in `apps/docs/.source`.

## Release

Public packages and plugin manifests share one version. Tag `vX.Y.Z` only after
`check:release-version` and `check:pack-smoke` pass. Publishing uses
`.github/workflows/release.yml` with npm Trusted Publishing (OIDC); humans must
configure Trusted Publishers on npmjs.com before the first tag publish. Do not
publish from a developer machine.

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
  `pnpm check:ui-snapshot`, `pnpm check:skills`, `pnpm check:planning`, and
  (when `BASE_SHA` is set) `pnpm check:docs-first`. Release publishing uses
  `.github/workflows/release.yml`.
- The only long-running service is the docs handbook (`apps/docs`, Next.js). Run it
  with `pnpm --filter @oh-my-docs/docs dev` (or `pnpm dev`); it serves on
  `http://localhost:3000` with `/docs/*` pages and their `/md/*` Markdown twins.
- Agent-runtime smoke test (no server needed):
  `node skills/oh-my-doc/scripts/omd.mjs inspect --json` and `... check --json`.
  Test `adopt` against a throwaway temp dir, never the repo root — it scaffolds files.

<!-- oh-my-docs:start -->
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
<!-- oh-my-docs:end -->
