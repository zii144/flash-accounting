# iOS Release Guide

This project releases iOS locally through Xcode. Do not use EAS for the production archive or App Store Connect upload.

The repeatable release shape is:

1. Bump the app version and build number.
2. Install and validate dependencies.
3. Sync native iOS changes when needed.
4. Create a local Xcode archive.
5. Upload the archive to App Store Connect.
6. Validate in TestFlight.
7. Submit the App Store version for review.

## App Identity

Keep these stable unless there is a deliberate store migration:

| Field | Value |
|---|---|
| App name | Black White Accounting |
| Traditional Chinese name | 黑白記帳 |
| iOS bundle ID | `com.zii.flash.accounting` |
| Xcode workspace | `ios/flashaccounting.xcworkspace` |
| Xcode scheme | `flashaccounting` |

After the first App Store Connect upload, the bundle ID cannot be changed for that app record.

## One-Time Local Setup

Use a Mac with a current Xcode version, an Apple Developer Program account, and access to the App Store Connect app record for `com.zii.flash.accounting`.

Install project dependencies:

```bash
npm ci
npx pod-install
```

Open the native workspace:

```bash
xed ios
```

In Xcode:

1. Open `ios/flashaccounting.xcworkspace`, not the `.xcodeproj`.
2. Select the `flashaccounting` target.
3. Confirm Signing & Capabilities uses the correct Apple team.
4. Confirm the bundle identifier is `com.zii.flash.accounting`.
5. Confirm automatic signing can create or find distribution provisioning profiles.

## Release Inputs

Before archiving, confirm production environment values are available to the Xcode bundle step.

Required for this app:

- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_SENTRY_DSN`

Optional for Sentry source maps and debug symbol upload:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Do not submit an App Store build with `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST`.

`EXPO_PUBLIC_*` values are baked into `main.jsbundle` at archive time. Use static `process.env.EXPO_PUBLIC_*` access in app code (not `process.env[variable]`) so Expo can inline them. Before archiving, confirm embedding:

```bash
npm run verify:ios:env
```

## Every Release Checklist

Use the streamlined CLI for most steps:

```bash
npm run release:ios:testflight   # check → archive → upload to App Store Connect
```

Individual commands:

```bash
npm run release:ios:check      # deps, typecheck, tests, env verification
npm run release:ios:bump         # increment build number in app.json + Info.plist
npm run release:ios:archive      # xcodebuild Release archive
npm run release:ios:upload       # export + upload latest archive to TestFlight
```

Manual Xcode archive remains supported (see step 6 below) if you prefer Organizer.

### 1. Start Clean

Review local changes and make sure the release branch contains only intentional work:

```bash
git status --short
```

If dependency files changed, prefer a fresh install:

```bash
npm ci
npx pod-install
```

### 2. Bump Version Numbers

For every public app update, bump:

- `expo.version` in `app.json`, for example `1.0.2`.
- `expo.ios.buildNumber` in `app.json`, for example `8`.
- `CFBundleShortVersionString` in `ios/flashaccounting/Info.plist`, matching `expo.version`.
- `CFBundleVersion` in `ios/flashaccounting/Info.plist`, matching `expo.ios.buildNumber`.

Versioning rule:

- Marketing version: user-facing release number, usually `major.minor.patch`.
- Build number: monotonically increasing integer. Every App Store Connect upload for the same marketing version needs a new build number.

Sanity check the native values before archive:

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" ios/flashaccounting/Info.plist
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" ios/flashaccounting/Info.plist
```

### 3. Sync Native Project Only When Needed

This repo checks in `ios/`, so normal JavaScript and TypeScript changes do not require `prebuild`.

Run native sync only after changes to Expo config, config plugins, native dependencies, iOS permissions, app icons, splash screen, bundle identifiers, or localization resources:

```bash
npx expo prebuild --platform ios
npx pod-install
git diff
```

Review the native diff carefully before continuing. Use `--clean` only for an intentional native regeneration, because it can rewrite local iOS project changes.

### 4. Run Release Checks

Run the checks that catch most release-blocking issues before opening Xcode:

```bash
npm run typecheck
npm test
npx expo install --check
```

If `npx expo install --check` reports dependency mismatches, fix them before archiving.

### 5. Device QA Before Archive

Run a local iOS build on a real device or simulator:

```bash
npx expo run:ios --configuration Release
```

Check the flows Apple review is likely to touch:

- App launches from a cold start.
- English app name shows as `Black White Accounting`.
- Traditional Chinese app name shows as `黑白記帳` when the device language is Traditional Chinese.
- Speech recognition and microphone permission prompts are understandable.
- Add, edit, delete, and export accounting records.
- Sign in and sign out.
- RevenueCat paywall opens with real iOS products.
- Restore purchases is visible and works for sandbox/TestFlight testing.
- Offline behavior does not block local bookkeeping.
- Sentry receives a test event if production crash reporting is expected for this release.

### 6. Archive In Xcode

In Xcode:

1. Open `ios/flashaccounting.xcworkspace`.
2. Select the `flashaccounting` scheme.
3. Select `Any iOS Device (arm64)` or a connected physical device.
4. Set build configuration to `Release` if needed.
5. Choose `Product > Archive`.

When the archive completes, Xcode opens Organizer.

### 7. Upload To App Store Connect

In Organizer:

1. Select the new archive.
2. Choose `Distribute App`.
3. Choose `App Store Connect`.
4. Choose `Upload`.
5. Keep symbol upload enabled.
6. Let Xcode manage signing unless there is a specific reason to use manual signing.
7. Confirm the final version and build number.
8. Upload.

After upload, App Store Connect may take several minutes to process the build before it appears.

### 8. TestFlight Validation

In App Store Connect:

1. Wait until the build finishes processing.
2. Add the build to TestFlight internal testing.
3. Install from TestFlight on a real device.
4. Repeat the critical QA checklist.
5. Confirm RevenueCat sees the correct Apple sandbox transactions.
6. Confirm Sentry has release metadata or debug symbols if symbol upload is configured.

Only attach the build to the App Store version after TestFlight looks clean.

### 9. Submit For Review

Before submitting:

- App Store version matches `app.json` and `Info.plist`.
- Build number is the processed TestFlight build number.
- Screenshots match the current UI.
- Privacy Nutrition Labels match Firebase, RevenueCat, Sentry, speech recognition, microphone usage, and data export behavior.
- App Review notes include any sign-in or purchase testing instructions.
- Subscription and one-time purchase products are approved or ready for review.
- Restore purchases is accessible from settings.

Then submit the app version for review.

## Upgrade Playbook

Use this section whenever the app itself is upgraded.

### Patch Release

Use for bug fixes and small copy changes.

1. Bump `expo.version`, `expo.ios.buildNumber`, `CFBundleShortVersionString`, and `CFBundleVersion`.
2. Run `npm ci`.
3. Run `npm run typecheck` and `npm test`.
4. Run `npx pod-install` only if native dependencies or pods changed.
5. Archive and upload through Xcode.

### Minor Release

Use for new user-facing features.

1. Follow the patch release steps.
2. Add TestFlight notes for the new behavior.
3. Re-test settings, onboarding language detection, purchase flows, and export.
4. Update App Store screenshots or metadata if the visible feature set changed.

### Expo SDK Or Native Dependency Upgrade

Use for Expo SDK, React Native, native module, iOS permission, icon, splash, or config plugin changes.

1. Upgrade dependencies.
2. Run `npx expo install --check`.
3. Run `npx expo prebuild --platform ios`.
4. Run `npx pod-install`.
5. Review all native diffs, especially `ios/flashaccounting/Info.plist`, entitlements, build phases, localized resources, and `Podfile.lock`.
6. Run `npm run typecheck`, `npm test`, and a release device build.
7. Archive and upload through Xcode.

## Troubleshooting

### Build Does Not Appear In App Store Connect

Wait for processing first. If it still does not appear, check that:

- The bundle ID is `com.zii.flash.accounting`.
- The upload completed successfully in Xcode Organizer.
- The App Store Connect app record uses the same bundle ID.
- The version and build number are unique for this app.

### Archive Uses The Wrong Version

Check `ios/flashaccounting/Info.plist`. Local Xcode archives use the native bundle values, so `app.json` alone is not enough when `ios/` is checked in.

### RevenueCat Shows Test Store In Release

Remove `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` from the release environment and confirm `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` is set.

### Sentry Upload Fails

If the app archive succeeds but Sentry symbol upload fails, verify:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `ios/sentry.properties`

If the release is urgent, decide whether to continue without symbol upload and document that decision in the release notes.

## References

- Expo: Create a production build locally - https://docs.expo.dev/guides/local-app-production/
- Expo: Local app development - https://docs.expo.dev/guides/local-app-development/
- Apple: Upload builds to App Store Connect - https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- Apple: Distributing your app for beta testing and releases - https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/
