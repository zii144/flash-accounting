import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { AppError } from "@/utils/app-error";
import type { ResolvedLanguage } from "@/utils/formatting";

export type StoragePlanId = "basic" | "plus" | "pro";
export type ProPlan = "monthly" | "annual";
export type PurchasePlan = ProPlan | "plus";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

export type RevenueCatConfig = {
  apiKey: string;
  proEntitlementId: string;
  plusEntitlementId: string;
  offeringId: string;
  recommendedMonthlyPrice: string;
  recommendedAnnualPrice: string;
  recommendedPlusPrice: string;
};

export type RevenueCatLanguagePreference = ResolvedLanguage | "device";

export function isRevenueCatSupportedPlatform(): boolean {
  return process.env.EXPO_OS === "ios" || process.env.EXPO_OS === "android";
}

function isRevenueCatDebugBuild(): boolean {
  return (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ === true;
}

function getRevenueCatApiKey(): string | undefined {
  const testApiKey = readEnv("EXPO_PUBLIC_REVENUECAT_API_KEY_TEST");

  if (isRevenueCatDebugBuild() && testApiKey) {
    return testApiKey;
  }

  return process.env.EXPO_OS === "ios"
    ? readEnv("EXPO_PUBLIC_REVENUECAT_API_KEY_IOS")
    : process.env.EXPO_OS === "android"
      ? readEnv("EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID")
      : undefined;
}

export function getRevenueCatConfig(): RevenueCatConfig | null {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    proEntitlementId:
      readEnv("EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID") ??
      readEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID") ??
      "cloud_sync_pro",
    plusEntitlementId: readEnv("EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID") ?? "local_unlimited",
    offeringId: readEnv("EXPO_PUBLIC_REVENUECAT_OFFERING_ID") ?? "default",
    recommendedMonthlyPrice: "USD $5.99/month",
    recommendedAnnualPrice: "USD $59/year",
    recommendedPlusPrice: "USD $14.99",
  };
}

export function getRevenueCatPreferredLocale(
  language: RevenueCatLanguagePreference,
  resolvedLanguage: ResolvedLanguage,
  deviceLocaleTag?: string | null
): string {
  if (language === "device") {
    const normalizedDeviceLocale = normalizeRevenueCatLocale(deviceLocaleTag, resolvedLanguage);
    if (normalizedDeviceLocale) {
      return normalizedDeviceLocale;
    }
  }

  return getRevenueCatLocaleForLanguage(resolvedLanguage);
}

const RESOLVED_LANGUAGE_TO_REVENUECAT_LOCALE: Record<ResolvedLanguage, string> = {
  en: "en_US",
  zh: "zh_Hant",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  ja: "ja",
};

function getRevenueCatLocaleForLanguage(language: ResolvedLanguage): string {
  return (
    readEnv(`EXPO_PUBLIC_REVENUECAT_PAYWALL_LOCALE_${language.toUpperCase()}`) ??
    RESOLVED_LANGUAGE_TO_REVENUECAT_LOCALE[language] ??
    RESOLVED_LANGUAGE_TO_REVENUECAT_LOCALE.en
  );
}

function normalizeRevenueCatLocale(
  localeTag: string | null | undefined,
  resolvedLanguage: ResolvedLanguage
): string | null {
  if (!localeTag) {
    return null;
  }

  const normalized = localeTag.replace(/_/g, "-");
  const lower = normalized.toLowerCase();

  if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo" || lower.startsWith("zh-hant")) {
    return "zh_Hant";
  }

  if (lower === "zh-cn" || lower === "zh-sg" || lower.startsWith("zh-hans")) {
    return "zh_Hans";
  }

  if (lower === "ja" || lower.startsWith("ja-")) {
    return "ja";
  }

  if (SUPPORTED_REVENUECAT_LANGUAGE_CODES.has(lower.split("-")[0] ?? "")) {
    return getRevenueCatLocaleForLanguage(resolvedLanguage);
  }

  return normalized.replace(/-/g, "_");
}

const SUPPORTED_REVENUECAT_LANGUAGE_CODES = new Set(["en", "zh", "es", "fr", "de", "ja"]);

export function hasActiveEntitlement(
  customerInfo: CustomerInfo | null,
  entitlementId: string
): boolean {
  if (!customerInfo) {
    return false;
  }

  return Boolean(customerInfo.entitlements.active[entitlementId]);
}

export function resolveStoragePlan(
  customerInfo: CustomerInfo | null,
  config: Pick<RevenueCatConfig, "proEntitlementId" | "plusEntitlementId">
): StoragePlanId {
  if (hasActiveEntitlement(customerInfo, config.proEntitlementId)) {
    return "pro";
  }

  if (hasActiveEntitlement(customerInfo, config.plusEntitlementId)) {
    return "plus";
  }

  return "basic";
}

export function hasUnlimitedLocalAccess(
  customerInfo: CustomerInfo | null,
  config: Pick<RevenueCatConfig, "proEntitlementId" | "plusEntitlementId">
): boolean {
  const plan = resolveStoragePlan(customerInfo, config);
  return plan === "plus" || plan === "pro";
}

export function getCurrentOffering(
  offerings: { current: PurchasesOffering | null; all: Record<string, PurchasesOffering> },
  offeringId: string
): PurchasesOffering | null {
  // Prefer the offering marked "Current" in RevenueCat — that's where the active paywall is attached.
  return offerings.current ?? offerings.all[offeringId] ?? null;
}

export function getPurchasePackage(
  offering: PurchasesOffering | null,
  plan: PurchasePlan
): PurchasesPackage | null {
  if (!offering) {
    return null;
  }

  const getPackageByType = (packageType: string) =>
    offering.availablePackages.find((purchasePackage) => purchasePackage.packageType === packageType) ??
    null;

  if (plan === "plus") {
    return offering.lifetime ?? getPackageByType("LIFETIME");
  }

  if (plan === "annual") {
    return offering.annual ?? getPackageByType("ANNUAL");
  }

  return offering.monthly ?? getPackageByType("MONTHLY");
}

export function mapRevenueCatError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const purchaseError = error as { code?: string; userCancelled?: boolean };

    if (purchaseError.userCancelled) {
      return new AppError("PURCHASE_CANCELLED");
    }

    if (typeof purchaseError.code === "string") {
      if (purchaseError.code === "PURCHASE_CANCELLED_ERROR") {
        return new AppError("PURCHASE_CANCELLED");
      }

      if (purchaseError.code === "PRODUCT_ALREADY_PURCHASED_ERROR") {
        return new AppError("PRODUCT_ALREADY_PURCHASED");
      }

      if (purchaseError.code === "PURCHASE_NOT_ALLOWED_ERROR") {
        return new AppError("PURCHASE_NOT_ALLOWED");
      }

      if (purchaseError.code === "STORE_PROBLEM_ERROR" || purchaseError.code === "NETWORK_ERROR") {
        return new AppError("IAP_STORE_UNAVAILABLE");
      }
    }
  }

  return new AppError(
    "IAP_ERROR",
    error instanceof Error ? error.message : "Purchase failed",
    { cause: error }
  );
}
