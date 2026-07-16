# 02 — Tech Stack

Every version and config value below is taken directly from the repo.

## Core runtime

| Layer | Choice | Version |
|---|---|---|
| Framework | **Expo** (SDK 56) | `expo ~56.0.13` |
| Native runtime | **React Native** | `0.85.3` |
| UI library | **React** / React DOM | `19.2.3` |
| Language | **TypeScript** | `~6.0.3` (strict) |
| Router | **expo-router** (file-based, native tabs) | `~56.2.12` |
| JS engine | **Hermes** | via Expo/RN |
| Architecture | **New Architecture** (Fabric + TurboModules) | `newArchEnabled=true` (Android), RN default |
| Compiler | **React Compiler** + typed routes | `app.json` `experiments` |
| Web | **react-native-web** | `~0.21.0` |

## Key dependencies (from `package.json`)

**Expo modules**: `expo-sqlite` (local DB), `expo-router`, `expo-localization`, `expo-apple-authentication`, `expo-auth-session` + `expo-crypto` + `expo-web-browser` (OAuth), `expo-file-system` + `expo-sharing` (CSV export), `expo-blur` + `expo-glass-effect` + `expo-linear-gradient` (liquid-glass UI), `expo-image` (icons), `expo-font`, `expo-video`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `expo-constants`, `expo-linking`, `expo-dev-client`.

**Native/UI libraries**:
- `react-native-reanimated 4.3.1` + `react-native-worklets 0.8.3` — animations (spring, FadeIn, Layout).
- `react-native-gesture-handler ~2.31.1` — touch handling, swipe-to-delete.
- `react-native-svg ^15.15.4` — all charts (pie/treemap/bar/line) are hand-drawn SVG.
- `react-native-screens 4.25.2`, `react-native-safe-area-context ~5.7.0`.
- `@expo/material-symbols ^0.1.1` — Android icon assets; SF Symbols on iOS.
- `@react-native-async-storage/async-storage ^2.2.0` — language, glossary, palette prefs, legacy migration.
- `@react-native-community/datetimepicker 9.1.0` — date/range pickers.

**Cloud / commerce / observability**:
- `firebase ^12.12.0` — Auth + Firestore (JS SDK).
- `react-native-purchases ^10.2.0` + `react-native-purchases-ui ^10.2.0` — RevenueCat SDK + native paywall.
- `@sentry/react-native ~7.11.0` — crash reporting (wrapped by `utils/monitoring.ts`; Metro uses `getSentryExpoConfig`).

**Dev dependencies**: `tsx ^4.21.0` (TS execution for tests + scripts), `typescript ~6.0.3`, `eslint ^9.25.0` + `eslint-config-expo ~56.0.4`, `@types/node`, `@types/react`.

There are **no AI/ML dependencies** (no `openai`, `@anthropic-ai`, `tensorflow`, `onnx`, `mlkit`, etc.). The "smart" features are pure heuristics — see [06](06-smart-features.md).

## Build/tooling configuration

- **`tsconfig.json`** — extends `expo/tsconfig.base`, `strict: true`, `types: ["node"]`, path alias `@/*` → `./*`. Includes `.ts/.tsx` + `.expo/types`; **excludes `node_modules` and `website`** (the website has its own tsconfig).
- **`metro.config.js`** — wraps `getSentryExpoConfig(__dirname)` (Sentry's Metro plugin) and adds `wasm` to `assetExts`.
- **`eslint.config.js`** — flat config, extends `eslint-config-expo/flat`, ignores `dist/*`. Lint runs via `expo lint`.
- **`babel`** — none checked in (Expo's default preset via Metro; React Compiler enabled through `app.json` experiments).
- **Node** — README requires Node **20.19.4+** (Expo SDK 56); CI runs on **Node 22**.

## App configuration (`app.json` + `app.config.ts`)

`app.config.ts` is a dynamic config that spreads `app.json` and **auto-injects Google OAuth native URL schemes** (reverses `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` into an iOS `CFBundleURLTypes` entry and adds an Android intent filter for `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`), idempotently and only when those env vars are present.

Static config (`app.json`):
- `name` "Black White Accounting", `slug` "flash-accounting", `version` **1.0.4**, `scheme` `flashaccounting`, `orientation` portrait, `userInterfaceStyle` automatic.
- **iOS**: bundle `com.zii.flash.accounting`, `buildNumber` "13", `supportsTablet` true, `AppIcon.icon`. InfoPlist: `NSSpeechRecognitionUsageDescription`, `NSMicrophoneUsageDescription` (dictation), `ITSAppUsesNonExemptEncryption: false`.
- **Android**: package `com.zii.flash.accounting`, adaptive icon (fg/bg/monochrome), `softwareKeyboardLayoutMode: resize`, permissions `RECORD_AUDIO` + `INTERNET`, `predictiveBackGestureEnabled: false`.
- **web**: `output: static`, favicon.
- **Plugins**: `expo-router`, `expo-splash-screen` (light `#ffffff` / dark `#000000`), `expo-localization`, `expo-apple-authentication`, `@react-native-community/datetimepicker`, `expo-font`, `expo-image`, `expo-sharing`, `@sentry/react-native`, `expo-sqlite`, `expo-web-browser`, `expo-status-bar`.
- **experiments**: `typedRoutes: true`, `reactCompiler: true`.
- **EAS projectId**: `0e3f6692-c301-40ec-b891-456bf9fa0dd0`.

## Environment variables (all optional — app degrades gracefully)

All are `EXPO_PUBLIC_*` (statically inlined into the JS bundle). See `.env.example` and [10](10-monetization-and-auth.md)/[12](12-build-release-cicd.md).

```text
# Firebase (auth + Firestore cloud sync)
EXPO_PUBLIC_FIREBASE_API_KEY / _AUTH_DOMAIN / _PROJECT_ID / _APP_ID / _STORAGE_BUCKET / _MESSAGING_SENDER_ID
# Google/Facebook OAuth
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / _ANDROID_CLIENT_ID / _WEB_CLIENT_ID / EXPO_PUBLIC_FACEBOOK_APP_ID
# RevenueCat
EXPO_PUBLIC_REVENUECAT_API_KEY_TEST / _IOS / _ANDROID
EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID / _PLUS_ENTITLEMENT_ID / _OFFERING_ID
EXPO_PUBLIC_REVENUECAT_PAYWALL_LOCALE_<LANG>   # optional per-language paywall locale overrides
# Sentry
EXPO_PUBLIC_SENTRY_DSN
# Feature flags / capture mode
EXPO_PUBLIC_CAPTURE=1                # preview-recording mode (suppresses LogBox/autofocus)
EXPO_PUBLIC_SHARE_1PLUS1_ENABLED     # planned Pro 1+1 feature flag
```

`scripts/verify-ios-env.sh` (via `npm run verify:ios:env`) proves the required `EXPO_PUBLIC_*` values are actually inlined into a Release bundle before an iOS archive — see [12](12-build-release-cicd.md).

## Native projects

Both `ios/` and `android/` are **checked into the repo** (not generated on the fly), so the native Info.plist / Gradle values are the source of truth at build time.

- **iOS**: Hermes, deployment target 16.4, CocoaPods with Expo autolinking, Sentry native (`ios/sentry.properties`, auto-upload disabled locally via `.xcode.env.local`), prebuilt-RN-core toggles, react-native-screens Fabric (`RNS_GAMMA_ENABLED`).
- **Android**: `newArchEnabled=true`, `hermesEnabled=true`, `edgeToEdgeEnabled=true`, versionCode 1 / versionName 1.0.0 (Android versioning is **not** automated by the iOS release script), architectures `armeabi-v7a,arm64-v8a,x86,x86_64`. ⚠️ The release build currently signs with the **debug keystore** — must be fixed before Play Store.
