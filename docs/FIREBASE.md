# Firebase setup (Auth + Firestore)

This app is **local-first** by default. Firebase is only used when:

1) The user signs in (optional), and  
2) The user has **Pro (Cloud Sync)** unlocked via IAP.

## 1) Create a Firebase project

- Create a project in Firebase Console.
- Add a **Web app** to get the Firebase config values.
- Enable **Authentication providers**:
  - Google
  - Apple
  - Facebook
- Create a **Firestore** database (production mode).

## 2) Configure env vars

Put these into EAS Secrets (recommended) or a local `.env` file (do not commit `.env`):

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- (optional) `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- (optional) `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

Also configure OAuth client IDs for Expo AuthSession:

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_FACEBOOK_APP_ID`

## 3) Native auth notes

- Google / Facebook sign-in here uses `expo-auth-session`.
- Apple sign-in uses `expo-apple-authentication` and requires an iOS native build.
- For production testing, use a development build or store build. Do not rely on Expo Go for final auth verification.

### Google OAuth (iOS / Android)

1. Create **iOS** and **Android** OAuth clients in Google Cloud (not only the Firebase **Web** client).
2. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` in `.env`.
3. Do **not** add `flashaccounting://auth` to the **Web** client redirect list — Google only allows HTTPS URLs there.
4. Native sign-in uses redirect `com.googleusercontent.apps.<dot-reversed-client-id>:/oauth2redirect` (derived from the platform client ID; for example `com.googleusercontent.apps.1234567890-abcdefg:/oauth2redirect`). `app.config.ts` registers the matching URL scheme on iOS and the matching Android intent filter when the platform Google client IDs are set.
5. After changing `app.config.ts` or OAuth env vars, rebuild the native app (`npx expo prebuild --clean` then `npx expo run:ios`, or a new EAS build).
6. In Google Cloud **OAuth consent screen**, add your Google account under **Test users** while the app is in **Testing**; otherwise sign-in is blocked for non-testers.

## 4) Firestore data model

User-scoped collection:

- `users/{uid}/consumptions/{consumptionId}`

Document fields match `types/consumption.ts`.

## 5) Firestore security rules (example)

Make sure users can only access their own data:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/consumptions/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 6) Current sync behavior

- Free users save records locally in SQLite.
- Signed-in Pro users sync through Firestore.
- On cloud-enabled startup, the app either refreshes the local cache from Firestore or preserves local data as pending sync state when this device has unsynced changes.
- New cloud-backed writes save locally first, then attempt to sync to Firestore. If the cloud write fails, the local change remains saved and is marked as pending.
