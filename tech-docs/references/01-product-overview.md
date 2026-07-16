# 01 — Product Overview

## What it is

**Flash Accounting** (App Store name **Black White Accounting** / 黑白記帳) is a
local-first personal accounting app for iOS, Android, and web, built with Expo and
React Native. It lets users record income and expenses quickly, review spending through
statistics and charts, import/export CSV, and — for paying users — sync to the cloud.

The defining product decision is **local-first with no forced sign-in**: everything
works offline on-device, and account/cloud/purchase/crash-reporting are all optional
layers that degrade gracefully when their environment configuration is absent.

## Capabilities (shipped and stable)

- Add, edit, delete, and paginate income/expense records.
- **SQLite-backed** local storage (`flash_accounting.db`) with soft deletes and a free-tier record cap (500 local records).
- **Statistics tab**: time filters (today / week / month / year / custom range), sort modes, day- and month-grouped history, and signed net totals.
- **Diagram tab**: pie (donut), treemap, bar, and line chart modes; tap-to-detail category breakdowns; custom date ranges; a mono/accent palette toggle.
- **CSV import and export** (RFC-4180 compatible).
- **Smart labeling / suggestions**: free-text descriptions are auto-categorized and suggested via an on-device heuristic glossary (see [06](06-smart-features.md)). The same canonicalization powers chart category grouping.
- **Speech-to-text dictation** for descriptions — iOS system-keyboard dictation on device; Web Speech API on web.
- **16 UI languages** + a Device (follow-system) option, with device-locale detection and a customizable "Smart Label Glossary."
- **Automatic light/dark theme** (follows the OS; no manual toggle).
- **Firebase auth** (Apple + Google) and **Firestore cloud sync** for signed-in Pro users.
- **RevenueCat** Plus and Pro entitlement handling with a native paywall.
- **Sentry** crash reporting wiring.

## Product / pricing model

Three tiers, resolved from RevenueCat entitlements (details in [10](10-monetization-and-auth.md)):

| Tier | Price (fallback labels) | Storage | Cloud sync |
|---|---|---|---|
| **Basic** | Free | Local only, **500-record cap** | No |
| **Plus** | **$14.99 lifetime** (`local_unlimited` entitlement) | **Unlimited local** | No |
| **Pro** | **$5.99/mo · $59/yr** (`cloud_sync_pro` entitlement) | Unlimited | **Yes** (Firestore, requires sign-in) |

Strategic framing from `plan/pricing_plan_20260527.md`: *Basic builds the habit → Plus
monetizes the anti-subscription/privacy segment at high margin → Pro drives MRR through
multi-device safety and couple/household collaboration.* A future **"Pro 1+1"** feature
(one subscription grants a second person Pro capability) is fully specified but not yet
implemented — see [15](15-roadmap-and-caveats.md).

## Platform status

- **iOS**: live, v1.0.4 (build 13), shipped via the local Xcode + Fastlane pipeline.
- **Android**: Gradle project and EAS profiles exist but **has not shipped**; the release build currently signs with the debug keystore (must be replaced before Play Store).
- **Web**: runs via `react-native-web` with a dedicated `_layout.web.tsx` tab layout; used mainly for simple screens and as the only surface with in-app Web Speech dictation.

## The "black and white" identity

The name and the default **monochrome** diagram palette reflect a deliberate minimalist,
iOS-native aesthetic — a translucent "liquid glass" surface language over grayscale-first
charts, with an optional accent palette. See [08](08-design-system.md).

## Where to read what

- Product tiers & entitlement mechanics → [10](10-monetization-and-auth.md)
- What actually powers the "smart" features → [06](06-smart-features.md)
- Current caveats, known gaps, and roadmap → [15](15-roadmap-and-caveats.md)
- The canonical in-repo status doc is `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md`; the product roadmap is `docs/ROADMAP.md`.
