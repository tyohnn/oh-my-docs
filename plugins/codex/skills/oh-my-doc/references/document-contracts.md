# Document contracts

## Local SSOT = HTML catalogs

When `.omd/project.json` has `contentSource.ssot: local`, each catalog row is a
**self-contained HTML file** under `.omd/dbs/<catalog>/<ID>.html`.

See [`html-document-contract.md`](./html-document-contract.md) for the full
format (`data-omd-*`, `meta omd:*`, relations, wireframes).

MDX under `docs/content/docs` (or `apps/docs/content/docs`) is **not** the local
write or check target. The Fumadocs app remains an optional shell/viewer only.

## Notion SSOT

When `contentSource.ssot: notion`, catalog rows live in Notion inline databases
on the handbook Home page. Machine fields follow Notion property schemas in
`notion-catalog-schemas.json`. Local HTML rules do not apply.

## Field expectations (both SSOTs)

Common identity and lifecycle concepts:

| Field | Used by |
|---|---|
| `id` | Stable identity (`PRD-…`, `US-…`, …) |
| `title` / `summary` | Human and catalog display |
| `status` / `stage` | Lifecycle |
| `prd`, `specs`, `stories`, `features`, … | Graph links |
| `codeAreas` | Paths a plan authorizes |
| `changeType` | Plan change class (`product`, `bugfix`, `maintenance`) |

Lifecycle fields (local HTML mirrors these via `omd:*` meta / `data-omd-field`):

| Kind | Field | Values |
|---|---|---|
| PRD | `status` | `draft`, `active`, `done` |
| Spec | `stage` | `draft`, `accepted`, `superseded` |
| ADR | `stage` | `accepted`, `locked`, `superseded` |
| Plan | `stage` | `draft`, `ready`, `active`, `done`, `superseded` |
| Release | `status` | `draft`, `active`, `done` |
| Feature | `status` | `draft`, `active`, `done` |

## Domain contracts

Domain documents use stable prefixes:

| Kind | Prefix | Role |
|---|---|---|
| Term | `TERM-` | Shared meaning |
| Model | `MODEL-` | Concepts, relationships, lifecycle |
| Policy | `POL-` / `POLICY-` | Conditional product rule or invariant |

Specifications reference Domain IDs rather than redefining them. PRDs and PLANs
are bounded change records; Vision-level intent, stories, Domain, and SPECs are
living documents updated in place.

## Product UI catalogs (local HTML)

Additional local catalogs for product handbook dogfood (e.g. Thread Booster):

| Kind | Prefix | Notes |
|---|---|---|
| Release | `REL-` | |
| Feature | `FEAT-` | |
| IA | `IA-` | |
| Page | `PAGE-` | |
| Layout | `LAY-` | Requires `.omd-wireframe` sections |
| Screen state | `STA-` | One state per file; requires wireframe |
| Archive | original ID | Retired rows; keep provenance |

## Task contracts

Tasks are execution state derived after a PLAN is approved. Each task lives in
`.omd/tasks/TASK-*.json`, references exactly one PLAN, declares `dependsOn`,
`codeAreas`, and US/POLICY/SPEC acceptance IDs, and follows:

`draft → ready|blocked → active → done|failed` (or `cancelled`).

## Marker blocks

`AGENTS.md` and `CLAUDE.md` may contain a managed block:

```html
<!-- oh-my-docs:start -->
…
<!-- oh-my-docs:end -->
```

Only `adopt` / `sync` should create or refresh that block. Surrounding project
content outside the markers is preserved.

## Skill trees

Installed skills live under host discovery paths. Refresh them with `adopt` or
`sync` (`--force` when a local copy diverged and should be replaced).

`node <skill>/scripts/omd.mjs check` enforces ID prefixes, relation integrity,
lifecycle states, and (for local) HTML contract + wireframe rules. Treat IDs as
immutable once published; update the existing document instead of duplicating
intent.
