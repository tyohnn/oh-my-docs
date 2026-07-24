# Notion page body templates

Notion-flavored Markdown with placeholders. Substitute from state mappings
after pages exist. Do not use Notion HTML export as input.

## Shared sidebar (inactive)

```markdown
<columns>
	<column>
		<callout icon="📌" color="gray_bg">
			<mention-page url="{{pages.home}}"/>
			<mention-page url="{{pages.vision}}"/>
			<mention-page url="{{pages.starting}}"/>
			<mention-page url="{{pages.workflow}}"/>
			<mention-page url="{{pages.domain}}"/>
			<mention-page url="{{pages.planning}}"/>
			<mention-page url="{{pages.spec}}"/>
			<mention-page url="{{pages.prds}}"/>
			<mention-page url="{{pages.plans}}"/>
			<mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column>
{{BODY}}
	</column>
</columns>
```

## Active Spec (double layer example)

When the current page is Spec or a Spec child, replace the Spec line with a
yellow parent plus indented children:

```markdown
{color="yellow_bg"}<mention-page url="{{pages.spec}}"/>
	<mention-page url="{{pages.data-model}}"/>
	<mention-page url="{{pages.system-model}}"/>
	<mention-page url="{{pages.cli}}"/>
```

Apply the same pattern for Workflow, Domain, and Planning per
`notion-sidebar.md`.

## Root sources toggle

Under the handbook root (managed children container):

```markdown
▸ 데이터 원본
```

Managed pages/databases that should not clutter the primary sidebar live inside
this toggle after creation. Navigation still uses mentions to wrapper pages.
