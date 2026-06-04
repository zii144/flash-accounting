const GOOGLE_CLIENT_ID_PREFIX_PATTERN = /^(\d+)-/;
const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

/** Numeric project prefix from a Google OAuth client ID (e.g. `329368845776-abc...`). */
export function getGoogleOAuthClientPrefix(clientId: string): string | undefined {
  const match = clientId.match(GOOGLE_CLIENT_ID_PREFIX_PATTERN);
  return match?.[1];
}

/** Dot-reversed Google client ID, matching the "iOS URL scheme" shown in Google Cloud. */
export function getGoogleReversedClientId(clientId: string): string | undefined {
  const normalizedClientId = normalizeEnvValue(clientId);
  if (!normalizedClientId?.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return undefined;
  }

  const clientIdPrefix = normalizedClientId.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  return clientIdPrefix ? `com.googleusercontent.apps.${clientIdPrefix}` : undefined;
}

/** iOS/Android redirect URI required by Google for installed-app OAuth clients. */
export function getGoogleNativeRedirectUri(clientId: string): string | undefined {
  const reversedClientId = getGoogleReversedClientId(clientId);
  if (!reversedClientId) {
    return undefined;
  }
  return `${reversedClientId}:/oauth2redirect`;
}

/** URL scheme to register in Info.plist / Android intent filters for Google OAuth return. */
export function getGoogleNativeUrlScheme(clientId: string): string | undefined {
  return getGoogleReversedClientId(clientId);
}

export function normalizeEnvValue(value?: string): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

export function getGoogleClientIdForPlatform(
  platform: "ios" | "android" | "web" | "windows" | "macos"
): string | undefined {
  const platformClientId =
    platform === "ios"
      ? normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)
      : platform === "android"
        ? normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)
        : normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

  return platformClientId ?? normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
}

type AuthSessionModule = typeof import("expo-auth-session");

export function getGoogleOAuthRedirectUri(
  clientId: string,
  platform: "ios" | "android" | "web" | "windows" | "macos",
  authSession: AuthSessionModule
): string {
  if (platform === "web") {
    return authSession.makeRedirectUri({ path: "auth" });
  }

  const nativeRedirect = getGoogleNativeRedirectUri(clientId);
  if (nativeRedirect) {
    return nativeRedirect;
  }

  return authSession.makeRedirectUri({
    scheme: "flashaccounting",
    path: "auth",
  });
}

export const GOOGLE_OAUTH_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
} as const;
