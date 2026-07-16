# 15 — Roadmap, Caveats & Findings

The canonical in-repo sources are `docs/ROADMAP.md` (product roadmap, last updated 2026-07-11) and
`docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md` (implementation-status source of truth). This doc summarizes them and adds
findings surfaced while mapping the codebase.

## Where the product stands (as of v1.0.4 / build 13)

**Shipped and stable**
- Local-first income/expense logging on SQLite (soft deletes, migrations, 500-record free cap).
- Statistics + diagram screens (time filters, sorting, daily grouping, net totals; pie/treemap/bar/line, tap-to-detail, custom ranges).
- CSV export + import; 16 languages + device detection + customizable glossary; dark/light theme; error boundary; structured logging; Sentry wiring.
- Apple sign-in (live) + Google sign-in (live, native OAuth code + PKCE).
- RevenueCat tiers: Basic (free) / Plus ($14.99 lifetime, unlimited local) / Pro ($5.99mo·$59yr, cloud sync).
- Firestore cloud sync for signed-in Pro users: per-record sync queue, tombstone deletes, last-write-wins merge, manual push/pull recovery.
- iOS live via the local Xcode release flow; CI runs lint + typecheck + ~63 unit tests.

**Known gaps**
- Cloud sync has **no retry/backoff across app restarts** and **no real-time Firestore listener** — multi-device UX is manual-refresh.
- **Facebook sign-in still gated**; no E2E tests for native auth/IAP/sync flows.
- **Pro 1+1 seat sharing is fully specified but not implemented** (needs a backend authorization layer; no `functions/` yet).
- **Android build exists but has not shipped**; in-app voice input exists only on web (iOS keyboard dictation ships).
- Dependency drift: Expo SDK 57 is out (one major behind); ~14 packages behind SDK 56 patch levels; `npm audit` reports vulns (transitive dev/CLI tooling, none in the shipped bundle).
- **No analytics / product instrumentation**, so pricing and funnel decisions are unmeasured.

## Phased roadmap (`docs/ROADMAP.md`)

- **Phase 1 — Trust the cloud** (P0): sync retry/backoff across restarts; foreground/real-time refresh; sync-status UX (last-synced, pending badge, recoverable errors); two-device validation + tests; IAP end-to-end verification.
- **Phase 2 — Pro 1+1 seat sharing**: backend authorization layer (owner + one guest seat; RevenueCat stays purchase source of truth); invite/accept/revoke in Settings; `isPro = ownRevenueCatPro || activeGuestSeat`; abuse guards. Shared *ledger* data stays out of this phase.
- **Phase 3 — Shared ledger**: shared Firestore space distinct from `users/{uid}`; membership/permissions; split-payment / who-paid / settle-up (代墊與拆帳); conflict handling beyond last-write-wins.
- **Phase 4 — Reach**: Android launch (needs device QA, Play Store products in RevenueCat, real keystore, store listing — preview videos via `captures/preview-kit/`); native in-app voice input; Facebook re-enable or drop; Plus Face ID/Touch ID lock.
- **Continuous track**: Expo SDK 57 upgrade; analytics baseline; deeper tests (storage hooks, entitlement mapping, sync integration); release automation; docs hygiene.

## Implementation caveats (`docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md`)

- **Auth**: `AuthContext` supports Firebase credential sign-in/out; provider rows appear only when Firebase + the provider + native modules are available; missing Firebase env degrades to signed-out local-only; simple auth persistence (no custom strategy).
- **Cloud sync**: only active when signed in + Pro; per-record queue + `createdAt`/`updatedAt`/`deletedAt` + tombstones + last-write-wins + manual push/pull; remaining gaps as above.
- **IAP/Pro**: entitlement handling implemented but only fully functional with real keys/products/offerings; local dev can use the RevenueCat Test Store; UI degrades to an informational state with no config.
- **Platform/build**: native module availability matters in dev builds; `expo-auth-session` is loaded only after the user taps a provider so missing native support degrades into an auth error rather than an import crash; Expo Go is not the target for validating native-gated flows.
- **Quality/ops**: lint/typecheck/tests run in CI; Sentry depends on production env; coverage is focused on shared utilities + repo-safety, not native E2E; no analytics yet.

## Explicit non-goals (current)

Large UI redesigns; category-system expansion; web-only feature work that doesn't advance native readiness; advanced onboarding experiments before analytics exist.

## Findings surfaced during this mapping (verify independently)

These were flagged by the exploration passes and are worth triaging. They are reported here as observations, not changes.

**Security / secrets**
- `fastlane/asc_api_key.json` appears populated with real credentials, and a real App Store Connect signing key **`fastlane/AuthKey_Z55AUGKZFF.p8` is committed to the repo** (the Deliverfile/README describe the JSON as git-ignored). An ASC `.p8` can be downloaded only once from Apple. **Recommendation**: rotate the key in App Store Connect and purge both files from git history. See [12](12-build-release-cicd.md).
- iOS `DEVELOPMENT_TEAM 8KKMD5SMNP` is hardcoded in `scripts/release-ios.sh`.

**Correctness**
- `saveConsumption` increments `totalCount` **unconditionally** even when overwriting an existing id (`hooks/useConsumptionStorage.ts`) — a save that overwrites a record can over-count against the free limit.
- Cloud reads always pull the **full user snapshot** (no server-side query/pagination in `utils/cloud/consumptions.ts`) — linear scaling; a concern as record counts grow.

**Config / cosmetics**
- `package.json` `version` is `1.0.0` while `app.json` is `1.0.4` — release version is driven by `app.json`/Info.plist, so the package.json field is cosmetic.
- **Android release signs with the debug keystore** — must be replaced before Play Store.
- Legacy/unused UI: `components/SettingsModal.tsx` (older centered-card modal superseded by `SettingsScreen`) and an unused paywall StyleSheet block in `SettingsScreen.tsx` are cleanup candidates.
- Dead-but-exported code: `getSmartDraftEnhancement`/`inferConsumptionType` (`utils/smart-consumption.ts`) have no UI caller.

## Success criteria by end of Phase 2 (`docs/ROADMAP.md`)

- Zero known paths where a Pro user's change is silently lost.
- Sync state always visible and recoverable in-app.
- 1+1 seat sharing live and purchasable; guest activation measured.
- Expo SDK current; `npm audit` clean of high/critical.
- Analytics answering activation rate, D7 retention, paywall view→purchase conversion per tier.
