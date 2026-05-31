# IAP (Storage Plans) with RevenueCat

This app uses [RevenueCat](https://www.revenuecat.com/) as the single source of truth for purchase and entitlement state on iOS and Android.

## Plans

| Plan | RevenueCat entitlement | Product type |
|---|---|---|
| Basic | none | free |
| Plus | `local_unlimited` | one-time / lifetime package |
| Pro | `cloud_sync_pro` | auto-renewable subscription |

Recommended launch pricing:

- Plus: **USD $14.99** one-time
- Pro monthly: **USD $5.99 / month**
- Pro yearly: **USD $59 / year**

## RevenueCat env vars

- `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` for RevenueCat Test Store in local development builds only
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
- `EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID` (defaults to `cloud_sync_pro`)
- `EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID` (defaults to `local_unlimited`)
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` (defaults to `default`)

Legacy fallback:

- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` is still read as the Pro entitlement if `EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID` is not set.

## Dashboard setup

1. Create App Store Connect / Play Console products:
   - Plus lifetime / non-consumable or lifetime package
   - Pro monthly subscription
   - Pro annual subscription
2. In RevenueCat:
   - Create entitlements `local_unlimited` and `cloud_sync_pro`
   - Attach products to the matching entitlements
   - Create a current offering (default) with:
     - lifetime package for Plus
     - monthly package for Pro
     - annual package for Pro
3. Add the public SDK keys to EAS secrets or local env files.

Recommended key strategy:

- local Metro-driven development build: `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST`
- release/testing builds that talk to Apple or Google: platform public SDK keys

Never submit an App Store or Play build with the Test Store key configured.

## App integration

- SDK config and entitlement helpers: `utils/revenuecat.ts`
- SDK lifecycle wrapper: `utils/revenuecat-service.ts`
- RevenueCat paywall presentation: `react-native-purchases-ui`
- React state and purchase actions: `contexts/ProContext.tsx`
- Settings paywall UI: `components/SettingsScreen.tsx`

Best-practice behaviors implemented:

- Configure RevenueCat once per native session
- Use Firebase UID as RevenueCat `appUserID` after sign-in
- Fall back to anonymous RevenueCat users before sign-in
- Sync email/display name as customer attributes after login
- Resolve access from entitlements, not product IDs
- Present the current offering paywall from RevenueCat's Paywall editor
- Restore purchases from settings
- Gracefully disable purchase actions when keys or packages are missing

## Testing notes

- Expo Go loads RevenueCat in Preview API Mode only. Real purchases require a development build or EAS build.
- Use RevenueCat Test Store first for local payment development and UI-state testing.
- Use sandbox testers on device for end-to-end purchase validation against the real stores.
- Restore purchases must remain available for App Store review.

## Suggested testing flow

1. Local payment development with RevenueCat Test Store
   - Add `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` to your local env file
   - Create test products and attach them to the `default` offering in RevenueCat
   - Run a dev client build:
     - `npm run build:ios:sim`
     - `npm run build:android:dev`
   - Start Metro with `npm start`
   - In the development build, purchase buttons will open RevenueCat's Test Store modal instead of the native store sheet
2. Store sandbox validation
   - Switch back to `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` and `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
   - Configure real products in App Store Connect / Play Console and attach them to the same entitlements/offering
   - Test with Apple sandbox accounts, TestFlight, Play internal testing, or licensed test accounts
3. App behavior checklist
   - Plus purchase unlocks unlimited local storage
   - Pro monthly purchase unlocks cloud sync only when signed in
   - Pro annual purchase unlocks cloud sync only when signed in
   - Cancelled purchase keeps the user on the current plan
   - Restore purchases rehydrates entitlements after reinstall or sign-in
   - Sign-in and sign-out keep RevenueCat customer identity in sync

## Build prerequisites for store testing

- iOS bundle ID: `com.zii.flash.accounting`
- Android application ID: `com.zii.flash.accounting`
- RevenueCat app identifiers must match the IDs above for the corresponding store apps

## Useful EAS commands

```bash
npm run build:ios:sim
npm run build:android:dev
npm run build:ios:prod
npm run build:android:prod
npm run submit:ios:prod
npm run submit:android:prod
```

## Local storage limit (free)

Free Basic users are limited to `FREE_LOCAL_RECORD_LIMIT` local records.

Plus unlocks unlimited local storage. Pro unlocks cloud sync when the user is also signed in.
