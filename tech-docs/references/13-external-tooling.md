# 13 — External Tooling (Fastlane, Maestro, Preview-Kit, Websites)

External toolchains support the app: **Fastlane** for App Store text metadata + screenshots, a Node **screenshot
layout generator**, **Maestro** for E2E + App Store preview videos, and **two** marketing sites on GitHub Pages
(an in-repo Vite site and a separate Next.js landing repo). All are language-aware and share the same 16-locale
content spine so nothing drifts.

## Fastlane — App Store text-metadata automation (`fastlane/`)

Scope is **text metadata only** (name, subtitle, description, keywords, URLs, release notes) — no binary upload, no
screenshots (`Deliverfile`: `skip_binary_upload(true)`, `skip_screenshots(true)`, `skip_metadata(false)`).

- **Auth**: App Store Connect API key via `fastlane/asc_api_key.json` (`api_key_path`). `Appfile` sets
  `app_identifier("com.zii.flash.accounting")`.
- **Metadata tree**: app-level `copyright.txt` / `primary_category.txt` (FINANCE) / `secondary_category.txt`
  (PRODUCTIVITY), then one folder per **16 locales** (en-US, zh-Hant, ja, ko, es-ES, fr-FR, de-DE, it, pt-BR, ru,
  hi, id, vi, th, tr, pl), each with `name/subtitle/promotional_text/description/keywords/release_notes` +
  `support_url/marketing_url/privacy_url` (all pointing at the GitHub Pages site). App Review notes live in
  `fastlane/review_information.local/notes.txt` (kept out of `metadata/` so deliver doesn't PATCH incomplete contact fields).
- **Generator** — `scripts/gen-appstore-metadata.mjs` (`npm run appstore:metadata:gen`): 16 canonical copy objects
  with native display names (黑白記帳, 白黒家計簿, SchwarzWeiß Finanzen…), full localized descriptions/keywords. Validates
  Apple length limits per locale by Unicode code-point count (`name`/`subtitle` 30, `promotional_text` 170,
  `keywords` 100) and exits non-zero on violations. **Non-destructive** — skips existing `.txt` files unless
  `--force`, so the committed files are the source of truth. `fastlane/TRANSLATION_STATUS.md` tracks all 16 locales as final.
- **Copy is native-authored per market** (refreshed for all 16 locales in commit `0994ef2` — 82 files, +482/−453):
  description/keywords/promotional_text/release_notes/subtitle are colloquial and market-specific (口語化 zh-Hant, etc.),
  not machine-translated. Current EN positioning: subtitle "Spot ghost spending in seconds"; the cross-locale theme is
  "ghost / 无感 spending," 3-second frictionless logging, offline/private, optional Pro cloud sync. Name stays "Black
  White Accounting" / "黑白記帳".
- **Invocation**: `npm run release:ios:metadata` → guards (no `REPLACE_ME` placeholders) → `fastlane deliver`.

## Screenshot layout generator — `scripts/gen-appstore-screenshots.mjs`

Added in commit `31cd206` alongside the `release:ios:screenshots` command (see [12](12-build-release-cicd.md)). A
**dependency-free** Node ESM script (only `node:fs`/`path`/`url`) — it does **not** draw device frames or overlay
text; it is a *file-layout* generator that mirrors raw device captures into the fastlane deliver tree with
order-fixing filenames.

- **Input**: `captures/ios26-iphone17-pro-max/screenshots/<prefix>-<screen>.png` — real 6.9" iPhone captures at
  **1320×2868** portrait (landscape `2868×1320` also accepted). A tiny built-in PNG-header reader validates each
  file's dimensions and aborts on mismatch.
- **Output**: `fastlane/screenshots/<ASC-locale>/NN_<screen>.png` (Apple's `APP_IPHONE_67` slot). The whole output
  dir is wiped and rebuilt each run (a removed capture never lingers); the `NN_` numeric prefix fixes on-store display
  order because `deliver` sorts screenshots alphabetically.
- **Order & locales**: `SCREEN_ORDER = [accounting, statistics, settings, language]` (unknown screens appended, never
  dropped); `LOCALE_MAP` maps 13 capture prefixes → ASC locales (`de→de-DE`, `en→en-US`, `zh→zh-Hant`, …). It reads
  `fastlane/metadata/` (16 locales) to decide which locales to emit and reports each as full / partial / **NONE** (a
  NONE locale falls back to the primary language, en-US, on the store).
- **In practice** captures exist for only ~6 languages (en, zh, de, es, fr, ja), so most locales fall back to en-US.
  Both `captures/` and `fastlane/screenshots/` are git-ignored — captures are the source of truth, the deliver tree is
  a regenerable artifact.

## Maestro — E2E smoke test (`.maestro/smoke.yaml`)

`npm run test:e2e` = `maestro test .maestro/smoke.yaml` against a dev-client build on the iOS Simulator
(`appId: com.zii.flash.accounting`). Flow: launch → (optional dev-client "Open") → log an expense via stable
testIDs (`amount-input` `12.5`, `description-input` "Maestro smoke", `add-expense-button`) → assert the row is
visible → Statistics tab → drive `stat-time-week` / `stat-time-month`. Native tabs (iOS 26 floating pill) have no
testID so they're tapped by coordinate; fields use stable testIDs, so the flow is language-independent. Requires a
dev client on the simulator + Metro running + Maestro installed. **Not run in CI.**

## Maestro + ffmpeg — App Store preview-video pipeline (`captures/preview-kit/`)

Produces per-language `preview_<lang>.mp4` (≤30s, 4 feature clips) + a 16-language `preview_montage.mp4`, targeting
**886×1920 portrait, 30fps, H.264 High@4.0, yuv420p, silent AAC, ≤500MB** (iPhone 6.9"). Rationale: the app UI is
native (native tabs, Liquid Glass, RevenueCat paywall), so a browser driver can't drive it — Maestro on the
Simulator + ffmpeg is used instead.

- **`scripts/config.env`**: `DEVICE` default `iPhone 16 Pro Max`; `ALL_LANGS` (16); `CLIP_ORDER = (logging diagram
  statistics darkmode)`; per-clip trim seconds (~26s total); localized expense word per language.
- **`scripts/run.sh`**: `record.sh` → `encode.sh` → `assemble.sh`.
- **`record.sh`**: resolves/boots the simulator, sets a clean **9:41 status bar**, runs `sub_setup.yaml` off-camera
  to switch language + seed data, records logging/diagram/statistics clips (light), and for darkmode schedules a
  live `simctl ui appearance dark` flip mid-recording. Uses `simctl io recordVideo --codec=h264`, finalized with
  SIGINT (not KILL).
- **`record-direct.sh`**: robust alternative that writes `@flash_accounting_language` directly into AsyncStorage's
  `manifest.json` while the app is terminated (bypassing the in-app sheet), then reboots via dev-client deep link.
- **`encode.sh`**: normalizes each raw clip to 886×1920 (`scale…increase,crop`, `fps=30`, `format=yuv420p`,
  `libx264 -profile high -level 4.0`).
- **`assemble.sh`**: **tail-based trimming** (Maestro's ~8s startup runs during recording, so the real interaction
  is at the clip's end — keep the last N seconds), adds a silent AAC track, `+faststart`, asserts a 15–30s duration,
  then builds the 16-language montage from 1.2s tails of each statistics clip.
- **Flows** (`flows/*.yaml`): `sub_setup` (off-camera language + seed), `clip_logging`/`clip_diagram`/
  `clip_statistics`/`clip_darkmode`, `_normalize`/`_dev_open` (dev helpers).
- **Known limits**: seed history localizes for only 6 languages (en/zh/es/fr/de/ja); others fall back to English
  merchant names; simulator-sourced previews are a soft App Store review risk.

The screenshots that ship with the repo live in `captures/ios26-iphone17-pro-max/screenshots/` (per-language
accounting/statistics/settings/language shots), and are also the source for the website's images.

## Marketing sites — there are TWO

There are **two** landing sites with two GitHub Pages targets. Know which is which:

| Site | Dir | Stack | Pages URL | Store-linked? |
|---|---|---|---|---|
| In-repo marketing site | `website/` | Vite 8 + vanilla TS | `zii144.github.io/flash-accounting/` | **No** (as of 2026-07-20) |
| Separate landing repo | `flash-accounting-landing-page/` | Next.js (static export) + Tailwind, pnpm | `zii144.github.io/flash-accounting-landing-page/` | **Yes — the live store target** |

The **App Store metadata URLs** (`marketing_url`/`support_url`/`privacy_url`, set by `scripts/gen-appstore-metadata.mjs`
via `WEBSITE_BASE = https://zii144.github.io/flash-accounting-landing-page`, switched over in commit `67f8977`) point
at the **Next.js** site — see [flash-accounting-landing-page](#the-live-landing-repo--flash-accounting-landing-page)
below. ⚠️ The in-repo Vite `website/` (its `README.md` / `vite.config.ts`) **still describes itself as the store
target** — that self-description is stale.

### In-repo Vite site (`website/`)

A static marketing + legal site: **Vite 8 + TypeScript 5.9, no runtime framework** (vanilla TS DOM). Deployed to
GitHub Pages. It got a **monochrome redesign** in commit `38f59f4`: `src/styles.css` was reworked onto a black/
white/gray design system (grayscale ramp with light + `prefers-color-scheme: dark` variants, `--ink`/`--on-ink` as
the only "accent," fonts Syne display + Manrope body), replacing the prior iOS-glass token set, and `index.html`
gained numbered section eyebrows (`01/02/03` — Features / Screenshots / Languages).

- **Stack**: `website/package.json` devDeps only; `vite.config.ts` multi-page build (`index.html`, `privacy.html`,
  `terms.html`, `support.html`), `base` defaults to `/flash-accounting/` (overridable via `WEBSITE_BASE`).
- **Source** (`src/`):
  - `main.ts` — landing runtime: `detectLang()` (from `?lang=`, `localStorage`, or `navigator.languages`),
    `render(lang)` swaps text via `data-*` hooks, builds feature cards from the App Store description, sets
    localized screenshots (English fallback), builds the language picker; store badge shows a real App Store link
    when `APP_STORE_URL` is set, else a localized "coming soon" pill; `IntersectionObserver` reveal animations.
  - `chrome.ts` — site-chrome strings for all 16 languages.
  - `config.ts` — `APP_STORE_URL` (currently `null`), `SUPPORT_EMAIL` (`quickpolymath@gmail.com`),
    `GITHUB_ISSUES_URL`, `COPYRIGHT`.
  - `legal.ts` — EN/繁中 toggle for privacy/terms/support (English governing).
  - `styles.css` — mirrors `docs/design-tokens.json` (fonts Manrope + Syne).
  - `generated/content.json` — build artifact (16 locales), not hand-edited.
- **Content sync** (`scripts/sync-content.mjs`): the **single source of truth for marketing copy is the App Store
  metadata tree** `fastlane/metadata/<locale>/*.txt`, so site and store never drift. Maps 16 website codes → ASC
  locale folders, reads name/subtitle/promo/description, splits the description into feature cards, and writes
  `content.json`. Runs automatically inside `dev`/`build`. `scripts/prepare-assets.sh` (macOS `sips`) regenerates
  `public/` images from the app icon + captured screenshots (committed, so CI needn't run it).
- **Pages**: `index.html` (localized landing), `privacy.html`/`terms.html`/`support.html` (EN + 繁中; `support` is a
  FAQ covering data storage, CSV backup/restore, cancelling Pro, cloud-sync recovery, changing language, the free
  record limit).
- **Deploy**: `.github/workflows/deploy-website.yml` (see [12](12-build-release-cicd.md)) → GitHub Pages at
  **https://zii144.github.io/flash-accounting/**. Post-launch checklist: set `APP_STORE_URL` in `src/config.ts` when
  the app goes live. (Per memory: the app is not yet live as of 2026-07-15, so the badge shows "coming soon".)

### The live landing repo — `flash-accounting-landing-page/`

A **separate project**, untracked in this repo (`git status` shows `?? flash-accounting-landing-page/`) and its **own
nested git repo** (remote `github.com/zii144/flash-accounting-landing-page`). It is present as a local folder inside
the app repo root but is **not part of it**.

- **What it is**: a **Next.js** app (v0.dev-generated; `package.json` name `my-v0-project`), React + Radix UI +
  Tailwind, managed with **pnpm**. `next.config.mjs`: `output: 'export'` (static), `basePath` from
  `NEXT_PUBLIC_BASE_PATH`, `trailingSlash: true`, unoptimized images. Routes: `app/[locale]/page.tsx`
  (`generateStaticParams` prebuilds every locale), `app/{privacy,terms,support,data}`, `manifest.ts`, `sitemap.ts`,
  `robots.ts`, `opengraph-image.tsx`, plus `llms.txt`/`llms-full.txt`; `lib/locales/` has **16 language files**.
- **Deploy**: its own `.github/workflows/deploy.yml` (pnpm build → `out` → `.nojekyll`) → GitHub Pages at
  **https://zii144.github.io/flash-accounting-landing-page/** (`/privacy/`, `/terms/`, `/data/`, `/support/`). This is
  the site the App Store listing links to; `scripts/gen-appstore-metadata.mjs` (`WEBSITE_BASE`) is the source of truth
  for those URLs.
- ⚠️ **Local-tooling note**: because it ships its own `tsconfig.json`/`package.json` and the app's root
  `tsconfig.json` only excludes `node_modules`/`website`, having this folder present makes `npm run typecheck` (and
  `release:ios:check`) fail on phantom errors. CI is unaffected (the folder is untracked). See
  [15](15-roadmap-and-caveats.md).

## How it all stays in sync

```
docs/marketing/  +  scripts/gen-appstore-metadata.mjs
        │  writes
        ▼
fastlane/metadata/<locale>/*.txt   ◄── single source of truth for store copy
        │                    │
        │ fastlane deliver   │ website/scripts/sync-content.mjs
        ▼                    ▼
   App Store listing     website/src/generated/content.json → GitHub Pages
```
