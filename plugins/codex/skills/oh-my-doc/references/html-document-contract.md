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
    release/REL-001.html
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
    specs/SPEC-001.html
```

Filename = document ID + `.html` (e.g. `PRD-001.html`). Archive keeps the
original ID as the filename.

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
| `[data-omd-rel="<name>"]` | Relation list; each target is an `<a href="../<catalog>/<ID>.html">` |

`data-omd-kind` / `omd:kind` use the **kind** token (`prd`, `story`, `layout`, …),
not the folder name. Folder names match the catalog table below.

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
| `features` | `feature` | `FEAT-` |
| `policies` | `policy` | `POL-` or `POLICY-` |
| `adr` | `adr` | `ADR-` |
| `ia` | `ia` | `IA-` |
| `pages` | `page` | `PAGE-` |
| `layouts` | `layout` | `LAY-` |
| `screen-states` | `screen-state` | `STA-` |
| `archive` | `archive` | original ID retained |
| `plans` | `plan` | `PLAN-` |
| `glossary` | `term` | `TERM-` |
| `models` | `model` | `MODEL-` |
| `specs` | `spec` | `SPEC-` |

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
