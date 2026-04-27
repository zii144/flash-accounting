# Sentry crash reporting

The app now supports real crash reporting through `@sentry/react-native`.

## Required runtime env

- `EXPO_PUBLIC_SENTRY_DSN`

## Optional runtime env

- `EXPO_PUBLIC_SENTRY_ENABLE_IN_DEV=true`
- `EXPO_PUBLIC_APP_ENV=production`

## Optional build env for source map uploads

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Notes

- The app initializes Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is present.
- In development, Sentry stays off unless `EXPO_PUBLIC_SENTRY_ENABLE_IN_DEV=true`.
- The Expo Metro config is wrapped with Sentry's Expo helper so release builds can carry Sentry debug IDs.
