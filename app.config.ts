import type { ConfigContext, ExpoConfig } from "expo/config";

import appJson from "./app.json";

const base = appJson.expo as ExpoConfig;
const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

function normalizeEnvValue(value?: string): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

function getGoogleNativeUrlScheme(clientId: string): string | undefined {
  const normalizedClientId = normalizeEnvValue(clientId);
  if (!normalizedClientId?.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return undefined;
  }

  const clientIdPrefix = normalizedClientId.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  return clientIdPrefix ? `com.googleusercontent.apps.${clientIdPrefix}` : undefined;
}

function getConfiguredUrlSchemes(config: ExpoConfig): string[] {
  if (Array.isArray(config.scheme)) {
    return config.scheme;
  }
  return config.scheme ? [config.scheme] : [];
}

function hasIosUrlScheme(config: ExpoConfig, urlScheme: string): boolean {
  const existingTypes = config.ios?.infoPlist?.CFBundleURLTypes;
  const urlTypes = Array.isArray(existingTypes) ? existingTypes : [];

  return urlTypes.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "CFBundleURLSchemes" in entry &&
      Array.isArray(entry.CFBundleURLSchemes) &&
      entry.CFBundleURLSchemes.includes(urlScheme)
  );
}

function withIosUrlSchemes(config: ExpoConfig, urlSchemes: string[]): ExpoConfig {
  const missingSchemes = urlSchemes.filter((scheme) => !hasIosUrlScheme(config, scheme));

  if (missingSchemes.length === 0) {
    return config;
  }

  const existingTypes = config.ios?.infoPlist?.CFBundleURLTypes;
  const urlTypes = Array.isArray(existingTypes) ? [...existingTypes] : [];

  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        CFBundleURLTypes: [
          ...urlTypes,
          ...missingSchemes.map((scheme) => ({
            CFBundleURLSchemes: [scheme],
          })),
        ],
      },
    },
  };
}

function withGoogleIosUrlSchemes(config: ExpoConfig): ExpoConfig {
  const iosClientId = normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const googleScheme = iosClientId ? getGoogleNativeUrlScheme(iosClientId) : undefined;
  const urlSchemes = [...getConfiguredUrlSchemes(config), ...(googleScheme ? [googleScheme] : [])];

  if (urlSchemes.length === 0) {
    return config;
  }

  return withIosUrlSchemes(config, urlSchemes);
}

function hasGoogleAndroidIntentFilter(config: ExpoConfig, googleScheme: string): boolean {
  return Boolean(
    config.android?.intentFilters?.some((filter) => {
      const dataEntries = Array.isArray(filter.data) ? filter.data : [filter.data];
      return dataEntries.some((data) => data?.scheme === googleScheme);
    })
  );
}

function withGoogleAndroidUrlScheme(config: ExpoConfig): ExpoConfig {
  const androidClientId = normalizeEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  const googleScheme = androidClientId ? getGoogleNativeUrlScheme(androidClientId) : undefined;

  if (!googleScheme || hasGoogleAndroidIntentFilter(config, googleScheme)) {
    return config;
  }

  return {
    ...config,
    android: {
      ...config.android,
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: "VIEW",
          category: ["BROWSABLE", "DEFAULT"],
          data: [{ scheme: googleScheme }],
        },
      ],
    },
  };
}

function withGoogleNativeUrlSchemes(config: ExpoConfig): ExpoConfig {
  return withGoogleAndroidUrlScheme(withGoogleIosUrlSchemes(config));
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const merged = {
    ...base,
    ...config,
    ios: { ...base.ios, ...config?.ios },
    android: { ...base.android, ...config?.android },
  };

  return withGoogleNativeUrlSchemes(merged);
};
