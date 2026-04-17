# IAP (Cloud Sync Pro) plan

Cloud sync is a **digital service**. On iOS, unlock it via **In-App Purchase** (IAP).

This repo currently includes:

- RevenueCat-backed entitlement handling in `contexts/ProContext.tsx`
- Purchase and restore entry points in `components/SettingsScreen.tsx`
- Recommended launch pricing fallback when live offerings are not yet configured

## Recommended product

Use an auto-renewable subscription:

- Monthly: **USD $1.99 / month**
- Yearly: **USD $14.99 / year**

Why:
- Ongoing backend cost fits subscription
- Auto-renewable subscriptions fit ongoing cloud service access on iOS
- Pricing stays low-friction while avoiding an unsustainably deep annual discount
- Yearly still gives a clear savings incentive over monthly billing

## RevenueCat env vars

- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`

## App Store Connect / RevenueCat setup

1. Create a subscription group in App Store Connect.
2. Create two auto-renewable subscriptions:
   - monthly cloud sync
   - annual cloud sync
3. Mirror those products in RevenueCat and attach them to one entitlement:
   - `cloud_sync_pro`
4. Set the current offering in RevenueCat with monthly and annual packages.
5. Add the iOS and Android public SDK keys to EAS secrets or local env files.

## Useful EAS commands

```bash
# iOS/Android production builds
npm run build:ios:prod
npm run build:android:prod

# submissions
npm run submit:ios:prod
npm run submit:android:prod
```

## Local storage limit (free)

Free users are limited to a fixed number of local records (see `FREE_LOCAL_RECORD_LIMIT` in `utils/constants.ts`).

When **signed in + Pro**, records are stored in Firestore (cloud) and the local limit no longer applies.

## Policy note

Cloud sync is an in-app digital service. On iOS, the default compliant path is to unlock it with In-App Purchase / auto-renewable subscriptions.
