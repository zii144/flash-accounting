import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getGoogleClientIdForPlatform,
  getGoogleOAuthRedirectUri,
  GOOGLE_OAUTH_DISCOVERY,
  normalizeEnvValue,
} from "@/utils/google-oauth";
import { logger } from "@/utils/logger";
import { FacebookAuthProvider, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

type AppleAuthenticationModule = typeof import("expo-apple-authentication");
type AuthSessionModule = typeof import("expo-auth-session");
type CryptoModule = typeof import("expo-crypto");

let appleAuthenticationModulePromise: Promise<AppleAuthenticationModule | null> | null = null;
let authSessionModulePromise: Promise<AuthSessionModule | null> | null = null;
let cryptoModulePromise: Promise<CryptoModule | null> | null = null;

const FACEBOOK_DISCOVERY = {
  authorizationEndpoint: "https://www.facebook.com/v6.0/dialog/oauth",
};

function randomNonce(length: number = 32): string {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

function getFacebookAppId(): string | undefined {
  return normalizeEnvValue(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID);
}

async function loadAppleAuthenticationModule(): Promise<AppleAuthenticationModule | null> {
  if (!appleAuthenticationModulePromise) {
    appleAuthenticationModulePromise = import("expo-apple-authentication")
      .then((module) => module)
      .catch((error) => {
        logger.debug("Apple authentication module unavailable", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
  }

  return appleAuthenticationModulePromise;
}

async function loadAuthSessionModule(): Promise<AuthSessionModule | null> {
  if (!authSessionModulePromise) {
    authSessionModulePromise = import("expo-auth-session")
      .then((module) => module)
      .catch((error) => {
        logger.debug("Expo auth session module unavailable", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
  }

  return authSessionModulePromise;
}

async function loadCryptoModule(): Promise<CryptoModule | null> {
  if (!cryptoModulePromise) {
    cryptoModulePromise = import("expo-crypto")
      .then((module) => module)
      .catch((error) => {
        logger.debug("Expo crypto module unavailable", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
  }

  return cryptoModulePromise;
}

export function useProviderAuth() {
  const { isFirebaseReady, signInWithCredential, signOut } = useAuth();
  const { t } = useLanguage();
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [activeAuthProvider, setActiveAuthProvider] = useState<"google" | "facebook" | "apple" | null>(null);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios" || !isFirebaseReady) {
      setIsAppleAuthAvailable(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const appleAuthentication = await loadAppleAuthenticationModule();
        if (!appleAuthentication) {
          return;
        }

        const available = await appleAuthentication.isAvailableAsync();
        if (!cancelled) {
          setIsAppleAuthAvailable(available);
        }
      } catch (error) {
        logger.error("Failed to check Apple auth availability", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFirebaseReady]);

  const getRedirectUri = useCallback(
    (authSession: AuthSessionModule) =>
      authSession.makeRedirectUri({
        scheme: "flashaccounting",
        path: "auth",
      }),
    []
  );

  const handleSignInGoogle = useCallback(async () => {
    if (!isFirebaseReady) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }

    const clientId = getGoogleClientIdForPlatform(Platform.OS);
    if (!clientId) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }

    if (
      Platform.OS === "android" &&
      !normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)
    ) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }

    try {
      setIsAuthBusy(true);
      setActiveAuthProvider("google");
      const authSession = await loadAuthSessionModule();
      if (!authSession) {
        Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
        return;
      }

      const redirectUri = getGoogleOAuthRedirectUri(clientId, Platform.OS, authSession);
      const useAuthorizationCode = Platform.OS !== "web";

      const request = await authSession.loadAsync(
        {
          clientId,
          redirectUri,
          responseType: useAuthorizationCode
            ? authSession.ResponseType.Code
            : authSession.ResponseType.Token,
          scopes: ["openid", "profile", "email"],
          state: randomNonce(),
          usePKCE: useAuthorizationCode,
          prompt: authSession.Prompt.SelectAccount,
        },
        GOOGLE_OAUTH_DISCOVERY
      );
      const result = await request.promptAsync(GOOGLE_OAUTH_DISCOVERY);

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type !== "success") {
        throw new Error("GOOGLE_AUTH_FAILED");
      }

      let accessToken = result.params.access_token as string | undefined;
      let idToken = result.params.id_token as string | undefined;

      if (useAuthorizationCode) {
        const authCode = result.params.code;
        if (!authCode) {
          throw new Error("GOOGLE_CODE_MISSING");
        }
        if (!request.codeVerifier) {
          throw new Error("GOOGLE_CODE_VERIFIER_MISSING");
        }

        const exchangeRequest = new authSession.AccessTokenRequest({
          clientId,
          redirectUri,
          code: authCode,
          extraParams: {
            code_verifier: request.codeVerifier,
          },
        });
        const tokens = await exchangeRequest.performAsync(GOOGLE_OAUTH_DISCOVERY);
        accessToken = tokens.accessToken;
        idToken = tokens.idToken;
      }

      if (!accessToken && !idToken) {
        throw new Error("GOOGLE_TOKEN_MISSING");
      }

      await signInWithCredential(GoogleAuthProvider.credential(idToken ?? null, accessToken));
    } catch (error) {
      logger.error("Google sign-in failed", error);
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setActiveAuthProvider(null);
      setIsAuthBusy(false);
    }
  }, [isFirebaseReady, signInWithCredential, t]);

  const handleSignInFacebook = useCallback(async () => {
    if (!isFirebaseReady) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }

    const appId = getFacebookAppId();
    if (!appId) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }

    try {
      setIsAuthBusy(true);
      setActiveAuthProvider("facebook");
      const authSession = await loadAuthSessionModule();
      if (!authSession) {
        Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
        return;
      }

      const request = await authSession.loadAsync(
        {
          clientId: appId,
          redirectUri: getRedirectUri(authSession),
          responseType: authSession.ResponseType.Token,
          scopes: ["public_profile", "email"],
          state: randomNonce(),
          usePKCE: false,
          extraParams: {
            display: "popup",
          },
        },
        FACEBOOK_DISCOVERY
      );
      const result = await request.promptAsync(FACEBOOK_DISCOVERY);

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type !== "success" || !result.params.access_token) {
        throw new Error("FACEBOOK_AUTH_FAILED");
      }

      await signInWithCredential(FacebookAuthProvider.credential(result.params.access_token));
    } catch (error) {
      logger.error("Facebook sign-in failed", error);
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setActiveAuthProvider(null);
      setIsAuthBusy(false);
    }
  }, [getRedirectUri, isFirebaseReady, signInWithCredential, t]);

  const handleSignInApple = useCallback(async () => {
    if (!isFirebaseReady || !isAppleAuthAvailable) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }
    try {
      setIsAuthBusy(true);
      setActiveAuthProvider("apple");

      const [appleAuthentication, crypto] = await Promise.all([
        loadAppleAuthenticationModule(),
        loadCryptoModule(),
      ]);

      if (!appleAuthentication || !crypto) {
        Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
        return;
      }

      const nonce = randomNonce();
      const hashedNonce = await crypto.digestStringAsync(
        crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const appleCredential = await appleAuthentication.signInAsync({
        requestedScopes: [
          appleAuthentication.AppleAuthenticationScope.FULL_NAME,
          appleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        throw new Error("APPLE_IDENTITY_TOKEN_MISSING");
      }

      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({
        idToken: appleCredential.identityToken,
        rawNonce: nonce,
      });

      await signInWithCredential(credential);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      logger.error("Apple sign-in failed", error);
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setActiveAuthProvider(null);
      setIsAuthBusy(false);
    }
  }, [isAppleAuthAvailable, isFirebaseReady, signInWithCredential, t]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      logger.error("Sign out failed", error);
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    }
  }, [signOut, t]);

  return {
    activeAuthProvider,
    isAuthBusy,
    isAppleAuthAvailable,
    canUseAppleAuth: isFirebaseReady && Platform.OS === "ios" && isAppleAuthAvailable,
    handleSignInGoogle,
    handleSignInFacebook,
    handleSignInApple,
    handleSignOut,
  };
}
