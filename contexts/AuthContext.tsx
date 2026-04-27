import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthCredential, User } from "firebase/auth";
import { onAuthStateChanged, signInWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { getFirebase } from "@/utils/firebase";
import { logger } from "@/utils/logger";
import { setMonitoringUser } from "@/utils/monitoring";

type AuthContextValue = {
  user: User | null;
  isSignedIn: boolean;
  isFirebaseReady: boolean;
  signInWithCredential: (credential: AuthCredential) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const services = getFirebase();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!services) return;
    const unsub = onAuthStateChanged(services.auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, [services]);

  useEffect(() => {
    setMonitoringUser(
      user
        ? {
            id: user.uid,
            email: user.email,
            username: user.displayName,
          }
        : null
    );
  }, [user]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isSignedIn: Boolean(user),
      isFirebaseReady: Boolean(services),
      signInWithCredential: async (credential) => {
        if (!services) {
          throw new Error("FIREBASE_NOT_CONFIGURED");
        }
        await signInWithCredential(services.auth, credential);
      },
      signOut: async () => {
        if (!services) return;
        try {
          await firebaseSignOut(services.auth);
        } catch (error) {
          logger.error("Failed to sign out", error);
          throw error;
        }
      },
    };
  }, [services, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
