# Notion page body templates

Notion-flavored Markdown with placeholders. Substitute from state mappings
after databases exist.

## Stacked Home (current)

```markdown
Oh My Docs handbook (agent SSOT). Catalogs are stacked inline databases on this page — no child pages, no sidebar.

# Glossary
<database url="{{dbs.glossary}}" inline="true">Glossary</database>

# Models
<database url="{{dbs.models}}" inline="true">Models</database>

# Policies
<database url="{{dbs.policies}}" inline="true">Policies</database>

# PRDs
<database url="{{dbs.prds}}" inline="true">PRDs</database>

# Stories
<database url="{{dbs.stories}}" inline="true">Stories</database>

# Data model
<database url="{{dbs.data-model}}" inline="true">Data model</database>

# System model
<database url="{{dbs.system-model}}" inline="true">System model</database>

# Plans
<database url="{{dbs.plans}}" inline="true">Plans</database>

# ADRs
<database url="{{dbs.adrs}}" inline="true">ADRs</database>
```

Runtime builds this with `renderStackedHomeContent`.
