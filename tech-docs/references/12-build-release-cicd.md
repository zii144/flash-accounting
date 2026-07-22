# 12 — Build, Release & CI/CD

iOS ships via a **local Xcode + Fastlane** pipeline (not EAS). EAS is retained for dev/simulator/preview builds
and for Android. CI runs quality gates + deploys the marketing site.

## EAS profiles — `eas.json`

`cli`: version `>= 16.28.0`, `appVersionSource: "remote"`.

| Profile | Config | npm wrapper |
|---|---|---|
| **development** | `developmentClient: true`, `distribution: internal` | `build:android:dev` |
| **preview** | `distribution: internal` | — |
| **ios-simulator** | extends development + `ios.simulator: true` | `build:ios:sim` |
| **production** | `autoIncrement: true` | `build:ios:prod` / `build:android:prod` |

Submit: `production` (empty) → `submit:ios:prod` / `submit:android:prod`. Note: although `submit:ios:prod` exists,
`RELEASE_IOS.md` explicitly says **do not use EAS for the production iOS archive/upload** — that goes through the
local pipeline below.

## Local iOS release pipeline — `scripts/release-ios.sh`

`set -euo pipefail`. Constants: workspace `ios/flashaccounting.xcworkspace`, scheme `flashaccounting`, archive
`ios/build/flashaccounting.xcarchive`, export `ios/build/export` via `ios/ExportOptions.plist`, bundle
`com.zii.flash.accounting`. Subcommands (npm `release:ios:*`):

- **check** — `npm ci` → `npx pod-install` → `typecheck` → `test` → `expo install --check` → `verify:ios:env` → version drift check.
- **bump** — reads current build number; uses env `BUILD_NUMBER` or `+1`; rewrites `app.json` `expo.ios.buildNumber`, then syncs Info.plist.
- **versions** — prints `app.json` version(build) vs Info.plist `CFBundleShortVersionString`(`CFBundleVersion`) — a drift check.
- **archive** — `xcodebuild archive -configuration Release -destination generic/platform=iOS`, `CODE_SIGN_STYLE=Automatic`,
  `DEVELOPMENT_TEAM=8KKMD5SMNP`, `PRODUCT_BUNDLE_IDENTIFIER=com.zii.flash.accounting`. Requires `.env` present.
- **upload** — `xcodebuild -exportArchive` with `ExportOptions.plist` + `-allowProvisioningUpdates` → App Store Connect / TestFlight.
- **testflight** — `check` (unless `SKIP_CHECKS=1`) → `archive` → `upload` (unless `SKIP_UPLOAD=1`).
- **metadata** — text-metadata only: guards (fastlane installed, metadata + ASC key exist, aborts if any `REPLACE_ME` placeholder remains) → `fastlane deliver` with `skip_binary_upload`/`skip_screenshots` (`--force` when `FORCE=1`).
- **screenshots** — screenshots only (commit `31cd206`): runs `node scripts/gen-appstore-screenshots.mjs` to (re)build the deliver screenshot tree, verifies PNGs exist, then `fastlane deliver --skip_binary_upload true --skip_metadata true --skip_screenshots false --overwrite_screenshots true` (`--force` when `FORCE=1`). Deliberately split from **metadata** so a copy tweak never re-uploads the whole gallery, and vice-versa. See [13](13-external-tooling.md) for the generator.
- **open** — `xed ios`.

**Versioning model**: marketing version from `app.json` `expo.version`; build number from `app.json`
`expo.ios.buildNumber`; `sync_info_plist` writes both into `ios/flashaccounting/Info.plist` via PlistBuddy. Because
`ios/` is checked in, the native Info.plist is the source of truth at archive time. Current: version **1.0.4**,
build **13**.

**`ios/ExportOptions.plist`**: `method=app-store-connect`, `destination=upload`, `uploadSymbols=true`,
`manageAppVersionAndBuildNumber=false` (Xcode won't auto-bump — the script owns versioning).

`RELEASE_IOS.md` documents the full flow + the manual Xcode Organizer path, a device-QA checklist, and an upgrade
playbook. Required release env: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`, `EXPO_PUBLIC_SENTRY_DSN`; must **not** ship
`EXPO_PUBLIC_REVENUECAT_API_KEY_TEST`.

## `scripts/verify-ios-env.sh`

Proves the production JS bundle actually **inlines** `EXPO_PUBLIC_*` values (guards against Expo not statically
inlining a var). Bundles a Release JS bundle the way Xcode does (`expo export:embed --platform ios --dev false
--reset-cache`), then greps the bundle:
- **Required** (fail if missing): Firebase `API_KEY`/`AUTH_DOMAIN`/`PROJECT_ID`/`APP_ID`, RevenueCat `IOS` key +
  `PRO`/`PLUS` entitlement IDs + `OFFERING_ID`.
- **Optional** (warn): `SENTRY_DSN`, Google client IDs.
- **Safety**: warns if `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` is present in the bundle.

Invoked standalone (`verify:ios:env`) and inside `release-ios.sh check`.

## Native configuration

- **iOS** (`ios/`): Hermes, deployment target 16.4, CocoaPods + Expo autolinking, prebuilt-RN-core toggles,
  react-native-screens Fabric. Sentry native via `metro.config.js` (`getSentryExpoConfig`) + `ios/sentry.properties`
  (org/project/auth-token from env; no secrets committed); `.xcode.env.local` sets `SENTRY_DISABLE_AUTO_UPLOAD` for
  local dev.
- **Android** (`android/`): applicationId `com.zii.flash.accounting`, versionCode 1 / versionName 1.0.0 (Android
  versioning **not** automated), Hermes on, New Architecture, edge-to-edge, arches
  `armeabi-v7a,arm64-v8a,x86,x86_64`. ⚠️ **Release build currently signs with the debug keystore** — must generate
  a real upload keystore before Play Store.

Full Expo plugin/permission list is in [02](02-tech-stack.md).

## CI — `.github/workflows/`

### `quality.yml` — "Quality"
Triggers on `pull_request` and `push` to `main`/`master`. `permissions: contents: read`. One job on
`ubuntu-latest`: checkout → setup-node (Node **22**, npm cache) → `npm ci` → `npm run lint` → `npm run typecheck`
→ `npm test`. **No native build or Maestro in CI.**

### `deploy-website.yml` — "Deploy website" (GitHub Pages)
Triggers on `push` to `main` filtered to `website/**`, `fastlane/metadata/**`, or the workflow file, plus
`workflow_dispatch`. `permissions: contents:read, pages:write, id-token:write`; `concurrency: pages,
cancel-in-progress`. **build** job (Node 22): `configure-pages` → `npm ci` + `npm run build` in `website/` →
`upload-pages-artifact` from `website/dist`. **deploy** job: `deploy-pages`. Target
**https://zii144.github.io/flash-accounting/**. (Since 2026-07-20 the store's support/marketing/privacy URLs point
at the separate `flash-accounting-landing-page` repo's Pages deployment,
https://zii144.github.io/flash-accounting-landing-page/ — see `scripts/gen-appstore-metadata.mjs`.)

## Release command cheatsheet

```bash
npm run release:ios:check       # deps, typecheck, tests, env verification, version drift
npm run release:ios:bump        # bump iOS build number (app.json + Info.plist)
npm run release:ios:archive     # local Release .xcarchive
npm run release:ios:upload      # export + upload to App Store Connect
npm run release:ios:testflight  # check → archive → upload (full local pipeline)
npm run release:ios:metadata    # fastlane deliver (text metadata, 16 locales)
npm run release:ios:screenshots # gen-appstore-screenshots.mjs + fastlane deliver (screenshots only)
npm run build:android:prod      # EAS Android production build
npm run submit:android:prod     # EAS Android submit
```

## Secrets handling (updated 2026-07-22)

The App Store Connect API credentials — `fastlane/asc_api_key.json` (key_id `Z55AUGKZFF`, issuer_id) and the signing
key `fastlane/AuthKey_Z55AUGKZFF.p8` — exist **only as local, untracked files** (`.p8` at mode `0600`). They are
git-ignored (`.gitignore`: `*.p8`, `fastlane/AuthKey_*.p8`, `fastlane/asc_api_key.json`) and **absent from git
history** (`git log --all -- <path>` returns nothing); only `fastlane/asc_api_key.example.json` is tracked. This
supersedes the v1.0.0 finding, which reported the `.p8` as committed to the repo — it is not committed in the current
tree or history.

- **Still true / lower severity:** the iOS `DEVELOPMENT_TEAM 8KKMD5SMNP` (and the ASC `key_id`/`issuer_id`) are
  hardcoded in `scripts/release-ios.sh`. These are identifiers, not secrets, but are worth parameterizing.
- **Residual caution:** if the `.p8` was ever pushed to a remote before the current ignore rules landed, rotating the
  key in App Store Connect remains prudent (a `.p8` can be downloaded only once from Apple). Verify remote history
  independently before assuming it never leaked. See [15](15-roadmap-and-caveats.md).
