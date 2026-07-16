# 13 — External Tooling (Fastlane, Maestro, Preview-Kit, Website)

Four external toolchains support the app: **Fastlane** for App Store text metadata, **Maestro** for E2E + App
Store preview videos, and a **Vite** marketing site on GitHub Pages. All are language-aware and share the same
16-locale content spine so nothing drifts.

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
- **Invocation**: `npm run release:ios:metadata` → guards (no `REPLACE_ME` placeholders) → `fastlane deliver`.

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

## Marketing website (`website/`)

A static marketing + legal site: **Vite 8 + TypeScript 5.9, no runtime framework** (vanilla TS DOM). Deployed to
GitHub Pages.

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
  record limit). These URLs are referenced by the Fastlane metadata — don't rename without regenerating.
- **Deploy**: `.github/workflows/deploy-website.yml` (see [12](12-build-release-cicd.md)) → GitHub Pages at
  **https://zii144.github.io/flash-accounting/**. Post-launch checklist: set `APP_STORE_URL` in `src/config.ts` when
  the app goes live. (Per memory: the app is not yet live as of 2026-07-15, so the badge shows "coming soon".)

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
