import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { AppError } from "@/utils/app-error";
import { logger } from "@/utils/logger";
import {
  getCurrentOffering,
  getPurchasePackage,
  getRevenueCatConfig,
  isRevenueCatSupportedPlatform,
  mapRevenueCatError,
  type PurchasePlan,
  type RevenueCatConfig,
} from "@/utils/revenuecat";

type CustomerProfile = {
  appUserId: string | null;
  email?: string | null;
  displayName?: string | null;
};

let configured = false;
let configuredAppUserId: string | null | undefined = undefined;

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function configureRevenueCat(appUserId?: string | null): Promise<RevenueCatConfig | null> {
  const config = getRevenueCatConfig();
  if (!config || !isRevenueCatSupportedPlatform()) {
    return null;
  }

  if (!configured) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey: config.apiKey,
      appUserID: appUserId ?? undefined,
    });

    configured = true;
    configuredAppUserId = appUserId ?? null;
    return config;
  }

  if (configuredAppUserId !== appUserId) {
    await syncRevenueCatCustomerProfile({
      appUserId: appUserId ?? null,
    });
  }

  return config;
}

export async function syncRevenueCatCustomerProfile(
  profile: CustomerProfile
): Promise<CustomerInfo | null> {
  const config = getRevenueCatConfig();
  if (!config || !isRevenueCatSupportedPlatform()) {
    return null;
  }

  await configureRevenueCat(profile.appUserId ?? null);

  try {
    let customerInfo: CustomerInfo;

    if (profile.appUserId) {
      const loginResult = await Purchases.logIn(profile.appUserId);
      customerInfo = loginResult.customerInfo;
    } else if (configuredAppUserId) {
      try {
        customerInfo = await Purchases.logOut();
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === PURCHASES_ERROR_CODE.LOG_OUT_ANONYMOUS_USER_ERROR
        ) {
          logger.debug("RevenueCat user already anonymous");
          customerInfo = await Purchases.getCustomerInfo();
        } else {
          throw error;
        }
      }
    } else {
      customerInfo = await Purchases.getCustomerInfo();
    }

    configuredAppUserId = profile.appUserId;

    if (profile.email) {
      await Purchases.setEmail(profile.email);
    }

    if (profile.displayName) {
      await Purchases.setDisplayName(profile.displayName);
    }

    return customerInfo;
  } catch (error) {
    logger.error("Failed to sync RevenueCat customer profile", error, profile);
    throw mapRevenueCatError(error);
  }
}

export async function fetchRevenueCatState(): Promise<{
  customerInfo: CustomerInfo;
  offering: PurchasesOffering | null;
}> {
  const config = getRevenueCatConfig();
  if (!config || !isRevenueCatSupportedPlatform()) {
    throw new AppError("IAP_NOT_CONFIGURED");
  }

  await configureRevenueCat(configuredAppUserId ?? null);

  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);

  return {
    customerInfo,
    offering: getCurrentOffering(offerings, config.offeringId),
  };
}

export async function purchaseRevenueCatPlan(plan: PurchasePlan): Promise<CustomerInfo> {
  const config = getRevenueCatConfig();
  if (!config || !isRevenueCatSupportedPlatform()) {
    throw new AppError("IAP_NOT_CONFIGURED");
  }

  await configureRevenueCat(configuredAppUserId ?? null);

  try {
    const offerings = await Purchases.getOfferings();
    const offering = getCurrentOffering(offerings, config.offeringId);
    const purchasePackage = getPurchasePackage(offering, plan);

    if (!purchasePackage) {
      throw new AppError("IAP_PACKAGE_UNAVAILABLE");
    }

    const result = await Purchases.purchasePackage(purchasePackage);
    return result.customerInfo;
  } catch (error) {
    throw mapRevenueCatError(error);
  }
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  const config = getRevenueCatConfig();
  if (!config || !isRevenueCatSupportedPlatform()) {
    throw new AppError("IAP_NOT_CONFIGURED");
  }

  await configureRevenueCat(configuredAppUserId ?? null);

  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    throw mapRevenueCatError(error);
  }
}

export async function presentRevenueCatPaywall(): Promise<PAYWALL_RESULT> {
  const config = getRevenueCatConfig();
  if (!config || !isRevenueCatSupportedPlatform()) {
    throw new AppError("IAP_NOT_CONFIGURED");
  }

  await configureRevenueCat(configuredAppUserId ?? null);

  try {
    const offerings = await Purchases.getOfferings();

    if (!getCurrentOffering(offerings, config.offeringId)) {
      throw new AppError("IAP_PACKAGE_UNAVAILABLE");
    }

    if (__DEV__) {
      logger.debug("Presenting RevenueCat paywall", {
        currentOfferingId: offerings.current?.identifier ?? null,
        configuredOfferingId: config.offeringId,
      });
    }

    // Omit offering so RevenueCat presents the paywall attached to the dashboard "Current" offering.
    return await RevenueCatUI.presentPaywall();
  } catch (error) {
    throw mapRevenueCatError(error);
  }
}

export function addRevenueCatCustomerInfoListener(
  listener: (customerInfo: CustomerInfo) => void
): () => void {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
