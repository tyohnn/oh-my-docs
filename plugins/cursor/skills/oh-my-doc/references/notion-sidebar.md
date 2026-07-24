# Notion sidebar chrome

Every managed content page uses the same two-column chrome:

1. Left column (~18–20%): callout containing the shared nav mentions.
2. Right column: page body (and inline database when the page is a catalog).

## Active highlight

Active section highlighting uses block background `yellow_bg` on the active
top-level mention.

## Double layer

Sections with children use a **double layer**: when the section or one of its
children is current, the parent mention keeps `yellow_bg` and children render
as indented mention blocks beneath it.

| Parent | Nested children when active |
|---|---|
| Workflow | Workflow Planning, Development |
| Domain | Glossary, Models, Policies |
| Planning | PRDs, Stories |
| Spec | Data model, System model, CLI |

## Top-level nav

Always present when not nested away:

Home/root · Vision · Start here · Workflow · Domain · Planning · Spec · PRDs · Plans · ADRs

## Template placeholders

Page body templates substitute mentions from `.omd/state.json` mappings:

| Placeholder | OMD key |
|---|---|
| `{{pages.home}}` | `pages.home` |
| `{{pages.vision}}` | `pages.vision` |
| `{{pages.starting}}` | `pages.starting` |
| `{{pages.workflow}}` | `pages.workflow` |
| `{{pages.workflow-planning}}` | `pages.workflow-planning` |
| `{{pages.development}}` | `pages.development` |
| `{{pages.domain}}` | `pages.domain` |
| `{{pages.glossary}}` | `pages.glossary` |
| `{{pages.models}}` | `pages.models` |
| `{{pages.policies}}` | `pages.policies` |
| `{{pages.planning}}` | `pages.planning` |
| `{{pages.prds}}` | `pages.prds` |
| `{{pages.stories}}` | `pages.stories` |
| `{{pages.spec}}` | `pages.spec` |
| `{{pages.data-model}}` | `pages.data-model` |
| `{{pages.system-model}}` | `pages.system-model` |
| `{{pages.cli}}` | `pages.cli` |
| `{{pages.plans}}` | `pages.plans` |
| `{{pages.adrs}}` | `pages.adrs` |

Notion-flavored Markdown for a callout mention line (after substitution):

```markdown
<callout>
<mention-page url="{{pages.vision}}"/>
</callout>
```

Active parent lines wrap the mention block with `{color="yellow_bg"}` (or the
host equivalent for block background).
