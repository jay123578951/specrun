# Changelog

## 0.2.0 — 2026-05-04

Initial post-launch maintenance: fix command registration, align Coder skill rules between Tier 2 and Tier 3, and resync version metadata so `/plugin update` could pick up changes.

### Fixed

- Command files (`/code:feat`, `/code:fix`, `/code:review`) used non-standard frontmatter fields (`name`, `category`, `tags`) that Claude Code refused to register. Replaced with the standard `description` + `argument-hint` schema, and added `$ARGUMENTS` so commands forward arguments to their underlying skills.
- `marketplace.json` and `plugin.json` versions were out of sync, blocking `/plugin update` from detecting the new release. Both manifests now share the same version string.

### Changed

- Coder skill rules are now identical between `/code:feat` (Tier 3) and `/code:fix` (Tier 2): `vue-best-practices` moved from optional to required in `code-fix`, so cross-file fixes don't drift in style from feature work. Tier differences are now expressed in flow (Spectra integration, Reviewer) rather than in style strictness.
- `pnpm` / `turborepo` skill triggering now uses objective signals (`package.json`'s `packageManager` field, `pnpm-lock.yaml`, `turbo.json`) instead of subjective task-content heuristics.
- `web-design-guidelines` skill triggering narrowed to `.vue` `<template>` / `<style>` blocks or pure stylesheet files (`.css` / `.scss` / `.sass` / `.less`); pure `<script>` changes no longer trigger UI/a11y review skill loading.

## 0.1.0 — 2026-04-29

Initial release. Migrated from `ai-oil-pollution-analysis` project-level setup to a standalone Claude Code plugin marketplace.

### Added

- `code` plugin containing three skills:
  - `code-feat` (Tier 3 SDD pipeline)
  - `code-fix` (Tier 2 lightweight pipeline)
  - `code-review` (standalone Codex-backed review)
- Slash commands `/code:feat`, `/code:fix`, `/code:review` (trampolines into the corresponding skills).
- `docs/ai-development-pipeline.md` — full methodology documentation.

### Changed (vs. the original project-level skills)

- Codex integration no longer relies on `${CLAUDE_PLUGIN_ROOT}` (which would resolve to this plugin's root, not openai-codex's). Both `code-feat` and `code-review` now auto-discover `codex-companion.mjs` under `~/.claude/plugins/cache/openai-codex/codex/*/scripts/`, overridable via `CODEX_COMPANION`.
- Removed hardcoded openai-codex path/version from `code-review` Step 3.
- Generalized project-specific review checks: removed `.glass-card`, `14px / 24px+` examples; replaced with "follow project design system conventions" and "rules defined in project CLAUDE.md".
- `code-fix` Spec impact check now references only `openspec/specs/` and "design-document locations defined in project CLAUDE.md", removing the project-specific `docs/plans/` paths.
