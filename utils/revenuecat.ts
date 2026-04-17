import { Platform } from "react-native";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

export type RevenueCatConfig = {
  apiKey: string;
  entitlementId: string;
  recommendedMonthlyPrice: string;
  recommendedAnnualPrice: string;
};

export function getRevenueCatConfig(): RevenueCatConfig | null {
  const apiKey = Platform.select({
    ios: readEnv("EXPO_PUBLIC_REVENUECAT_API_KEY_IOS"),
    android: readEnv("EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID"),
    default: undefined,
  });

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    entitlementId: readEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID") ?? "cloud_sync_pro",
    recommendedMonthlyPrice: "USD $1.99 / month",
    recommendedAnnualPrice: "USD $14.99 / year",
  };
}

