# Flash Accounting

Flash Accounting (App Store name: **Black White Accounting** / 黑白記帳) is a local-first mobile accounting app built with Expo and React Native. It lets users record income and expenses quickly, review spending through statistics and diagrams, export records, and optionally unlock cloud sync through a paid storage plan.

## Current Capabilities

- Add, edit, delete, and page through income and expense records
- SQLite-backed local storage with a free local record limit
- Statistics tab with time filters, sort modes, grouped daily history, and net totals
- Diagram tab with pie, treemap, bar, and line chart modes, tap-to-detail category breakdowns, and custom date ranges
- CSV import and export for records
- Speech-to-text dictation for descriptions (iOS keyboard dictation; Web Speech API on web)
- 16 UI languages — English, Traditional Chinese, Spanish, French, German, Japanese, Hindi, Portuguese, Russian, Indonesian, Korean, Italian, Turkish, Vietnamese, Thai, and Polish — plus a Device (follow-system) option
- Automatic light and dark themes
- Settings flows for language, glossary terms, auth, purchases, export, and sync recovery
- Firebase auth and Firestore sync foundation for signed-in Pro users
- RevenueCat-backed Plus and Pro entitlement handling
- Sentry wiring for production crash reporting

The app is usable without sign-in. Auth, cloud sync, purchases, and crash reporting depend on the matching platform and environment configuration.

## Tech Stack

- Expo SDK 56
- React Native 0.85
- React 19
- Expo Router with native tabs
- TypeScript 6
- SQLite through `expo-sqlite`
- Firebase for auth and Firestore-backed cloud storage
- RevenueCat for Plus and Pro entitlements
- Sentry for crash reporting
- React Native Reanimated and Worklets for animations

## Getting Started

### Prerequisites

- Node.js 20.19.4 or newer (required by Expo SDK 56)
- npm
- Xcode and iOS Simulator for iOS development and local App Store releases on macOS
- Android Studio and an emulator for Android development
- EAS CLI for Android cloud builds and optional iOS simulator builds

### Install

```bash
git clone https://github.com/zii144/flash-accounting.git
cd flash-accounting
npm install
```

### Run Locally

```bash
npm start
```

Useful app targets:

```bash
npm run ios
npm run android
npm run web
```

Expo Go is useful for simple local screens, but auth, IAP, Sentry, and other native-gated flows should be validated in a development client or production build.

## Scripts

```bash
npm start                    # Start the Expo dev server
npm run ios                  # Start Expo for iOS on localhost
npm run android              # Run the Android native target
npm run web                  # Start the web target
npm run lint                 # Run Expo ESLint
npm run typecheck            # Run TypeScript without emitting files
npm test                     # Run unit tests
npm run seed:expenses        # Seed default sample records
npm run seed:expenses:all    # Seed all localized sample records
npm run build:ios:sim        # EAS iOS simulator build
npm run build:android:dev    # EAS Android development build
npm run build:ios:prod       # EAS iOS production build
npm run build:android:prod   # EAS Android production build
npm run submit:android:prod  # Submit Android production build
npm run verify:ios:env       # Check iOS release environment setup
npm run release:ios:check    # Pre-archive checks (deps, typecheck, tests, env)
npm run release:ios:bump     # Bump iOS build number in app.json and Info.plist
npm run release:ios:archive  # Create a local Release .xcarchive
npm run release:ios:upload   # Export and upload archive to App Store Connect
npm run release:ios:testflight  # Full local pipeline: check → archive → upload
```

## Project Structure

```text
app/
  _layout.tsx                # Root providers and navigation shell
  (tabs)/                    # Accounting, statistics, and diagram tabs
  settings.tsx               # Settings route
  glossary.tsx               # Glossary management route
  select-language.tsx        # Language selection route
components/                  # Screens, forms, list items, sheets, and UI primitives
contexts/                    # Theme, language, auth, Pro, diagram, and glossary state
hooks/                       # Storage, statistics, and speech-recognition hooks
types/                       # Shared TypeScript types
utils/                       # Database, sync, export, validation, env, Firebase, RevenueCat, and formatting helpers
docs/                        # Firebase, IAP, Sentry, design-system, roadmap, and caveat docs
scripts/                     # Repo, seed, and release scripts
captures/preview-kit/        # Maestro-driven iOS Simulator pipeline for App Store preview videos (16 languages)
ios/                         # Checked-in native iOS project (bundle ID com.zii.flash.accounting)
tests/                       # Node test runner unit tests
```

## Configuration

The app intentionally degrades to a local-only experience when optional public environment variables are absent.

Firebase cloud sync uses:

```text
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
```

Native OAuth setup can also use:

```text
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

RevenueCat uses:

```text
EXPO_PUBLIC_REVENUECAT_API_KEY_TEST
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID
EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID
EXPO_PUBLIC_REVENUECAT_OFFERING_ID
```

Sentry uses:

```text
EXPO_PUBLIC_SENTRY_DSN
```

See the setup guides for details:

- `docs/FIREBASE.md`
- `docs/IAP.md`
- `docs/SENTRY.md`
- `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md`
- `docs/ROADMAP.md` — product roadmap and current status
- `docs/DESIGN_SYSTEM.md` — design tokens and UI primitives
- `RELEASE_IOS.md` — local iOS archive, upload, and TestFlight workflow
- `captures/preview-kit/README.md` — Maestro pipeline that generates the App Store preview videos

## Auth, Sync, and Plans

Flash Accounting is local-first by default. Users can record data locally without signing in.

- Basic users have local-only storage with the configured free record limit.
- Plus unlocks unlimited local storage through RevenueCat.
- Pro unlocks cloud sync when the user is signed in and has the active Pro entitlement.
- Cloud sync stores records in Firestore and keeps SQLite as the device cache.
- Failed cloud writes stay queued locally for a later sync attempt.
- Manual push and pull recovery actions live in Settings.

For the exact current caveats and next implementation priorities, use `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md` as the source of truth.

## Data Validation

User input is validated before saving:

- Amount must be greater than 0
- Amount is capped at `999,999,999.99`
- Amount supports up to 2 decimal places
- Description is optional and capped at 500 characters
- Type must be `expense` or `income`

Validation logic lives in `utils/validation.ts`.

## Production Builds

### iOS (local Xcode)

iOS production archives and App Store Connect uploads are done locally through Xcode, not EAS. The repo includes a checked-in `ios/` project and a release script that wraps the common steps.

Quick path to TestFlight:

```bash
npm run release:ios:testflight
```

Individual steps:

```bash
npm run release:ios:check
npm run release:ios:bump
npm run release:ios:archive
npm run release:ios:upload
```

See `RELEASE_IOS.md` for the full checklist, versioning rules, QA steps, and troubleshooting.

EAS iOS scripts remain available for simulator or cloud builds when needed:

```bash
npm run build:ios:sim
npm run build:ios:prod
```

### Android (EAS)

```bash
npm run build:android:prod
npm run submit:android:prod
```

Before validating production-only behavior, confirm Firebase, RevenueCat, Sentry, OAuth provider setup, native URL schemes, App Store Connect products, and RevenueCat offerings are configured for the target environment. For iOS releases, run `npm run verify:ios:env` before archiving.

## Troubleshooting

Database issues:

1. Clear app data and reinstall.
2. Confirm migrations ran successfully.
3. Check the local database logs for schema or permission errors.

Build issues:

1. Reinstall dependencies with `npm install`.
2. Clear Expo cache with `npx expo start -c`.
3. Rebuild the development client after changing native dependencies.
4. Avoid using Expo Go as the source of truth for auth, IAP, or other native-gated flows.

## License

Private project. All rights reserved.
