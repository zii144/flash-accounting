import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import { useAuth } from "@/contexts/AuthContext";
import { AppError } from "@/utils/app-error";
import { logger } from "@/utils/logger";
import { getRevenueCatConfig } from "@/utils/revenuecat";

export type ProPlan = "monthly" | "annual";

type ProContextValue = {
  isPro: boolean;
  isReady: boolean;
  isConfigured: boolean;
  isBusy: boolean;
  monthlyPrice: string | null;
  annualPrice: string | null;
  recommendedMonthlyPrice: string;
  recommendedAnnualPrice: string;
  purchasePro: (plan: ProPlan) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  enableProDebug: () => Promise<void>;
  signOutResetProDebug: () => Promise<void>;
};

const ProContext = createContext<ProContextValue | null>(null);

function getPurchasePackage(offering: PurchasesOffering | null, plan: ProPlan): PurchasesPackage | null {
  if (!offering) {
    return null;
  }

  if (plan === "annual") {
    return offering.annual ?? offering.availablePackages[0] ?? null;
  }

  return offering.monthly ?? offering.availablePackages[0] ?? null;
}

function hasActiveEntitlement(customerInfo: CustomerInfo | null, entitlementId: string): boolean {
  if (!customerInfo) {
    return false;
  }

  return Boolean(customerInfo.entitlements.active[entitlementId]);
}

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const config = useMemo(() => getRevenueCatConfig(), []);
  const configuredRef = useRef(false);
  const lastKnownAppUserIdRef = useRef<string | null>(null);
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

    const targetAppUserId = user?.uid ?? null;

    try {
      if (!configuredRef.current) {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }

        Purchases.configure({
          apiKey: config.apiKey,
          appUserID: targetAppUserId ?? undefined,
        });

        configuredRef.current = true;
        lastKnownAppUserIdRef.current = targetAppUserId;
      } else if (lastKnownAppUserIdRef.current !== targetAppUserId) {
        if (targetAppUserId) {
          const result = await Purchases.logIn(targetAppUserId);
          setCustomerInfo(result.customerInfo);
        } else if (lastKnownAppUserIdRef.current) {
          try {
            const anonymousCustomerInfo = await Purchases.logOut();
            setCustomerInfo(anonymousCustomerInfo);
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              (error as { code?: string }).code === PURCHASES_ERROR_CODE.LOG_OUT_ANONYMOUS_USER_ERROR
            ) {
              logger.debug("RevenueCat user already anonymous");
            } else {
              throw error;
            }
          }
        }

        lastKnownAppUserIdRef.current = targetAppUserId;
      }

      const [nextCustomerInfo, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);

      setCustomerInfo(nextCustomerInfo);
      setOffering(offerings.current);
    } catch (error) {
      logger.error("Failed to sync RevenueCat state", error);
    } finally {
      setIsReady(true);
    }
  }, [config, user?.uid]);

  useEffect(() => {
    if (!config) {
      setIsReady(true);
      return;
    }

    const listener = (nextCustomerInfo: CustomerInfo) => {
      setCustomerInfo(nextCustomerInfo);
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    void syncRevenueCatState();

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [config, syncRevenueCatState]);

  const purchasePro = useCallback(
    async (plan: ProPlan) => {
      if (!config) {
        throw new AppError("IAP_NOT_CONFIGURED");
      }

      setIsBusy(true);
      try {
        let currentOffering = offering;
        if (!currentOffering) {
          const offerings = await Purchases.getOfferings();
          currentOffering = offerings.current;
          setOffering(currentOffering);
        }

        const purchasePackage = getPurchasePackage(currentOffering, plan);
        if (!purchasePackage) {
          throw new AppError("IAP_PACKAGE_UNAVAILABLE");
        }

        const result = await Purchases.purchasePackage(purchasePackage);
        setCustomerInfo(result.customerInfo);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          throw new AppError("PURCHASE_CANCELLED");
        }

        throw error;
      } finally {
        setIsBusy(false);
      }
    },
    [config, offering]
  );

  const restorePurchases = useCallback(async () => {
    if (!config) {
      throw new AppError("IAP_NOT_CONFIGURED");
    }

    setIsBusy(true);
    try {
      const nextCustomerInfo = await Purchases.restorePurchases();
      setCustomerInfo(nextCustomerInfo);
    } finally {
      setIsBusy(false);
    }
  }, [config]);

  const refreshEntitlements = useCallback(async () => {
    await syncRevenueCatState();
  }, [syncRevenueCatState]);

  const value = useMemo<ProContextValue>(() => {
    const entitlementId = config?.entitlementId ?? "cloud_sync_pro";
    const monthlyPrice = offering?.monthly?.product.priceString ?? null;
    const annualPrice = offering?.annual?.product.priceString ?? null;

    return {
      isPro: debugOverride || hasActiveEntitlement(customerInfo, entitlementId),
      isReady,
      isConfigured: Boolean(config),
      isBusy,
      monthlyPrice,
      annualPrice,
      recommendedMonthlyPrice: config?.recommendedMonthlyPrice ?? "USD $1.99 / month",
      recommendedAnnualPrice: config?.recommendedAnnualPrice ?? "USD $14.99 / year",
      purchasePro,
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
