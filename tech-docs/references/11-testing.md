# 11 — Testing

## Runner: `node:test` + `tsx` (no Jest)

```json
"test": "node --import tsx --test tests/*.test.ts"
```

- **Runner**: Node's built-in test runner (`node --test`) discovers and runs every `tests/*.test.ts`. Tests import
  `test`/`describe`/`it` from `node:test` and `assert` from `node:assert/strict`.
- **Transpilation**: `--import tsx` loads the `tsx` ESM loader so TypeScript runs directly — no build step, no
  Babel, no `ts-jest`. There is **no Jest/Vitest/Babel config anywhere** in the repo.
- **Path aliases**: `tsx` honors tsconfig `paths` (`@/*` → `./*`) at runtime; test files themselves mostly import
  via relative paths.
- **No coverage tooling** (no c8/nyc, no `--experimental-test-coverage`). Root `tsconfig.json` governs (strict,
  `types: ["node"]`, excludes `node_modules` and `website`).
- **CI** (`.github/workflows/quality.yml`, Node 22): `npm ci` → `npm run lint` → `npm run typecheck` → `npm test`
  on every PR and push to `main`/`master`.
- **E2E is separate**: `npm run test:e2e` = `maestro test .maestro/smoke.yaml` (not part of `npm test`) — see
  [13](13-external-tooling.md).

## How mocking works with no framework

There is no mock library. Three techniques:
1. **Env-var swap with save/restore** — helpers set `process.env` / `globalThis.__DEV__`, run a callback, then
   restore in `finally` (e.g. `runWithRevenueCatEnv` in `revenuecat.test.ts`; `EXPO_OS` swaps in `dictation-text.test.ts`).
2. **Hand-built fake objects** cast `as never` — minimal RevenueCat `CustomerInfo`/offering/package fixtures; plain
   fixture records built by local factory helpers.
3. **Source-as-text parsing** — RN-coupled modules that can't be imported under Node are read with `fs.readFileSync`
   and asserted on as strings (`i18n-parity.test.ts`, `production-readiness.test.ts`).

## How tests avoid native modules

Tests only import **pure logic utils** (type-only + plain TS): `ledger`, `sync`, `export`, `csv-import`, `date-utils`,
`diagram-data`, `seed-data`, `smart-consumption`, `glossary-merge`, `glossary-defaults`, `dictation-text`,
`revenuecat`, `google-oauth`, `public-env`. None import `react-native` or Expo native modules. The RevenueCat
**logic** (`utils/revenuecat.ts`) is deliberately split from the **SDK wrapper** (`utils/revenuecat-service.ts`)
precisely so the logic is unit-testable in Node.

## Test inventory (13 files)

| File | Focus | Notable assertions |
|---|---|---|
| **production-readiness.test.ts** | **release safety gate** | Asserts capture-automation scaffolding is fully removed — forbidden files (`components/CaptureAutomation.tsx`, `scripts/capture-ios-screenshots.py`) don't exist; no `CaptureAutomation`/`capture:setForm`/`capture:submitExpense`/`capture:screenshot`/`DeviceEventEmitter` patterns in `app/`,`components/`,`contexts/`,`hooks/`; `app/_layout.tsx` mounts a `<Stack>` and no capture component. Explicitly **allows** the `EXPO_PUBLIC_CAPTURE` env gate. |
| **revenuecat.test.ts** | entitlement logic | `resolveStoragePlan` pro/plus/basic + pro-wins; `hasUnlimitedLocalAccess`; offering `current`-preferred with `offeringId` fallback; `getPurchasePackage` lifetime for plus, `null` for monthly/annual when only lifetime exists; test-key preferred in `__DEV__`; paywall locale bridge (`zh`→`zh_Hant`, `zh-TW`→`zh_Hant`, `es-MX`→`es_ES`, dashboard overrides). |
| **i18n-parity.test.ts** | translation completeness | 16-locale `EXPECTED_LANGUAGES`; parses `translations` out of `LanguageContext.tsx` source; every locale has the **exact** English key set (no missing, no extra); same for the 16 `GLOSSARY_TRANSLATION_*` dicts. |
| **smart-labeling.test.ts** | heuristic auto-labeling | locale terms → localized labels (捷運→交通); custom entries beat built-ins; longest matching term wins; partial "di" at 19:00 → 晚餐 with `inferredType: expense`; disabled built-ins excluded. |
| **sync.test.ts** | cloud merge | `mergeConsumptionSnapshots` keeps latest `updatedAt`; `buildCloudSyncPlan` uploads only newer-than-cloud; `getActiveConsumptions` excludes tombstones. |
| **ledger.test.ts** | accounting | `getSignedAmount` (+income/−expense); `calculateNetTotal([120,−45,−10]) === 65`. |
| **diagram-data.test.ts** | chart aggregation | `buildTrendSeries` groups by local day & sorts chronologically; `buildCategoryDetail` matches expenses largest-first with total, excludes income, groups by **canonical** label (Starbucks→Coffee). |
| **date-utils.test.ts** | calendar keys | day vs month key recognition; parse without UTC drift (anchored to noon); `getCustomRangeBounds` snaps start→00:00:00.000 / end→23:59:59.999; `normalizeDateRange` clamps start≤end. |
| **csv-import.test.ts** | CSV parse | round-trips the app's own export; quoted commas (`"1,234.50"`→1234.5); throws `/Date is invalid/`, `/Type must be expense or income/`. |
| **export.test.ts** | CSV build | header exactly `Date,Type,Amount,Description,Category`; quoted type column; escapes embedded quotes (`Taxi "home"`→`"Taxi ""home"""`). |
| **dictation-text.test.ts** | iOS dictation cleanup | preserves `appleapple`/`速速`; strips `￼` (`a￼pple`→`apple`). |
| **google-oauth.test.ts** | OAuth helpers | numeric prefix extraction, reversed client id, native redirect URI, Info.plist URL scheme. |
| **seed-data.test.ts** | dev seed generator | ~150 records over ≥60 days / ~3 months; localizes descriptions (en "Coffee" vs zh "咖啡"); `SUPPORTED_SEED_LOCALES` = `[en,zh,es,fr,de,ja]`. |

## What the suite guarantees (and doesn't)

**Guarantees**: the pure business logic — accounting math, sync merge/conflict, CSV round-trips, chart aggregation,
date handling, entitlement resolution, OAuth URL derivation, dictation cleanup, seed generation — plus two
cross-cutting invariants: **16-locale translation parity** and **no capture-automation leaks into production
source**.

**Doesn't cover** (per `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md`): storage-hook branches, live entitlement mapping,
sync integration paths, and native auth/IAP flows. Extending coverage into those is a roadmap item
([15](15-roadmap-and-caveats.md)). Total ≈63 unit tests as of v1.0.4.

## The production-readiness test as a pattern

`production-readiness.test.ts` is worth calling out: it's a **repo-safety test** rather than a logic test. Its job
is to make it impossible to accidentally ship the screenshot/preview-recording automation that's used to generate
App Store assets. If any forbidden file or runtime hook reappears in the source tree, CI fails. This is a lightweight
way to enforce a "this dev-only tooling must never ship" boundary without a separate build-stripping step.
