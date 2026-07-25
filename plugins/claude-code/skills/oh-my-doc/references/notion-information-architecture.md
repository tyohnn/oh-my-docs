# Notion information architecture

Path: `skills/oh-my-doc/references/` (name **`references`**, not `ref`).

Machine-readable companion: `notion-ia-graph.json`.

Catalog destinations are **pages** that embed their database **inline**. The
navigable object is the page; the database is not a top-level sidebar target.

```text
Handbook root (user supplied)
├── columns
│   ├── sidebar callout (mentions) + sources toggle
│   └── Home body
├── Vision (page)
├── Start here (page)
├── Workflow (page)
│   ├── Workflow Planning (page)
│   └── Development (page)
├── Domain (page)
│   ├── Glossary (page → inline DB)
│   ├── Models (page → inline DB)
│   └── Policies (page → inline DB)
├── Planning (page)
│   ├── PRDs (page → inline DB)
│   └── Stories (page → inline DB)
├── Spec (page)
│   ├── Data model (page → inline DB)
│   ├── System model (page → inline DB)
│   └── CLI (page)
├── Plans (page → inline DB)
└── ADRs (page → inline DB)
```

Managed page and database children live under a single **데이터 원본** toggle on
the root (or equivalent sources container). Sidebar navigation uses page
mentions only — never bare URLs as the primary nav.

Stable OMD keys use the form `pages.<id>` and `dbs.<id>`. See
`notion-ia-graph.json` for parents, inline embedding, and provision order.
