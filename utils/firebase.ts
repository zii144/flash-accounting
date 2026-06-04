import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { getAuth } from "firebase/auth";
import { normalizePublicEnv } from "@/utils/public-env";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY) &&
      normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN) &&
      normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) &&
      normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID)
  );
}

let cached: FirebaseServices | null = null;

export function getFirebase(): FirebaseServices | null {
  if (cached) return cached;
  if (!isFirebaseConfigured()) return null;

  const firebaseConfig = {
    apiKey: normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY)!,
    authDomain: normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN)!,
    projectId: normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID)!,
    storageBucket: normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: normalizePublicEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID)!,
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  // Firebase JS SDK auth works in Expo, but persistence support differs by SDK version.
  // Keep it simple and rely on default behavior to avoid bundling issues.
  const auth: Auth = getAuth(app);

  const firestore = getFirestore(app);

  cached = { app, auth, firestore };
  return cached;
}
