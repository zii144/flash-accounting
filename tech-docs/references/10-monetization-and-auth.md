# 10 — Monetization & Auth

Both are **optional layers**: with no RevenueCat or Firebase env, the app runs fully as a free,
signed-out, local-only experience. RevenueCat is the source of truth for entitlements; Firebase is
used for auth + the Pro cloud-sync backend.

## Entitlement model (RevenueCat)

Three storage plans (`utils/revenuecat.ts`):

| Plan | Entitlement ID (default) | Product type | Unlocks |
|---|---|---|---|
| **Basic** | none | free | local only, capped at `FREE_LOCAL_RECORD_LIMIT` (500) |
| **Plus** | `local_unlimited` | **LIFETIME** (one-time) | unlimited local storage |
| **Pro** | `cloud_sync_pro` | monthly / annual subscription | cloud sync (when signed in) |

Recommended launch pricing (hardcoded fallbacks in `getRevenueCatConfig`, echoed in `docs/IAP.md`):
Plus **$14.99** one-time; Pro **$5.99/month** or **$59/year**. `PurchasePlan = "monthly" | "annual" | "plus"`.

### Config resolution
- **Entitlement IDs** from env (`EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID`, `…_PLUS_ENTITLEMENT_ID`) with a
  legacy `…_ENTITLEMENT_ID` fallback for Pro, defaulting to `cloud_sync_pro` / `local_unlimited`. `offeringId`
  defaults to `"default"`.
- **API key** (`getRevenueCatApiKey`): in `__DEV__`, prefer `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` (RevenueCat
  Test Store); otherwise platform key `…_IOS` / `…_ANDROID` by `EXPO_OS`. **Never ship the test key** —
  `verify-ios-env.sh` warns if it's found in a release bundle.

### Resolution logic
- `hasActiveEntitlement(customerInfo, id)` reads `customerInfo.entitlements.active[id]`.
- `resolveStoragePlan`: pro > plus > basic (**pro wins if both active**).
- `hasUnlimitedLocalAccess`: true for plus or pro.
- `getCurrentOffering`: prefer the RevenueCat dashboard `offerings.current`, else `all[offeringId]`.
- `getPurchasePackage`: `"plus"`→`offering.lifetime`, `"annual"`→`offering.annual`, else `offering.monthly`
  (returns `null` rather than fall back to the wrong package type).
- `mapRevenueCatError`: maps store error codes to `AppError`s — `userCancelled`→`PURCHASE_CANCELLED`,
  `PRODUCT_ALREADY_PURCHASED`→`PRODUCT_ALREADY_PURCHASED`, `PURCHASE_NOT_ALLOWED`→`PURCHASE_NOT_ALLOWED`,
  `STORE_PROBLEM`/`NETWORK`→`IAP_STORE_UNAVAILABLE`, else `IAP_ERROR`.

### Paywall locale bridge
RevenueCat's native paywall doesn't read the in-app language picker, so `getRevenueCatPreferredLocale` maps the
app language (and normalizes the device locale) to a paywall locale — e.g. app `zh`→`zh_Hant`, device
`zh-TW`/`zh-HK`→`zh_Hant`, `zh-CN`→`zh_Hans`, `ja-JP`→`ja`; regional bridges `es-MX`→`es_ES`, `fr-CA`→`fr_FR`,
`de-AT`→`de_DE`; overridable via `EXPO_PUBLIC_REVENUECAT_PAYWALL_LOCALE_*`. `ProContext` pushes this before
presenting the paywall.

## SDK wrapper — `utils/revenuecat-service.ts`

Wraps `react-native-purchases` + `react-native-purchases-ui`. Module-level singletons ensure
**configure-once-per-session**:
- `configureRevenueCat(appUserId?, localeOverride?)` — `Purchases.configure(...)`; re-syncs identity or locale only
  when changed; `LOG_LEVEL.DEBUG` in `__DEV__`.
- `syncRevenueCatCustomerProfile` — `Purchases.logIn(uid)` when signed in, `logOut()` to go anonymous; sets
  `setEmail`/`setDisplayName` attributes.
- `fetchRevenueCatState` — parallel `getCustomerInfo()` + `getOfferings()`.
- `purchaseRevenueCatPlan(plan)`, `restoreRevenueCatPurchases()`.
- `presentRevenueCatPaywall(locale)` — `RevenueCatUI.presentPaywall()` with **no** offering arg (uses the
  dashboard "Current" paywall).
- `addRevenueCatCustomerInfoListener` — subscribes to customer-info updates.
All entry points throw `AppError("IAP_NOT_CONFIGURED")` when keys are missing or the platform is unsupported
(RevenueCat is iOS/Android only).

## React state — `contexts/ProContext.tsx`

`usePro()` exposes `storagePlanId`, `isPro`, `isPlus`, `hasUnlimitedLocal`, live prices + recommended fallbacks,
`isPlusPackageAvailable`, and actions `purchasePro(plan)`, `purchasePlus()`, `presentPaywall()`,
`restorePurchases()`, `refreshEntitlements()`, plus `__DEV__` `enableProDebug`/`signOutResetProDebug` (a
`debugOverride` forcing `"pro"`). It wires RevenueCat identity to the Firebase user (`appUserId: user?.uid`, email,
displayName), computes the preferred paywall locale, attaches a customer-info listener, and recomputes the plan
after a PURCHASED/RESTORED paywall result.

## Auth — Firebase + Google / Apple / Facebook

### `utils/firebase.ts`
Firebase JS SDK (`firebase ^12`). `isFirebaseConfigured()` requires `EXPO_PUBLIC_FIREBASE_API_KEY`,
`…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_APP_ID`. `getFirebase()` lazily initializes app/auth/firestore and caches
them; **returns `null` when unconfigured** so the whole auth stack degrades gracefully. Uses default `getAuth(app)`
(deliberately avoiding custom persistence to dodge bundling issues).

### `contexts/AuthContext.tsx`
Subscribes to `onAuthStateChanged`; exposes `user`, `isSignedIn`, `isAuthReady`, `isFirebaseReady`,
`signInWithCredential(credential)` (wraps `firebase/auth`), `signOut()`. Pushes the user to Sentry via
`setMonitoringUser`.

### `hooks/useProviderAuth.ts`
Provider sign-in orchestration. Native modules are **lazily dynamic-imported and cached** (`expo-apple-authentication`,
`expo-auth-session`, `expo-crypto`) so unconfigured builds import cleanly.
- **Google** — `expo-auth-session` with the Google discovery doc. Native: **authorization-code + PKCE**
  (`ResponseType.Code`, `Prompt.SelectAccount`, scopes openid/profile/email), then exchange the code; web: implicit
  token. Then `signInWithCredential(GoogleAuthProvider.credential(idToken, accessToken))`. Redirect URI is the native
  reversed-client-id form.
- **Apple** — iOS-only, gated on `isAvailableAsync()`. Random nonce → SHA-256 via `expo-crypto` →
  `signInAsync({ FULL_NAME, EMAIL, nonce })` → `new OAuthProvider("apple.com").credential({ idToken, rawNonce })`.
  Swallows `ERR_REQUEST_CANCELED`.
- **Facebook** — `expo-auth-session` implicit token flow with `EXPO_PUBLIC_FACEBOOK_APP_ID` →
  `FacebookAuthProvider.credential`. **Still gated behind runtime availability checks** (not yet enabled end-to-end).

### `utils/google-oauth.ts`
Pure, fully-unit-tested helpers: `getGoogleOAuthClientPrefix`, `getGoogleReversedClientId`,
`getGoogleNativeRedirectUri` (`…:/oauth2redirect`), `getGoogleNativeUrlScheme`, `getGoogleClientIdForPlatform`
(reads `EXPO_PUBLIC_GOOGLE_{IOS,ANDROID,WEB}_CLIENT_ID`). `app.config.ts` auto-registers the reversed-client-id URL
scheme (iOS `CFBundleURLTypes` + Android intent filter) when the platform client IDs are present.

### Firestore data model & rules (`docs/FIREBASE.md`)
Data path `users/{uid}/consumptions/{consumptionId}` matching `types/consumption.ts`. Owner-only security rules
(read/write require `request.auth.uid == uid`). Cloud sync activates only when **signed in AND Pro**; local-first
writes with pending-sync fallback (see [05](05-data-layer-and-sync.md)).

## Provider status (current)

- **Apple** — live (iOS, native module).
- **Google** — live via native OAuth redirect (auth code + PKCE through `expo-auth-session`). (Was previously
  disabled after an `expo-auth-session → expo-crypto` import crash; resolved.)
- **Facebook** — wired through the same safely-loaded flow but still gated. The only provider not yet enabled E2E.

## Pricing & entitlement plans (`plan/`)

- **`pricing_plan_20260527.md`** (zh) — the three-tier strategy: Basic (free, ≤500, funnel) / Plus ($14.99 one-time
  buyout + Face ID/Touch ID lock, high-margin anti-subscription) / Pro ($5.99mo·$59yr, cloud unlimited + cross-device
  sync + phone-migration safety + **two-person shared ledger** with reimbursement/split — the MRR engine for
  couples/families). Phased: v1 MVP sync + shared book; v2 split-billing; v3 budgets/recurring/**AI natural-language
  logging**.
- **`pro_1plus1_entitlement_plan_20260609.md`** (zh spec) + **`pro_1plus1_implementation_plan_20260702.md`** (en
  executable) — the **"Pro 1+1"** entitlement-sharing feature. One Pro **owner** + one assignable **guest seat**; the
  guest gets Pro capability on **their own** records (Phase 1 shares the *entitlement*, not the ledger — explicitly not
  a shared book, not Apple Family Sharing). Because RevenueCat can't model "A authorized B," an **app authorization
  layer** is added: `hasEffectivePro = ownedRevenueCatPro || activeGuestSeat`; the cloud-sync gate changes from
  `signed in + isPro` to `signed in + hasEffectivePro`. Backend-authoritative (Firebase Cloud Functions 2nd-gen +
  Firestore, Blaze) with `subscription_accounts/{ownerUid}`, `members/`, `invites/`, `user_access/{uid}`, audit logs;
  callables `createShareInvite`/`acceptShareInvite`/`revokeSharedSeat`/`cancelShareInvite` + a `syncRevenueCatWebhook`
  + a 6-hourly reconciliation job; seat rules (1 guest/owner, 24h reassignment cooldown, ≤2 reassignments/30 days,
  auto-revoke on terminal subscription states). New client files `utils/entitlement-sharing.ts` +
  `components/SharedSeatSection.tsx`, `ProContext` extensions (`hasEffectivePro`, `proAccessSource`, `sharedSeatInfo`),
  flag `EXPO_PUBLIC_SHARE_1PLUS1_ENABLED`, test `tests/entitlement-sharing.test.ts`, ~13–16 days over 4 milestones.

> **Status:** Pro 1+1 is **planned/not implemented** — there is no `functions/` backend yet. The shipped code
> resolves Pro purely from RevenueCat `customerInfo`. See [15](15-roadmap-and-caveats.md).

## Setup guides
- `docs/IAP.md` — RevenueCat env vars, dashboard setup (entitlements + "default" offering with lifetime/monthly/
  annual products), key strategy, paywall localization, testing flow.
- `docs/FIREBASE.md` — Firebase project + provider setup, env vars, Firestore rules, native-auth notes.
- `docs/SENTRY.md` — crash-reporting DSN wiring.
