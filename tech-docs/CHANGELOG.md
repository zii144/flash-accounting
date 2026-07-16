# Changelog — Flash Accounting Technical Blueprint

All notable changes to the `tech-docs/` blueprint are recorded here. This changelog
versions the **documentation**, not the app. The app's own version is tracked in
`app.json` (currently v1.0.4, build 13).

Format follows [Keep a Changelog](https://keepachangelog.com/); versioning is
[SemVer](https://semver.org/) applied to the docs:

- **MAJOR** — the blueprint is restructured or a described subsystem is rewritten such that
  prior references no longer map (e.g. a new architecture).
- **MINOR** — a new reference doc or a substantive new section is added, or the described
  app version changes in a way that adds/removes capabilities.
- **PATCH** — corrections, clarifications, and small fact updates that don't change structure.

When you update the docs: bump the version in `SKILL.md` frontmatter (`metadata.version`),
update `metadata.lastUpdated`, update the Document Control block date, and add an entry below.

---

## [1.0.0] — 2026-07-16

**Author:** Zii — developer & architecture manager.
**Describes:** app v1.0.4 (build 13) — Expo SDK 56 / React Native 0.85 / React 19, `main` branch.

### Added — initial release of the blueprint

Full "ultra" pass over the project, distilled into a portable, skill-shaped documentation
set (`SKILL.md` entry + `references/`). New files, all authored today:

- `SKILL.md` — entry point: summary, navigation map, repo layout, quick facts, document control.
- `CHANGELOG.md` — this file.
- `references/01-product-overview.md` — capabilities, tiers, product model, platform status.
- `references/02-tech-stack.md` — every dependency + version, Expo/Metro/TS config, env vars, native config.
- `references/03-architecture.md` — architectural style, layering, expo-router routing, the 10-provider dependency DAG, data flow.
- `references/04-state-and-hooks.md` — all 6 contexts + 4 hooks, state, persistence, public API.
- `references/05-data-layer-and-sync.md` — SQLite schema, data model, offline queue, Firestore sync engine, validation, CSV, seed.
- `references/06-smart-features.md` — the on-device heuristic "AI" (glossary labeling, suggestions, inference, dictation, speech).
- `references/07-internationalization.md` — 16 languages, locale detection, translation tables, glossary i18n, parity tests.
- `references/08-design-system.md` — liquid-glass aesthetic + design tokens (color/type/spacing/radii/material).
- `references/09-ui-components.md` — screens, glass primitives, sheets/modals, SVG charts inventory.
- `references/10-monetization-and-auth.md` — RevenueCat tiers/entitlements, Firebase auth, Apple/Google OAuth, pricing + Pro 1+1 plans.
- `references/11-testing.md` — node:test + tsx runner, 13-file test inventory, production-readiness gate.
- `references/12-build-release-cicd.md` — EAS profiles, local iOS pipeline, native config, GitHub Actions CI.
- `references/13-external-tooling.md` — Fastlane metadata automation, Maestro E2E + preview-kit, marketing website.
- `references/14-conventions-and-agent-skills.md` — coding conventions, repo layout, bundled Expo agent skills.
- `references/15-roadmap-and-caveats.md` — current caveats, phased roadmap, and findings surfaced during mapping.

### Notes recorded at authoring time

- Clarified that the app's "smart" features are **deterministic on-device heuristics**, not LLM/ML/cloud AI (see `references/06`).
- Flagged a security finding: `fastlane/asc_api_key.json` + `fastlane/AuthKey_Z55AUGKZFF.p8` (a real App Store Connect signing key) appear committed to the repo (see `references/12` and `references/15`). **Not modified** — recommended rotation + history purge.
- Recorded incidental correctness observations (unconditional `totalCount` increment on overwrite; full-snapshot cloud reads; Android debug-keystore signing) in `references/15`.

_No application source code was modified by this blueprint — it is additive documentation only._
