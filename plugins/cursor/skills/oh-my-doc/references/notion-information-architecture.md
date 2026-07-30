# Notion information architecture

Path: `skills/oh-my-doc/references/` (name **`references`**, not `ref`).

Machine-readable companion: `notion-ia-graph.json` (`schemaVersion` 2.0).
Local Fumadocs still uses `handbook-ia-graph.json` (full tree).

## Agent stack (`stacked-on-home`)

Default Notion `sourcesStrategy` is **`stacked-on-home`**.

- The user-supplied Notion root **is** Home (`pages.home`, role `home`).
- **All catalog databases** are children of Home and rendered **inline**,
  stacked vertically on that one page.
- **No** catalog child pages, Vision/Workflow pages, or sidebar chrome.
- Agents read/write catalog rows in the inline DBs on Home.

```text
Home (user-supplied notion-root = pages.home)
├── intro (short plain body)
├── # Glossary → inline DB
├── # Models → inline DB
├── # Policies → inline DB
├── # PRDs → inline DB
├── # Stories → inline DB
├── # Data model → inline DB
├── # System model → inline DB
├── # Plans → inline DB
└── # ADRs → inline DB
```

Do not emit `ensure_page` for catalog indexes. Do not emit sidebar `<columns>`
chrome for Notion SSOT.

## Catalog write destinations

| Kind | Notion destination |
|---|---|
| PRD | Row in `dbs.prds` on Home |
| Story | Row in `dbs.stories` on Home |
| Plan | Row in `dbs.plans` on Home |
| ADR | Row in `dbs.adrs` on Home |
| Spec | Row in `dbs.data-model` / `dbs.system-model` on Home |

Machine map: `notion-ia-graph.json` → `kindToDatabase`.
