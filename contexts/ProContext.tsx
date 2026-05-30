import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/utils/logger";
import {
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
  restoreRevenueCatPurchases,
  syncRevenueCatCustomerProfile,
} from "@/utils/revenuecat-service";

export type { ProPlan, StoragePlanId };

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
  restorePurchases: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  enableProDebug: () => Promise<void>;
  signOutResetProDebug: () => Promise<void>;
};

const ProContext = createContext<ProContextValue | null>(null);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const config = useMemo(() => getRevenueCatConfig(), []);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [debugOverride, setDebugOverride] = useState(false);

  const syncRevenueCatState = useCallback(async () => {
    if (!config) {
      setIsReady(true);
      return;
    }

    try {
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
  }, [config, user?.displayName, user?.email, user?.uid]);

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
