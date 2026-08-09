# HTML document contract (local SSOT)

Local handbook SSOT is **one self-contained `.html` file per catalog row** under
`.omd/dbs/<catalog>/`. There is no sidecar JSON. Notion SSOT is unchanged.

## File layout

```text
.omd/
  project.json
  state.json
  assets/omd-doc.css
  dbs/
    index.html              # catalog home
    release/index.html      # generated catalog listing
    release/REL-001.html
    prds/index.html
    prds/PRD-001.html
    stories/US-001.html
    features/FEAT-001.html
    policies/POL-001.html   # POLICY-* also allowed
    adr/ADR-001.html
    ia/IA-001.html
    pages/PAGE-001.html
    layouts/LAY-001.html
    screen-states/STA-001.html
    archive/<original-id>.html
    plans/PLAN-001.html
    glossary/TERM-001.html
    models/MODEL-001.html
    data-model/DM-1.html
    system-model/SYSM-1.html
    specs/SPEC-001.html          # optional legacy SPEC-*
```

Filename = document ID + `.html` (e.g. `PRD-001.html`). Archive keeps the
original ID as the filename. Each catalog folder’s `index.html` is **generated**
(ID · title · status table) by `omd new` / `adopt` / `sync` — do not hand-edit.

## Styling (Tailwind + shadcn Table)

Catalog home/index pages may use **Tailwind via CDN** (`https://cdn.tailwindcss.com`)
because `.omd` has no bundler. Theme tokens mirror shadcn (`--background`,
`--muted-foreground`, `--border`, …) in `omd-doc.css`. Table markup follows the
shadcn Table pattern (`rounded-md border` → `w-full caption-bottom text-sm` →
`hover:bg-muted/50` rows). If the CDN is offline, the same CSS file provides a
fallback look.

## Machine-readable surface

Every document must expose identity on the root element and in `<head>`:

```html
<html lang="ko" data-omd-kind="prd" data-omd-id="PRD-001">
<head>
  <meta charset="utf-8" />
  <meta name="omd:id" content="PRD-001" />
  <meta name="omd:kind" content="prd" />
  <meta name="omd:status" content="draft" />
  <title>PRD-001 · …</title>
  <link rel="stylesheet" href="../../assets/omd-doc.css" />
</head>
```

Rules:

| Surface | Purpose |
|---|---|
| `html[data-omd-kind]` / `html[data-omd-id]` | Primary parse keys |
| `<meta name="omd:*">` | Scalar fields (`id`, `kind`, `status`, `stage`, `changeType`, …) |
| `[data-omd-field="<name>"]` | Human-visible scalar field mirror (text content) |
| `[data-omd-chip]` | Optional; forces badge styling on a scalar `dd` |
| `[data-omd-rel="<name>"]` | Relation list; each target is an `<a href="../<catalog>/<ID>.html">` |

`data-omd-kind` / `omd:kind` use the **kind** token (`prd`, `story`, `layout`, …),
not the folder name. Folder names match the catalog table below.

Enum-like scalars (`status`, `stage`, `priority` / `우선순위`, `changeType`,
`버전 유형`, `제품` / `제품 영역` / `area` / `product`, `persona`, `stateType`)
render as pill badges via `omd-doc.css`. Free-text fields such as `summary`
stay plain. Add `data-omd-chip` on other short categorical values when needed.

Chip colors come from CSS variables in `omd-doc.css`:

| Layer | How |
|---|---|
| Tone tokens | `--omd-chip-{neutral,muted,info,success,warning,danger,accent,violet}-{bg,fg,bd}` |
| Field default | e.g. `status` → neutral, `priority` → warning, `product` → info |
| Value default | `data-omd-value` (synced from text): `P0` danger, `계획`/`초안` neutral, `In progress` info, `오류` danger, … |
| Override | `data-omd-tone="success\|warning\|danger\|info\|accent\|violet\|neutral\|muted"` |

Keep `data-omd-value` equal to the visible text so value colors apply. `omd new` /
`setField` write this attribute automatically.

## Human-readable surface

- `<header class="omd-doc-header">` — ID, title, property chips / `<dl>` of fields and relations
- `<main class="omd-doc-body">` — narrative sections (headings from the kind template)
- Layouts and screen-states also include `<section class="omd-wireframe">` mockups

## Relations

Relations replace Notion relation properties. Example:

```html
<dd data-omd-rel="stories">
  <a href="../stories/US-001.html">US-001</a>
  <a href="../stories/US-002.html">US-002</a>
</dd>
```

- Link text and path basename (without `.html`) must equal the target ID.
- Empty relations keep the `data-omd-rel` element with no links.
- `omd check` resolves relative hrefs and rejects dangling IDs.

## Wireframes (layouts · screen-states)

Required on `layout` and `screen-state` documents:

```html
<section class="omd-wireframe" data-omd-wireframe="shell">
  <!-- app shell + body cell mock -->
</section>
<section class="omd-wireframe" data-omd-wireframe="body">
  <!-- body skeleton alone -->
</section>
```

Screen-states: **one state per file**. Do not bundle loading / empty / error
variants in a single HTML document.

## Catalogs and ID prefixes

| Folder | Kind | Prefix |
|---|---|---|
| `release` | `release` | `REL-` |
| `prds` | `prd` | `PRD-` |
| `stories` | `story` | `US-` |
| `features` | `feature` | `F-` or `FEAT-` |
| `policies` | `policy` | `POL-` or `POLICY-` |
| `adr` | `adr` | `ADR-` |
| `ia` | `ia` | `IA-` |
| `pages` | `page` | `SCR-` or `PAGE-` |
| `layouts` | `layout` | `LAY-` |
| `screen-states` | `screen-state` | `STA-` |
| `archive` | `archive` | original ID retained |
| `plans` | `plan` | `PLAN-` |
| `glossary` | `term` | `TERM-` |
| `models` | `model` | `MODEL-` |
| `data-model` | `spec` | `DM-` |
| `system-model` | `system-model` | `SYSM-` |
| `specs` | `spec` | `SPEC-` (optional) |

## Shared stylesheet

All documents link `../../assets/omd-doc.css` (from a catalog file) or
`../assets/omd-doc.css` (from `dbs/index.html`). Adopt copies the skill template
CSS into `.omd/assets/omd-doc.css`.

## Validation (`omd check`)

For `contentSource.ssot: local`, check validates `.omd/dbs` only:

1. Every `*.html` (except `index.html`) parses as an OMD document
2. Kind/ID/prefix match the catalog folder
3. Required lifecycle fields are present and enumerated
4. Relations resolve to existing IDs
5. `layout` / `screen-state` include at least one `.omd-wireframe` section
6. Duplicate IDs across catalogs are rejected
