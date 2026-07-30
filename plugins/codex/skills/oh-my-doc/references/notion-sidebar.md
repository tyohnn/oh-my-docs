# Notion page chrome

## Current SSOT: no sidebar

With `sourcesStrategy: stacked-on-home`, Notion handbooks **do not** use
sidebar columns or callout nav. Home is a single vertical stack of catalog
databases for agents.

Runtime helpers:

- `renderStackedHomeContent` — emit Home stack
- `validateManifestSidebarChrome` — for stacked strategy, asserts no sidebar
  chrome and that inline databases are present

## Legacy sidebar (local/human experiments only)

Older manifests used two-column sidebar chrome (`renderSidebarPageContent`,
yellow active leaf). That path remains in `sidebar.mjs` for tests/history but
is **not** emitted by Notion adopt when `stacked-on-home` is set.
