import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import * as Localization from "expo-localization";
import { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/utils/logger";
import {
  getRevenueCatPreferredLocale,
  getPurchasePackage,
  getRevenueCatConfig,
  hasUnlimitedLocalAccess,
  resolveStoragePlan,
  type ProPlan,
  type StoragePlanId,
} from "@/utils/revenuecat";
import {
  addRevenueCatCustomerInfoListener,
  fetchRevenueCatState,
  purchaseRevenueCatPlan,
  presentRevenueCatPaywall,
  restoreRevenueCatPurchases,
  setRevenueCatPreferredLocale,
  syncRevenueCatCustomerProfile,
} from "@/utils/revenuecat-service";

export type { ProPlan, StoragePlanId };

type PaywallPresentationResult = {
  result: PAYWALL_RESULT;
  storagePlanId: StoragePlanId | null;
};

type ProContextValue = {
  storagePlanId: StoragePlanId;
  isPro: boolean;
  isPlus: boolean;
  hasUnlimitedLocal: boolean;
  isReady: boolean;
  isConfigured: boolean;
  isBusy: boolean;
  monthlyPrice: string | null;
  annualPrice: string | null;
  plusPrice: string | null;
  isPlusPackageAvailable: boolean;
  recommendedMonthlyPrice: string;
  recommendedAnnualPrice: string;
  recommendedPlusPrice: string;
  purchasePro: (plan: ProPlan) => Promise<void>;
  purchasePlus: () => Promise<void>;
  presentPaywall: () => Promise<PaywallPresentationResult>;
  restorePurchases: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  enableProDebug: () => Promise<void>;
  signOutResetProDebug: () => Promise<void>;
};

const ProContext = createContext<ProContextValue | null>(null);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { language, resolvedLanguage } = useLanguage();
  const config = useMemo(() => getRevenueCatConfig(), []);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [debugOverride, setDebugOverride] = useState(false);
  const preferredPaywallLocale = useMemo(() => {
    const deviceLocaleTag = Localization.getLocales()[0]?.languageTag ?? null;
    return getRevenueCatPreferredLocale(language, resolvedLanguage, deviceLocaleTag);
  }, [language, resolvedLanguage]);

  const syncRevenueCatState = useCallback(async () => {
    if (!config) {
      setIsReady(true);
      return;
    }

    try {
      await setRevenueCatPreferredLocale(preferredPaywallLocale);
      await syncRevenueCatCustomerProfile({
        appUserId: user?.uid ?? null,
        email: user?.email,
        displayName: user?.displayName,
      });

      const nextState = await fetchRevenueCatState();
      setCustomerInfo(nextState.customerInfo);
      setOffering(nextState.offering);
    } catch (error) {
      logger.error("Failed to sync RevenueCat state", error);
      setOffering(null);
    } finally {
      setIsReady(true);
    }
  }, [config, preferredPaywallLocale, user?.displayName, user?.email, user?.uid]);

  useEffect(() => {
    if (!config) {
      setIsReady(true);
      return;
    }

    const removeListener = addRevenueCatCustomerInfoListener((nextCustomerInfo) => {
      setCustomerInfo(nextCustomerInfo);
    });

    void syncRevenueCatState();

    return removeListener;
  }, [config, syncRevenueCatState]);

  useEffect(() => {
    if (!config) {
      return;
    }

    void setRevenueCatPreferredLocale(preferredPaywallLocale);
  }, [config, preferredPaywallLocale]);

  const purchasePro = useCallback(async (plan: ProPlan) => {
    setIsBusy(true);
    try {
      const nextCustomerInfo = await purchaseRevenueCatPlan(plan);
      setCustomerInfo(nextCustomerInfo);
      const nextState = await fetchRevenueCatState();
      setOffering(nextState.offering);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const purchasePlus = useCallback(async () => {
    setIsBusy(true);
    try {
      const nextCustomerInfo = await purchaseRevenueCatPlan("plus");
      setCustomerInfo(nextCustomerInfo);
      const nextState = await fetchRevenueCatState();
      setOffering(nextState.offering);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    setIsBusy(true);
    try {
      const nextCustomerInfo = await restoreRevenueCatPurchases();
      setCustomerInfo(nextCustomerInfo);
      const nextState = await fetchRevenueCatState();
      setOffering(nextState.offering);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const presentPaywall = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await presentRevenueCatPaywall(preferredPaywallLocale);
      let nextStoragePlanId: StoragePlanId | null = null;

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        const nextState = await fetchRevenueCatState();
        setCustomerInfo(nextState.customerInfo);
        setOffering(nextState.offering);
        nextStoragePlanId = resolveStoragePlan(nextState.customerInfo, {
          proEntitlementId: config?.proEntitlementId ?? "cloud_sync_pro",
          plusEntitlementId: config?.plusEntitlementId ?? "local_unlimited",
        });
      }

      return { result, storagePlanId: nextStoragePlanId };
    } finally {
      setIsBusy(false);
    }
  }, [config?.plusEntitlementId, config?.proEntitlementId, preferredPaywallLocale]);

  const refreshEntitlements = useCallback(async () => {
    await syncRevenueCatState();
  }, [syncRevenueCatState]);

  const value = useMemo<ProContextValue>(() => {
    const entitlementConfig = {
      proEntitlementId: config?.proEntitlementId ?? "cloud_sync_pro",
      plusEntitlementId: config?.plusEntitlementId ?? "local_unlimited",
    };
    const storagePlanId: StoragePlanId = debugOverride
      ? "pro"
      : resolveStoragePlan(customerInfo, entitlementConfig);
    const plusPackage = getPurchasePackage(offering, "plus");

    return {
      storagePlanId,
      isPro: storagePlanId === "pro",
      isPlus: storagePlanId === "plus",
      hasUnlimitedLocal:
        debugOverride || hasUnlimitedLocalAccess(customerInfo, entitlementConfig),
      isReady,
      isConfigured: Boolean(config),
      isBusy,
      monthlyPrice: offering?.monthly?.product.priceString ?? null,
      annualPrice: offering?.annual?.product.priceString ?? null,
      plusPrice: plusPackage?.product.priceString ?? null,
      isPlusPackageAvailable: Boolean(plusPackage),
      recommendedMonthlyPrice: config?.recommendedMonthlyPrice ?? "USD $5.99/month",
      recommendedAnnualPrice: config?.recommendedAnnualPrice ?? "USD $59/year",
      recommendedPlusPrice: config?.recommendedPlusPrice ?? "USD $14.99",
      purchasePro,
      purchasePlus,
      presentPaywall,
      restorePurchases,
      refreshEntitlements,
      enableProDebug: async () => {
        if (__DEV__) {
          setDebugOverride(true);
        }
      },
      signOutResetProDebug: async () => {
        if (__DEV__) {
          setDebugOverride(false);
        }
      },
    };
  }, [
    config,
    customerInfo,
    debugOverride,
    isBusy,
    isReady,
    offering,
    purchasePlus,
    presentPaywall,
    purchasePro,
    refreshEntitlements,
    restorePurchases,
  ]);

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProContextValue {
  const ctx = useContext(ProContext);
  if (!ctx) {
    throw new Error("usePro must be used within ProProvider");
  }
  return ctx;
}
