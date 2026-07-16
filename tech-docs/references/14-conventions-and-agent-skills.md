# 14 — Coding Conventions & Bundled Agent Skills

## Coding conventions

### Components & modules
- **Functional components + hooks throughout.** The one exception is `ErrorBoundary` (a class component, required
  for `getDerivedStateFromError`/`componentDidCatch`).
- **Exports**: feature components use **named exports** (`export function AccountingScreen`); route files use
  `export default`. `ConsumptionItem` is `memo`-wrapped.
- **File naming split**: **PascalCase** for screens/feature components and contexts; **kebab-case** for low-level
  primitives (`glass-button.tsx`, `glass-icon-button.tsx`, `symbol-icon.tsx`) and all `utils/*`. Component/type names
  are PascalCase; hooks camelCase (`useConsumptionStorage`).

### Styling
- One `StyleSheet.create` per file at the bottom; dynamic/themed values applied as **inline style arrays** layered
  over static styles: `[styles.title, { color: theme.text }]`.
- Heavy use of `borderCurve: "continuous"` alongside `borderRadius`; numeric text uses
  `fontVariant: ["tabular-nums"]`.

### Imports
- Path alias `@/` (tsconfig) for internal modules; imports grouped roughly components → contexts → hooks → utils →
  third-party. React imported implicitly (new JSX transform); hooks named-imported.

### Typing
- `strict: true` TypeScript 6. Explicit `interface XProps` or inline `type` above each component; props destructured
  with defaults in the signature (`size = 40`, `intensity = "medium"`). Generics where useful
  (`SegmentControl<T extends string>`). Shared domain types from `@/types/*`.

### State & effects
- `useState`/`useCallback`/`useMemo`/`useRef` extensively; async work guarded with `cancelled` flags and generation
  refs to avoid races; `useFocusEffect` for reload-on-focus; `requestAnimationFrame` to defer form-state init and
  dictation updates.

### Animation
- `react-native-reanimated` for entrance/layout (`FadeInDown`, `FadeOutUp`, `Layout.springify`, `withSpring`) and
  `react-native-gesture-handler/ReanimatedSwipeable` for swipe-to-delete.

### i18n & platform
- Every user string via `useLanguage().t("key")`; currency via `formatCurrency`; dates/times locale-aware with
  Today/Yesterday special-casing.
- Platform branching via `process.env.EXPO_OS` and `Platform.OS` (iOS-only glass, SF Symbols, sheet presentation,
  spinner date pickers, web fallbacks). `__DEV__` gates the developer settings section and error details.
  `EXPO_PUBLIC_CAPTURE` suppresses autofocus/LogBox for preview recordings.

### Error handling
- A typed `AppError` (`utils/app-error.ts`) with stable codes (`INVALID_CONSUMPTION`, `LOCAL_LIMIT_REACHED`,
  `CLOUD_SYNC_NOT_AVAILABLE`, `FIREBASE_NOT_CONFIGURED`, `IAP_*`, `PURCHASE_*`) is thrown by the service/hook layer
  and mapped to localized UI messages. Structured logging via `utils/logger.ts`; crash reporting via
  `utils/monitoring.ts` (Sentry, env-gated).

### Quality gates
- `npm run lint` (flat `eslint-config-expo`), `npm run typecheck` (`tsc --noEmit`), `npm test` — all three run in CI
  on every PR. See [11](11-testing.md).

## Bundled agent skills (`.agents/skills/`) — for AI coding agents, not the app

`.agents/skills/` holds **Expo's official authoring skills for AI coding agents** (Claude, Cursor, etc.) — reference
guides consulted when working on the Expo codebase. **They are not runtime app features and ship no code into the app
bundle.** Each is a directory with a `SKILL.md` (YAML frontmatter + guide) and `references/*.md` / `scripts/*`.

`skills-lock.json` pins all 12 skills: each entry has `source: "expo/skills"`, `sourceType: "github"`, and a
`computedHash` (SHA-256) that pins the exact fetched content — a lockfile so a re-sync can verify integrity / detect
drift.

The 12 skills:

| Skill | Covers |
|---|---|
| **building-native-ui** | Building apps with Expo Router: fundamentals, styling, components, navigation, animations, native tabs (largest; ~15 references). |
| **expo-api-routes** | API routes in Expo Router with EAS Hosting. |
| **expo-cicd-workflows** | Writing EAS workflow YAML for CI/CD (ships `fetch.js`/`validate.js`). |
| **expo-deployment** | Deploying to iOS App Store, Play Store, web, API routes (testflight, ios-app-store, play-store, app-store-metadata references). |
| **expo-dev-client** | Building/distributing dev clients locally or via TestFlight. |
| **expo-module** | Native modules/views with the Expo Modules API (Swift/Kotlin/TS). |
| **expo-tailwind-setup** | Tailwind v4 + react-native-css + NativeWind v5. |
| **Expo UI Jetpack Compose** | `@expo/ui/jetpack-compose` (Android). |
| **Expo UI SwiftUI** | `@expo/ui/swift-ui` (iOS). |
| **native-data-fetching** | fetch, React Query, SWR, caching, offline, Expo Router loaders. |
| **upgrading-expo** | Upgrading SDK versions; new-architecture, react-19, react-compiler, native-tabs, expo-av migrations. |
| **use-dom** | Expo DOM components (run web code in a native webview). |

Note the app **uses** patterns from several of these skills (native tabs, liquid glass, the local iOS/EAS deployment
flows) but does not use Tailwind/NativeWind, API routes, or custom Expo modules.

## Other agent/editor config

- `.claude/launch.json` — a dev-server launch config for the marketing site (`website-preview`, port 4180). Unrelated
  to the app runtime.
- `.claude/worktrees/` — a git worktree mirror of the repo (duplicate copies; not a separate source of truth).
- `.cursor/` — present but empty (no Cursor rules).
- `.vscode/` — recommends the `expo.vscode-expo-tools` extension.
- This `tech-docs/` folder is itself shaped like a skill (`SKILL.md` + `references/`) so it can be dropped into an
  agent's skills directory as a portable blueprint.
