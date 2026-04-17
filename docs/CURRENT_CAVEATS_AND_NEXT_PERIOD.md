# Current caveats and next development period

Last updated: 2026-04-16

This document describes the **actual current state** of the codebase, the main caveats that still exist, and a recommended plan for the next development period.

Use this document as the source of truth for implementation status. Some higher-level copy in `README.md` describes the target product direction; this file describes the current working state.

## 1. Current implementation snapshot

### Stable and usable now

- Local-first expense/income logging with SQLite
- Add / edit / delete records
- Paginated accounting history
- Statistics screen with time filters, sort modes, grouped daily history, and net totals
- CSV export
- Language selection and localization
- Dark / light theme support
- Error boundary and basic structured logging
- Free local storage limit (`200` records)

### Implemented but config-dependent

- Firebase bootstrap and auth state handling
- Firestore-backed cloud storage for signed-in Pro users
- RevenueCat-backed Pro entitlement state
- Purchase and restore entry points in Settings
- Apple sign-in path in Settings

### Implemented in architecture, but not active in the current local-safe build

- Google sign-in
- Facebook sign-in

These two were intentionally disabled in the current `Settings` screen implementation because the local development build hit a hard import crash through `expo-auth-session` -> `expo-crypto`. The app now favors a stable local-safe build over partially wired provider UI.

### Implemented only on web

- Voice input via Web Speech API

There is no native iOS / Android speech recognition implementation yet.

## 2. Current caveats

### 2.1 Auth caveats

- `AuthContext` supports Firebase credential sign-in and sign-out, but only Apple is currently exposed in the `Settings` UI when the native modules and Firebase config are available.
- Google and Facebook auth are **not currently exposed** in the local-safe Settings build.
- Apple sign-in is iOS-only and requires native modules to be present in the local development build.
- If Firebase env values are missing, auth degrades gracefully to a signed-out local-only experience.
- Firebase auth persistence is kept simple. There is no explicit custom persistence strategy yet.

### 2.2 Cloud sync caveats

- Cloud sync only activates when **signed in + Pro**.
- Sync writes to Firestore and then refreshes the local SQLite cache.
- Current sync behavior is functional but basic:
  - no background sync queue
  - no retry/backoff policy
  - no explicit conflict resolution strategy
  - no tombstone / soft-delete model
  - no real-time Firestore listener
- When cloud mode is active, a failed cloud write currently fails the save path instead of falling back to a queued local write.
- Current initialization uploads all local rows to cloud and then refreshes the local cache. This is acceptable for an early version, but it is not a robust multi-device sync model yet.

### 2.3 IAP / Pro caveats

- RevenueCat entitlement handling is implemented, but it only becomes fully functional when the real platform API keys, products, offerings, and entitlement are configured.
- The current code uses fallback recommended pricing labels:
  - `USD $1.99 / month`
  - `USD $14.99 / year`
- Purchase and restore flows are present in code, but end-to-end validation still depends on App Store Connect / RevenueCat configuration and native device testing.
- In local builds with no RevenueCat config, the UI degrades to an informational state instead of exposing broken purchase actions.

### 2.4 Platform / build caveats

- Native module availability still matters in development builds. If a package is added or changed, the local dev client may need to be rebuilt before native functionality works.
- `expo-auth-session` is currently avoided in `Settings` because of the `ExpoCrypto` crash path observed in the local build.
- The iOS `RCTScrollViewComponentView implements focusItemsInRect` log is a UIKit / React Native system log, not an app crash or app-level functional defect.
- Expo Go should not be considered the target environment for validating auth, IAP, or other native-gated production flows.

### 2.5 Quality / operations caveats

- There is no automated test suite yet.
- There is no CI pipeline in the repo yet.
- There is no crash reporting service wired up yet.
- Logger and error boundary are prepared for future monitoring integration, but they only log locally today.
- There is no analytics or product instrumentation plan wired into the app yet.

### 2.6 Documentation caveats

- `docs/FIREBASE.md` and `docs/IAP.md` describe the intended setup path, but they should be read together with this document for the current build state.
- The README feature summary is directionally correct, but this document is more precise for current implementation caveats.

## 3. Recommended next development period

Recommended duration: **1 focused development period / sprint (about 2 weeks)**.

Primary goal:

> Move from a stable local-safe build to a **configurable, testable, and production-directed auth + sync + purchase foundation**.

## 4. Proposed priorities

### P0 — Stabilize provider auth end-to-end

Goal:

- Re-enable Google and Facebook sign-in without reintroducing import-time native module crashes.

Recommended work:

1. Decide the provider integration approach:
   - either reintroduce `expo-auth-session` behind safe runtime loading and native module checks
   - or move to provider-specific native SDK integration if that is more reliable for the Expo dev-client setup
2. Rebuild and validate the local development client after confirming required native modules are linked.
3. Make provider rows appear only when:
   - Firebase is configured
   - the provider is configured
   - the required native/runtime modules are actually available
4. Keep Settings fully render-safe when any provider is unavailable.

Acceptance criteria:

- App boots with env values absent
- App boots with env values present
- `Settings` never crashes at import time
- Google / Apple / Facebook rows only appear when valid for that runtime
- At least one successful sign-in test per supported provider path

### P0 — Harden cloud sync behavior

Goal:

- Make cloud-backed saving resilient enough for real users and multi-device behavior.

Recommended work:

1. Add `createdAt`, `updatedAt`, and optional `deletedAt` fields for sync clarity.
2. Define and document a conflict policy, likely last-write-wins for the near term.
3. Add a pending local sync queue or retry mechanism for cloud-enabled users.
4. Separate:
   - local cache writes
   - cloud sync state
   - sync error reporting
5. Add manual recovery tools in Settings:
   - push local to cloud
   - pull cloud to local
   - inspect sync status

Acceptance criteria:

- A temporary network failure does not silently lose a user’s change
- Sync errors are visible and recoverable
- Two-device behavior is documented and predictable
- Initialization and manual sync do not create avoidable duplicate states

### P1 — Finish IAP productization

Goal:

- Turn the current RevenueCat foundation into a testable subscription flow.

Recommended work:

1. Create App Store Connect subscription products and RevenueCat offerings.
2. Wire exact product IDs and entitlement configuration.
3. Verify:
   - purchase success
   - cancellation
   - restore purchase
   - signed-out / signed-in transitions
4. Refine Settings copy for the paid cloud-sync proposition.
5. Confirm App Review wording stays aligned with cloud service unlock rules.

Acceptance criteria:

- Monthly and annual offerings load from RevenueCat
- Purchase and restore work on device
- Pro state survives relaunch
- Cloud sync unlocks only when entitlement is active

### P1 — Add quality gates

Goal:

- Reduce regression risk before continuing feature expansion.

Recommended work:

1. Add unit coverage for:
   - `useConsumptionStorage` core branches
   - local limit enforcement
   - Pro entitlement state mapping
   - Firebase / RevenueCat config readers
2. Add integration coverage for:
   - local-only save path
   - cloud-enabled save path
   - sync initialization behavior
3. Add CI for:
   - lint
   - typecheck
   - tests
4. Add crash reporting.

Acceptance criteria:

- PRs fail on lint, type, or test regressions
- Critical storage logic has automated coverage
- Runtime crashes are observable outside local console logs

### P2 — Improve product completeness

Goal:

- Close the biggest end-user experience gaps after the platform foundation is stable.

Recommended work:

1. Add native voice input if voice remains a product requirement on iOS / Android.
2. Improve sync UX messaging:
   - last sync time
   - sync pending badge
   - clearer free vs Pro state
3. Review export / clear-history / account transitions for edge cases.
4. Clean up outdated components such as the older modal-based settings flow if it is no longer part of the active UI path.

## 5. Suggested sprint breakdown

### Days 1–3

- Rebuild local dev client and validate native module inventory
- Reintroduce safe Google / Facebook auth strategy
- Keep Settings import-safe in all env states

### Days 4–6

- Harden sync model
- Add metadata fields and explicit sync state handling
- Add manual recovery actions and user-visible sync status

### Days 7–8

- Wire real RevenueCat / store products
- Validate purchase / restore / sign-in interactions

### Days 9–10

- Add tests and CI
- Add crash reporting
- Update docs and release checklist

## 6. Explicit non-goals for the next period

To keep the next period focused, avoid expanding into unrelated product work before the platform foundation is stable:

- large UI redesigns
- category system expansion
- analytics dashboards
- advanced onboarding experiments
- web-only feature work that does not improve native product readiness

## 7. Exit criteria for the next development period

The next period should be considered successful if all of the following are true:

- `Settings` is stable with env on and env off
- at least one non-Apple provider is re-enabled safely
- cloud sync behavior is documented and resilient to transient failures
- RevenueCat products are live in test configuration and verified on device
- automated validation exists beyond lint + typecheck
- production monitoring is no longer console-only

## 8. Related docs

- `docs/FIREBASE.md`
- `docs/IAP.md`
