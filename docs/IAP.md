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

## App integration

- SDK config and entitlement helpers: `utils/revenuecat.ts`
- SDK lifecycle wrapper: `utils/revenuecat-service.ts`
- React state and purchase actions: `contexts/ProContext.tsx`
- Settings paywall UI: `components/SettingsScreen.tsx`

Best-practice behaviors implemented:

- Configure RevenueCat once per native session
- Use Firebase UID as RevenueCat `appUserID` after sign-in
- Fall back to anonymous RevenueCat users before sign-in
- Sync email/display name as customer attributes after login
- Resolve access from entitlements, not product IDs
- Restore purchases from settings
- Gracefully disable purchase actions when keys or packages are missing

## Testing notes

- Expo Go loads RevenueCat in Preview API Mode only. Real purchases require a development build or EAS build.
- Use sandbox testers on device for end-to-end purchase validation.
- Restore purchases must remain available for App Store review.

## Useful EAS commands

```bash
npm run build:ios:prod
npm run build:android:prod
npm run submit:ios:prod
npm run submit:android:prod
```

## Local storage limit (free)

Free Basic users are limited to `FREE_LOCAL_RECORD_LIMIT` local records.

Plus unlocks unlimited local storage. Pro unlocks cloud sync when the user is also signed in.
