# 03 — Architecture

## Architectural style

Flash Accounting is a **local-first, offline-capable, layered React Native app** with
**unidirectional data flow** through React Context providers.

Defining properties:

1. **Local-first.** On-device **SQLite** (`flash_accounting.db`) is the single source of
   truth. The UI reads/writes it optimistically. Firestore is an **optional, Pro-gated
   mirror** reconciled through a durable offline queue and a last-write-wins merge (see
   [05](05-data-layer-and-sync.md)).
2. **Graceful degradation.** Firebase, RevenueCat, Sentry, and native speech all return
   `null`/no-op when their env/config is absent. The app boots and is fully usable with
   **none** of them configured.
3. **Layered separation of concerns** with a clean directory-per-layer split.
4. **Domain normalization boundary.** Every record passes through
   `normalizeConsumptionRecord` (`utils/consumption-record.ts`) at every edge (DB read,
   cloud read, queue payload, CSV row, merge) so downstream code always sees consistent
   `createdAt/updatedAt/deletedAt` and numeric `amount`.
5. **i18n-first.** All user strings flow through `t()`; even tab labels and icons are
   localized and memoized.

## Layer map

| Layer | Directory | Responsibility |
|---|---|---|
| **Routing** | `app/` | expo-router route files — thin wrappers that render one component; `Stack`/`Tabs` config; redirects. **No business logic.** |
| **Views** | `components/` | Screens (`AccountingScreen`, `StatisticsView`, `DiagramScreen`, `SettingsScreen`), building blocks (`ConsumptionForm`, `ConsumptionItem`), sheets/modals, and glass UI primitives. |
| **Global state** | `contexts/` | Reactive app state: Theme, Language, DiagramAppearance, Glossary, Auth, Pro. |
| **Data access & device** | `hooks/` | The storage engine (`useConsumptionStorage`), SQL stats (`useConsumptionStats`), OAuth (`useProviderAuth`), speech (`useSpeechRecognition`). |
| **Services / pure logic** | `utils/` | `db`/`db-schema`, `cloud/` + `sync` + `firebase`, `revenuecat*`, domain (`ledger`, `validation`, `consumption-record`), `glossary-*` + `smart-consumption`, `diagram-data`, `formatting`, `date-utils`, `monitoring`/`logger`, `seed-data/`. |
| **Types** | `types/` | `Consumption`, `ConsumptionType`, `ConsumptionDraft`, glossary types. |

The dependency direction is strict: `app/` → `components/` → `contexts/`+`hooks/` →
`utils/` → `types/`. Utils are pure/service-level and never import UI.

> **One inconsistency worth noting:** `useConsumptionStorage` is implemented as a React
> Context provider (`ConsumptionStorageProvider`) but lives in `hooks/` rather than
> `contexts/`. Functionally it belongs to the provider hierarchy.

## Routing (expo-router, file-based)

Entry point is `expo-router/entry` (`package.json:main`). The `app/` tree defines routes;
each route file is deliberately thin (imports one component from `components/` and renders
it), keeping route wiring separate from views.

- **Root stack** — `app/_layout.tsx` declares a headerless, transparent `Stack` with four
  screens: `(tabs)`, `settings` (card), `select-language` and `glossary` (iOS `formSheet`
  with grabber, `card` elsewhere).
- **Index / auth gate** — `app/index.tsx` currently `<Redirect href="/(tabs)" />`. The
  `AuthEntryScreen` login gate is present but **commented out** ("Testing: skip login"), so
  the app boots straight into the tabs; sign-in is optional.
- **Tab group** — `app/(tabs)/` (parentheses = no URL segment). Three thin route wrappers:
  `index.tsx` → `AccountingScreen`, `statistics.tsx` → `StatisticsView`, `diagram.tsx` →
  `DiagramScreen` (the diagram route also sets its `Stack.Screen` title via `t("diagram")`).
- **Native vs web tab layout split** — Metro platform-extension resolution picks
  `app/(tabs)/_layout.web.tsx` on web and `app/(tabs)/_layout.tsx` on native:
  - **Native**: `NativeTabs` from `expo-router/unstable-native-tabs` — real UIKit/Material
    tab bars, `minimizeBehavior="onScrollDown"`, SF Symbols (`sf`) + Material icons (`md`)
    per tab, tinted from `theme.text`.
  - **Web**: standard JS `Tabs` with `tabBarIcon` rendered via the app's own `SymbolIcon`.
  This is the only `.web.` override in the app tree.
- **Imperative navigation** elsewhere: `router.push("/settings" | "/select-language" |
  "/glossary")` and `router.back()`. Screens reload data on focus via `useFocusEffect`.

Route → component map:

```
/                      → Redirect to /(tabs)
/(tabs)/index          → AccountingScreen
/(tabs)/statistics     → StatisticsView
/(tabs)/diagram        → DiagramScreen
/settings              → SettingsScreen
/select-language       → LanguageSheet
/glossary              → GlossarySheet
```

## The provider hierarchy (the dependency DAG)

`app/_layout.tsx` nests ten providers plus the router outlet. The order **encodes the
dependency graph** — identity → entitlements → storage — so each provider can consume the
ones above it. Before render, `initializeMonitoring()` runs at module load (Sentry), and an
`EXPO_PUBLIC_CAPTURE === "1"` block hides LogBox for preview recordings.

```
GestureHandlerRootView          ← outermost so gesture-handler captures all touches
└─ ErrorBoundary                ← class component; context-INDEPENDENT (hardcoded fallback
                                   theme + translations) so it survives if a provider throws
   └─ SafeAreaProvider
      └─ ThemeProvider          ← dependency-free UI concern, placed high so the whole
         └─ LanguageProvider       tree (incl. tab layouts) can consume theme/language
            └─ DiagramAppearanceProvider
               └─ GlossaryProvider        ← depends on useLanguage()
                  └─ AuthProvider          ← Firebase identity
                     └─ ProProvider         ← depends on useAuth() + useLanguage()
                        └─ ConsumptionStorageProvider  ← depends on useAuth() + usePro()
                           └─ Stack         ← the router outlet
```

Why the order matters:
- **Auth → Pro → Storage** is the causal chain: storage needs `user.uid` (Auth) and
  `isPro`/`hasUnlimitedLocal` (Pro) to decide `cloudEnabled = user?.uid && isPro`.
- **Language above Glossary and Pro** because both call `useLanguage()` (glossary for
  localized terms, Pro for the paywall locale).
- **ErrorBoundary is deliberately outside the app contexts** and uses a hardcoded
  `FALLBACK_THEME`/`FALLBACK_TRANSLATIONS`, so it can still render if `ThemeProvider` or
  `LanguageProvider` is what threw.

Splash is configured **declaratively** via the `expo-splash-screen` plugin (no runtime
`preventAutoHideAsync`); `expo-font` is registered as a plugin but there is **no runtime
`useFonts` call** — the app uses system fonts.

## Data flow

```
User action in a screen (components/)
        │  calls exposed async method
        ▼
Context/hook owns state (contexts/, hooks/)
        │  validates → writes SQLite (optimistic UI update)
        │  if cloudEnabled: enqueue in sync_queue + fire background sync
        ▼
utils/ service layer (db, sync, cloud, revenuecat, glossary…)
        │  pure/normalized operations
        ▼
State updates → screens re-render; useFocusEffect re-pulls derived aggregates
```

Reads are optimized separately: `useConsumptionStats` runs SQL aggregation directly for the
Statistics/Diagram screens (no in-memory scanning of the full list). See
[04](04-state-and-hooks.md) and [05](05-data-layer-and-sync.md).

## Resilience mechanisms

- Context-independent `ErrorBoundary` with a "Try Again" reset.
- Idempotent DB init with retry (`ensureDatabaseInitialized`) + one-time AsyncStorage→SQLite migration.
- Lazy dynamic `import()` of native OAuth modules so unconfigured builds don't crash at import.
- All screens guard async loads with `cancelled` flags and generation refs to avoid races.
- Sentry via a thin `utils/monitoring.ts` wrapper gated on `EXPO_PUBLIC_SENTRY_DSN`.
