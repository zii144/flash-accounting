import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { getAuth } from "firebase/auth";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) return undefined;
  return value;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    readEnv("EXPO_PUBLIC_FIREBASE_API_KEY") &&
      readEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN") &&
      readEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID") &&
      readEnv("EXPO_PUBLIC_FIREBASE_APP_ID")
  );
}

let cached: FirebaseServices | null = null;

export function getFirebase(): FirebaseServices | null {
  if (cached) return cached;
  if (!isFirebaseConfigured()) return null;

  const firebaseConfig = {
    apiKey: readEnv("EXPO_PUBLIC_FIREBASE_API_KEY")!,
    authDomain: readEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN")!,
    projectId: readEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID")!,
    storageBucket: readEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("EXPO_PUBLIC_FIREBASE_APP_ID")!,
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  // Firebase JS SDK auth works in Expo, but persistence support differs by SDK version.
  // Keep it simple and rely on default behavior to avoid bundling issues.
  const auth: Auth = getAuth(app);

  const firestore = getFirestore(app);

  cached = { app, auth, firestore };
  return cached;
}
