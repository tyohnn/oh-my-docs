# Information architecture

## Local HTML SSOT

When `contentSource.ssot: local`, the handbook catalog store is:

```text
.omd/dbs/<catalog-id>/*.html
```

See [`local-html-ia-graph.json`](./local-html-ia-graph.json) and
[`html-document-contract.md`](./html-document-contract.md).

Default catalogs (flat under `.omd/dbs/`):

| Folder | Kind | Prefix |
|---|---|---|
| `release` | release | `REL-` |
| `prds` | prd | `PRD-` |
| `stories` | story | `US-` |
| `features` | feature | `FEAT-` |
| `policies` | policy | `POL-` / `POLICY-` |
| `adr` | adr | `ADR-` |
| `ia` | ia | `IA-` |
| `pages` | page | `PAGE-` |
| `layouts` | layout | `LAY-` |
| `screen-states` | screen-state | `STA-` |
| `archive` | archive | original ID |
| `plans` | plan | `PLAN-` |
| `glossary` | term | `TERM-` |
| `models` | model | `MODEL-` |
| `specs` | spec | `SPEC-` |

`dbs/index.html` is the local home (catalog stack guide). Shared styles live in
`.omd/assets/omd-doc.css`.

`omd new` and `omd check` target `.omd/dbs` only. The Fumadocs MDX tree under
`docs/content/docs` is not the local SSOT write path.

## Notion SSOT

When `contentSource.ssot: notion`, catalogs are inline databases stacked on a
single Home page (no child pages, no sidebar). See
`notion-information-architecture.md` and `notion-ia-graph.json`.

## Fumadocs shell IA (optional viewer)

Generated docs apps may still use a stable top-level MDX IA for local browsing:

| Section | Role |
|---|---|
| Home | Handbook landing page |
| Vision | Product vision |
| Start here | Single page — shortest path into the product |
| Domain | Living terms, models, and policies |
| Workflow | Planning and development contracts |
| Planning | PRD and story catalogs (index-only) |
| Plans | Implementation plans (index-only catalog) |
| ADR | Architecture decisions (index-only catalog) |
| Spec | Living contract pages |

That MDX tree is a **shell mirror**, not the planning SSOT, when local HTML is
selected. Machine graph validation reads `.omd/dbs`.

Default MDX order (shell only):

`Home → Vision → Start here → Domain → Workflow → Planning → Plans → ADR → Spec`

Domain shell folders: `glossary/` (`TERM-*`), `models/` (`MODEL-*`),
`policies/` (`POLICY-*` / `POL-*`).

Domain and Spec are living surfaces. PRDs and PLANs remain change-scoped
catalogs, ADRs remain decision records, and `.omd/tasks` is execution state.
