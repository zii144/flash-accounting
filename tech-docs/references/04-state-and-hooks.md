# 04 — State Management & Hooks

State is held in six React Context providers (`contexts/`) plus one provider that lives in
`hooks/`. Screens read via `useX()` hooks and dispatch through exposed async methods —
unidirectional flow. Persistence is split between **AsyncStorage** (prefs) and **SQLite**
(ledger + sync metadata). Every `useX()` throws if used outside its provider.

## Contexts

### ThemeContext — `contexts/ThemeContext.tsx`
- **State**: `colorScheme: "light" | "dark"`, initialized from and kept in sync with RN
  `useColorScheme()`. **Fully automatic — no manual toggle, no persistence** (follows the OS).
- **`Theme` shape**: `background, surface, foreground, border, inputBackground, text,
  textSecondary, isDark, fadeGradient` (a 4-stop transparent→opaque gradient tuple used for
  bottom list fades). Light = iOS grouped palette (`#F2F2F7`); dark = true black (`#000000`).
- **API** (`useTheme()`): `{ theme, colorScheme }`.

### LanguageContext — `contexts/LanguageContext.tsx` (~3,770 lines, mostly translation tables)
- **State**: `language: Language` (16 locales + `"device"`, default `"device"`).
- **`resolvedLanguage`**: memoized — if `"device"`, `getDeviceLanguage()` reads
  `expo-localization` and maps to a supported code, falling back to `"en"`.
- **Persistence**: AsyncStorage `@flash_accounting_language`; `loadLanguage()` validates against
  `SUPPORTED_LANGUAGES` on mount; `setLanguage()` writes then updates state.
- **`t(key)`**: memoized translator; resolution order `translations[lang]` →
  `GLOSSARY_TRANSLATIONS[lang]` → `translations.en` → `GLOSSARY_TRANSLATIONS.en` → raw key.
- **API** (`useLanguage()`): `{ language, resolvedLanguage, setLanguage, t }`.
- Detail in [07](07-internationalization.md).

### DiagramAppearanceContext — `contexts/DiagramAppearanceContext.tsx`
- **State**: `diagramPalette: "mono" | "accent"` (default `"mono"` — the "black & white" default).
- **Persistence**: AsyncStorage `STORAGE_KEYS.DIAGRAM_PALETTE`, validated on load.
- **API** (`useDiagramAppearance()`): `{ diagramPalette, isAccentPaletteEnabled, setAccentPaletteEnabled }`.

### GlossaryContext — `contexts/GlossaryContext.tsx`
- **Purpose**: the "Smart Label Glossary" — canonicalizes free-text descriptions into
  categories and powers autocomplete suggestions. Depends on `useLanguage()`.
- **State**: `preferences: GlossaryPreferences` (default `DEFAULT_GLOSSARY_PREFERENCES`),
  `isHydrated`, plus a `preferencesRef` mirror so async writers avoid stale closures.
- **Persistence**: AsyncStorage `@flash_accounting_glossary` via `utils/glossary-storage.ts`
  (sanitized on load; falls back to defaults on error).
- **Derived (memoized)**: `patterns` (`buildSemanticPatterns`), `builtinEntries`/`customEntries`
  (`buildGlossaryEntryViews`), `activeEntryCount` — recomputed from preferences + language.
- **API** (`useGlossary()`): `updateBuiltinOverride`, `resetBuiltinOverride`, `upsertCustomEntry`,
  `deleteCustomEntry`, `resetAllPreferences`, `resolveBuiltinLabel`, `canonicalizeLabel(description)`,
  `getSuggestions(input, history?, now?)`, plus the derived views. All mutations go through a
  central `persist(updater)` (apply → save → update ref + state). Detail in [06](06-smart-features.md).

### AuthContext — `contexts/AuthContext.tsx`
- **Backend**: Firebase Auth JS SDK via `getFirebase()` (returns `null` when env missing → app
  runs fully signed-out).
- **State**: `user: User | null`, `isAuthReady`. Subscribes to `onAuthStateChanged`; pushes user
  identity to Sentry via `setMonitoringUser`.
- **API** (`useAuth()`): `{ user, isSignedIn, isAuthReady, isFirebaseReady,
  signInWithCredential(credential), signOut() }`. `signInWithCredential` throws
  `FIREBASE_NOT_CONFIGURED` if unavailable. Detail in [10](10-monetization-and-auth.md).

### ProContext — `contexts/ProContext.tsx`
- **Backend**: RevenueCat via `utils/revenuecat-service` + `utils/revenuecat`. Depends on
  `useAuth()` (syncs appUserId/email/displayName) and `useLanguage()` (paywall locale).
- **State**: `customerInfo`, `offering`, `isReady`, `isBusy`, `debugOverride`; a customerInfo
  listener + initial `syncRevenueCatState()` when configured.
- **Plan model**: `storagePlanId` resolved from `customerInfo` via `resolveStoragePlan` against
  `proEntitlementId` (`cloud_sync_pro`) and `plusEntitlementId` (`local_unlimited`).
- **API** (`usePro()`): `storagePlanId`, `isPro`, `isPlus`, `hasUnlimitedLocal`, `isReady`,
  `isConfigured`, `isBusy`; price strings + recommended fallbacks; `isPlusPackageAvailable`;
  `purchasePro(plan)`, `purchasePlus()`, `presentPaywall()`, `restorePurchases()`,
  `refreshEntitlements()`; `__DEV__` helpers `enableProDebug()` / `signOutResetProDebug()`.
- **Tier meaning for data**: `basic` = local-only, 500-record cap; `plus` = unlimited local, no
  cloud; `pro` = unlimited + Firestore cloud sync (requires sign-in). Detail in [10](10-monetization-and-auth.md).

## Hooks

### useConsumptionStorage — `hooks/useConsumptionStorage.ts` (the data engine)
Implemented as `ConsumptionStorageProvider` + `useConsumptionStorage()`. The single source of
truth for the ledger.
- **Depends on**: `useAuth()` (uid), `usePro()` (isPro, hasUnlimitedLocal, isReady) →
  `cloudEnabled = Boolean(user?.uid && isPro)`.
- **State**: `consumptions`, `isLoading`, `isSyncBusy`, `syncSnapshot`, `totalCount`, plus refs
  for init-once, current mode key, and an in-flight sync promise.
- **Public API**: `saveConsumption`, `updateConsumption`, `deleteConsumption`, `clearAll`,
  `refresh`, `loadPaginated(options)`, `getAllForExport`, `importConsumptions(records)`,
  `syncLocalToCloud`, `pullCloudToLocal`, plus the reactive fields.
- **Behavior**: enforces the 500-record free limit for non-unlimited local-only users; writes
  SQLite first then (if cloud) enqueues + fires a background sync; re-initializes on
  login/logout/Pro-toggle. Full detail in [05](05-data-layer-and-sync.md).

### useConsumptionStats — `hooks/useConsumptionStats.ts`
- **Purpose**: read-optimized **SQL aggregation** for Statistics/Diagram; no state, just memoized
  query functions.
- **API**: `getStats(timeFilter)` (returns `total, expenseTotal, incomeTotal, netTotal, count,
  expenseCount, incomeCount, logDay` in one query), `getGroupedByDay(...)`, `getGroupedByMonth(...)`,
  `getFilteredConsumptions(timeFilter, sortBy, sortOrder, customRange)`.
- **Safety**: parameterized WHERE clauses; `sortBy`/`sortOrder` whitelisted against SQL injection;
  always excludes tombstones (`deletedAt IS NULL`); errors swallowed to safe empty defaults.

### useProviderAuth — `hooks/useProviderAuth.ts`
- **Purpose**: UI-facing OAuth orchestration wrapping `AuthContext.signInWithCredential`.
- **API**: `activeAuthProvider` (`google|facebook|apple|null`), `isAuthBusy`,
  `isAppleAuthAvailable`, `canUseAppleAuth`, `handleSignInGoogle/Facebook/Apple`, `handleSignOut`.
- **Side effects**: **lazily `import()`s** `expo-apple-authentication`, `expo-auth-session`,
  `expo-crypto` behind cached promises so unconfigured builds don't crash at import. Google uses
  PKCE authorization-code flow (native) / implicit (web); Apple uses hashed-nonce; Facebook uses
  implicit token. Cancellations are no-ops; failures raise localized alerts. Detail in [10](10-monetization-and-auth.md).

### useSpeechRecognition — `hooks/useSpeechRecognition.ts`
- **Purpose**: dictation for descriptions. **Web-only** (Web Speech API); on native it sets
  `isAvailable=false` (native dictation happens through the iOS system keyboard instead).
- **API**: `isListening, transcript, error, isAvailable, startListening, stopListening,
  cancelListening`. Continuous + interim results; aborts on unmount. Detail in [06](06-smart-features.md).

## Persistence summary

| Data | Store | Key/table |
|---|---|---|
| Ledger records | SQLite | `consumptions` |
| Offline sync queue | SQLite | `sync_queue` |
| Sync metadata (per uid) | SQLite | `db_metadata` (`sync:*` keys) |
| Language | AsyncStorage | `@flash_accounting_language` |
| Glossary preferences | AsyncStorage | `@flash_accounting_glossary` |
| Diagram palette | AsyncStorage | `STORAGE_KEYS.DIAGRAM_PALETTE` |
| Legacy records (migrated once) | AsyncStorage → SQLite | `STORAGE_KEYS.CONSUMPTIONS` |
| Pro entitlement (RevenueCat cache) | RevenueCat SDK | — |
