# Flash Accounting

Flash Accounting is a local-first mobile accounting app built with Expo and React Native. It lets users record income and expenses quickly, review spending through statistics and diagrams, export records, and optionally unlock cloud sync through a paid storage plan.

## Current Capabilities

- Add, edit, delete, and page through income and expense records
- SQLite-backed local storage with a free local record limit
- Statistics tab with time filters, sort modes, grouped daily history, and net totals
- Diagram tab for visual spending summaries
- CSV export for recorded transactions
- Device, English, Traditional Chinese, Spanish, French, German, and Japanese language modes
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

- Node.js 18 or newer
- npm
- Xcode and iOS Simulator for iOS development on macOS
- Android Studio and an emulator for Android development
- EAS CLI for cloud builds and store submission

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
npm run submit:ios:prod      # Submit iOS production build
npm run submit:android:prod  # Submit Android production build
npm run verify:ios:env       # Check iOS release environment setup
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
docs/                        # Firebase, IAP, Sentry, and current caveat documentation
scripts/                     # Repo and seed scripts
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

```bash
npm run build:ios:prod
npm run build:android:prod
```

Store submission:

```bash
npm run submit:ios:prod
npm run submit:android:prod
```

Before validating production-only behavior, confirm Firebase, RevenueCat, Sentry, OAuth provider setup, native URL schemes, App Store Connect products, and RevenueCat offerings are configured for the target environment.

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
