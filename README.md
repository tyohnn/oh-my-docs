# Oh My Docs

Oh My Docs turns a Fumadocs handbook into the docs-first working surface for
product development. Agents install one skill (`oh-my-doc`) and drive a bundled
Node runtime — users do not run a public CLI.

## Install

Ask your coding agent:

```text
Oh My Docs 스킬을 설치하고 이 프로젝트를 세팅해줘

https://github.com/ssota-labs/oh-my-docs
```

The agent should run:

```bash
npx skills add ssota-labs/oh-my-docs --skill oh-my-doc -y
node <skill>/scripts/omd.mjs inspect --json
node <skill>/scripts/omd.mjs adopt --yes --json
node <skill>/scripts/omd.mjs check --json
```

## UI distribution

- Docs shell: **Fumadocs via npm** (`fumadocs-ui`, `fumadocs-core`, `fumadocs-mdx`)
- Planning vocabulary: **copied from the skill template** by `adopt` (no shadcn registry)
- Skill updates do not rewrite the project — re-run `adopt` (use `--force` if
  `packages/docs-ui` diverged) after updating the skill

## Optional host plugins

Plugin wrappers mirror `skills/oh-my-doc` for marketplace discovery. They do not
own a separate runtime.

| Host | Marketplace |
|---|---|
| Claude Code | `.claude-plugin/marketplace.json` |
| Cursor | `.cursor-plugin/marketplace.json` |
| Codex | `.agents/plugins/marketplace.json` |

## Develop this repository

```bash
pnpm install
pnpm sync:skills
pnpm check:ui-snapshot
pnpm check:planning
pnpm test
pnpm build
```

Maintainer runtime entrypoint:

```bash
pnpm omd -- help
```
