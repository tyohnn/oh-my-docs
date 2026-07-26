# Notion sidebar chrome

Every managed content page uses the same two-column chrome. Provision must write
this chrome for **all** `pages.*` keys — not only Home/Spec.

1. Left column (`ratio="20"`): callout containing the shared nav mentions.
2. Right column (`ratio="80"`): page body (and preserved child page/database blocks
   below the columns).

## Active highlight

Nav items are **bulleted mentions**. Emit highlight in the form Notion
round-trips (suffix, not prefix):

```markdown
- <mention-page url="{{pages.spec}}"/> {color="yellow_bg"}
```

## Double layer

When the section or one of its children is current, the parent bullet keeps
`yellow_bg` and children render as **indented nested bullets** beneath it
(open sidebar-group appearance).

| Parent | Nested children when active |
|---|---|
| Workflow | Workflow Planning, Development |
| Domain | Glossary, Models, Policies |
| Planning | PRDs, Stories |
| Spec | Data model, System model, CLI |

Inactive groups stay collapsed (no nested bullets).

## Top-level nav

Home · Vision · Start here · Workflow · Domain · Planning · Spec · PRDs · Plans · ADRs

## Child preservation

`replace_content` must re-emit existing child `<page>` and `<database inline>`
blocks after the columns. Omitting them deletes children or fails validation.

## Machine validation

Runtime helpers:

- `renderSidebarPageContent` — emit chrome
- `validateSidebarChrome` — assert columns, callout, yellow active group, nested
  bullets for every page body
- `validateManifestSidebarChrome` — run over all `write_page_body` ops

`planProvision` and `omd check` (notion) fail when chrome validation fails.

Runtime path: `runtime/content-sources/sidebar.mjs`.
