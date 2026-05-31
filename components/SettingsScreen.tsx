import { GlassContainer } from "@/components/GlassContainer";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePro } from "@/contexts/ProContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGlossary } from "@/contexts/GlossaryContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { getAppErrorCode } from "@/utils/app-error";
import { FREE_LOCAL_RECORD_LIMIT } from "@/utils/constants";
import { buildConsumptionsCsv } from "@/utils/export";
import { LOCALE_MAP } from "@/utils/formatting";
import type { AppIconName } from "@/utils/app-icons";
import { getLanguageOptions } from "@/utils/language-options";
import { logger } from "@/utils/logger";
import { seedDemoExpenses } from "@/utils/seed-data/seed-database";
import { router } from "expo-router";
import { SymbolIcon } from "@/components/symbol-icon";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OAuthProvider } from "firebase/auth";

type AppleAuthenticationModule = typeof import("expo-apple-authentication");
type CryptoModule = typeof import("expo-crypto");
type StoragePlanId = "basic" | "plus" | "pro";
type StoragePlanCard = {
  id: StoragePlanId;
  icon: AppIconName;
  title: string;
  price: string;
  description: string;
  features: string[];
};

let appleAuthenticationModulePromise: Promise<AppleAuthenticationModule | null> | null = null;
let cryptoModulePromise: Promise<CryptoModule | null> | null = null;

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

function randomNonce(length: number = 32): string {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

export function SettingsScreen() {
  const { theme } = useTheme();
  const { language, resolvedLanguage, t } = useLanguage();
  const { activeEntryCount } = useGlossary();
  const { user, isSignedIn, isFirebaseReady, signInWithCredential, signOut } = useAuth();
  const {
    annualPrice,
    enableProDebug,
    hasUnlimitedLocal,
    isBusy: isPurchaseBusy,
    isConfigured: isPurchaseConfigured,
    isPlusPackageAvailable,
    isPro,
    monthlyPrice,
    plusPrice,
    purchasePlus,
    purchasePro,
    recommendedPlusPrice,
    restorePurchases,
    signOutResetProDebug,
    storagePlanId,
  } = usePro();
  const cloudEnabled = Boolean(user?.uid && isPro);
  const {
    clearAll,
    getAllForExport,
    isSyncBusy,
    pullCloudToLocal,
    refresh,
    syncLocalToCloud,
    syncSnapshot,
    totalCount,
  } = useConsumptionStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [isStoragePlanSheetVisible, setIsStoragePlanSheetVisible] = useState(false);
  const languages = useMemo(() => getLanguageOptions(t), [t, resolvedLanguage]);
  const currentLanguageLabel =
    languages.find((option) => option.code === language)?.name ?? t("device");
  const showAppleSignIn = isFirebaseReady && Platform.OS === "ios" && isAppleAuthAvailable;
  const showAuthSection = isSignedIn || showAppleSignIn;
  const showCloudSection = cloudEnabled || (isPurchaseConfigured && (isSignedIn || showAppleSignIn));
  const shouldShowPurchaseActions = showCloudSection && !cloudEnabled && !isPro && isPurchaseConfigured;
  const syncPrimaryTitle = syncSnapshot.hasPendingLocalChanges
    ? t("cloudSyncRetryCta")
    : t("cloudSyncSyncCta");
  const syncPrimaryDetail = syncSnapshot.hasPendingLocalChanges
    ? t("cloudSyncRetryDetail")
    : t("cloudSyncSyncDetail");
  const currentStoragePlanLabel =
    storagePlanId === "pro"
      ? t("storagePlanCurrentPro")
      : storagePlanId === "plus"
        ? t("storagePlanCurrentPlus")
        : t("storagePlanCurrentBasic");
  const storagePlanCards = useMemo<StoragePlanCard[]>(
    () => [
      {
        id: "basic",
        icon: "server",
        title: t("storagePlanBasicTitle"),
        price: t("storagePlanBasicPrice"),
        description: t("storagePlanBasicDescription"),
        features: [
          t("storagePlanBasicFeatureLimit"),
          t("storagePlanBasicFeatureNoLogin"),
        ],
      },
      {
        id: "plus",
        icon: "local-drive",
        title: t("storagePlanPlusTitle"),
        price: plusPrice ?? t("storagePlanPlusPrice"),
        description: t("storagePlanPlusDescription"),
        features: [
          t("storagePlanPlusFeatureUnlimited"),
          t("storagePlanPlusFeaturePrivate"),
        ],
      },
      {
        id: "pro",
        icon: "cloud",
        title: t("storagePlanProTitle"),
        price: t("storagePlanProPrice")
          .replace("{monthly}", monthlyPrice ?? t("storagePlanProMonthlyFallback"))
          .replace("{annual}", annualPrice ?? t("storagePlanProAnnualFallback")),
        description: t("storagePlanProDescription"),
        features: [
          t("storagePlanProFeatureSync"),
          t("storagePlanProFeatureRestore"),
          t("storagePlanProFeatureShared"),
          t("storagePlanProFeatureTravel"),
        ],
      },
    ],
    [annualPrice, monthlyPrice, plusPrice, t, resolvedLanguage]
  );

  const handlePurchaseError = useCallback(
    (error: unknown, context: string) => {
      const errorCode = getAppErrorCode(error);
      if (errorCode === "IAP_NOT_CONFIGURED") {
        Alert.alert(t("iapNotReadyTitle"), t("iapNotReadyMessage"));
        return;
      }
      if (errorCode === "PURCHASE_CANCELLED") {
        return;
      }
      if (errorCode === "IAP_PACKAGE_UNAVAILABLE") {
        Alert.alert(t("iapNotReadyTitle"), t("iapPackageUnavailableMessage"));
        return;
      }
      logger.error("Purchase failed", error, { context });
      Alert.alert(t("iapErrorTitle"), t("iapErrorMessage"));
    },
    [t]
  );

  useEffect(() => {
    if (Platform.OS !== "ios" || !isFirebaseReady) {
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

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleLanguagePress = useCallback(() => {
    router.push("/select-language");
  }, []);

  const handleGlossaryPress = useCallback(() => {
    router.push("/glossary");
  }, []);

  const glossarySummary = useMemo(
    () => t("smartGlossaryEntrySummary").replace("{count}", String(activeEntryCount)),
    [activeEntryCount, t],
  );

  const exportToCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const allConsumptions = await getAllForExport();

      if (allConsumptions.length === 0) {
        Alert.alert(t("exportError"), t("noConsumptionsYet"));
        return;
      }

      const csvContent = buildConsumptionsCsv(
        allConsumptions,
        LOCALE_MAP[resolvedLanguage] ?? "en-US"
      );
      const timestamp = new Date().toISOString().split("T")[0];
      const file = new File(Paths.document, `flash-accounting-${timestamp}.csv`);
      await file.write(csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: t("exportCSV"),
        });
        Alert.alert(t("exportSuccess"));
      } else {
        Alert.alert(t("exportError"), t("exportSharingUnavailable"));
      }
    } catch (error) {
      logger.error("Export error", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(t("exportError"), errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [getAllForExport, resolvedLanguage, t]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(t("clearHistory"), t("clearHistoryConfirm"), [
      {
        text: t("cancel"),
        style: "cancel",
      },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await clearAll();
            Alert.alert(t("clearSuccess"));
          } catch (error) {
            logger.error("Clear error", error);
            const errorMessage =
              error instanceof Error ? error.message : t("errorClearHistoryFailed");
            Alert.alert(t("errorOccurred"), errorMessage);
          }
        },
      },
    ]);
  }, [clearAll, t]);

  const handleSignInApple = useCallback(async () => {
    if (!isFirebaseReady || !isAppleAuthAvailable) {
      Alert.alert(t("authNotConfiguredTitle"), t("authNotConfiguredMessage"));
      return;
    }
    try {
      setIsAuthBusy(true);

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

  const handlePurchasePro = useCallback(async (plan: "monthly" | "annual") => {
    try {
      await purchasePro(plan);
    } catch (error) {
      handlePurchaseError(error, plan);
    }
  }, [handlePurchaseError, purchasePro]);

  const handlePurchasePlus = useCallback(async () => {
    try {
      await purchasePlus();
    } catch (error) {
      handlePurchaseError(error, "plus");
    }
  }, [handlePurchaseError, purchasePlus]);

  const handleRestorePro = useCallback(async () => {
    try {
      await restorePurchases();
    } catch (error) {
      handlePurchaseError(error, "restore");
    }
  }, [handlePurchaseError, restorePurchases]);

  const handleSyncLocal = useCallback(() => {
    Alert.alert(t("cloudSyncTitle"), t("cloudSyncSyncConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: async () => {
          try {
            const result = await syncLocalToCloud();
            Alert.alert(t("cloudSyncTitle"), t("cloudSyncSyncDone").replace("{count}", String(result.uploaded)));
          } catch (error) {
            logger.error("Sync local to cloud failed", error);
            Alert.alert(t("cloudSyncTitle"), t("cloudSyncSyncFailed"));
          }
        },
      },
    ]);
  }, [syncLocalToCloud, t]);

  const handlePullCloud = useCallback(() => {
    Alert.alert(t("cloudSyncTitle"), t("cloudSyncPullConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            const result = await pullCloudToLocal();
            Alert.alert(
              t("cloudSyncTitle"),
              t("cloudSyncPullDone").replace("{count}", String(result.downloaded))
            );
          } catch (error) {
            logger.error("Pull cloud to local failed", error);
            Alert.alert(t("cloudSyncTitle"), t("cloudSyncPullFailed"));
          }
        },
      },
    ]);
  }, [pullCloudToLocal, t]);

  const formatSyncDateTime = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString(LOCALE_MAP[resolvedLanguage] ?? "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [resolvedLanguage]);

  const cloudStatusMessage = useMemo(() => {
    if (cloudEnabled) {
      if (syncSnapshot.status === "syncing") {
        return t("cloudSyncStatusSyncing");
      }

      if (syncSnapshot.status === "pending") {
        return t("cloudSyncStatusPending");
      }

      if (syncSnapshot.status === "error") {
        return t("cloudSyncStatusError");
      }

      return t("cloudSyncStatusReady");
    }

    if (isSignedIn && !isPro) {
      return t("cloudSyncLockedSignedIn");
    }

    if (!isSignedIn && isPro) {
      return t("cloudSyncLockedPaid");
    }

    return t("cloudSyncLockedSignedOut");
  }, [cloudEnabled, isPro, isSignedIn, syncSnapshot.status, t]);

  const cloudStatusDetail = useMemo(() => {
    if (!cloudEnabled) {
      return null;
    }

    if (syncSnapshot.status === "pending") {
      return t("cloudSyncPendingDetail");
    }

    if (syncSnapshot.status === "error") {
      return t("cloudSyncErrorDetail");
    }

    if (syncSnapshot.lastSyncedAt) {
      return t("cloudSyncLastSynced").replace(
        "{date}",
        formatSyncDateTime(syncSnapshot.lastSyncedAt)
      );
    }

    return t("cloudSyncNeverSynced");
  }, [cloudEnabled, formatSyncDateTime, syncSnapshot.lastSyncedAt, syncSnapshot.status, t]);

  return (
    <SafeAreaView
      key={resolvedLanguage}
      edges={["top"]}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <GlassContainer intensity="medium" style={styles.headerGlass}>
            <SymbolIcon name="chevron-back" size={20} color={theme.text} />
          </GlassContainer>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{t("settings")}</Text>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.contentInner}>
          <GlassContainer intensity="medium" style={styles.sectionCard}>
            {showAuthSection && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {t("authFeatureTitle")}
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                    {t("authFeatureSubtitle")}
                  </Text>
                </View>

                <View
                  style={[
                    styles.settingItem,
                    { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.settingLeft}>
                    <SymbolIcon name="person-circle" size={22} color={theme.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {isSignedIn ? t("authStatusSignedIn") : t("authStatusSignedOut")}
                      </Text>
                      {isSignedIn ? (
                        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                          {user?.email || user?.displayName || user?.uid}
                        </Text>
                      ) : (
                        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                          {t("authOptionalNote")}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {!isSignedIn ? (
                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={handleSignInApple}
                    disabled={isAuthBusy || !isAppleAuthAvailable}
                  >
                    <View style={styles.settingLeft}>
                      <SymbolIcon name="apple-logo" size={22} color={theme.text} />
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("authContinueApple")}
                      </Text>
                    </View>
                    <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={handleSignOut}
                    disabled={isAuthBusy}
                  >
                    <View style={styles.settingLeft}>
                      <SymbolIcon name="logout" size={22} color={theme.text} />
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("authSignOut")}
                      </Text>
                    </View>
                    <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </>
            )}

            {showCloudSection && (
              <>
                <View
                  style={[
                    styles.settingItem,
                    { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.settingLeft}>
                    <SymbolIcon name="cloud" size={22} color={theme.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("cloudSyncTitle")}
                      </Text>
                      <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                        {cloudStatusMessage}
                      </Text>
                      {cloudStatusDetail ? (
                        <Text style={[styles.settingMeta, { color: theme.textSecondary }]}>
                          {cloudStatusDetail}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {shouldShowPurchaseActions && (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.settingItem,
                        { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => void handlePurchasePro("monthly")}
                      disabled={isPurchaseBusy || !isPurchaseConfigured}
                    >
                      <View style={styles.settingLeft}>
                        <SymbolIcon name="cart" size={22} color={theme.text} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingText, { color: theme.text }]}>
                            {t("cloudSyncMonthlyCta")}
                          </Text>
                          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                            {monthlyPrice ?? t("storagePlanProMonthlyFallback")}
                          </Text>
                        </View>
                      </View>
                      <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.settingItem,
                        { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => void handlePurchasePro("annual")}
                      disabled={isPurchaseBusy || !isPurchaseConfigured}
                    >
                      <View style={styles.settingLeft}>
                        <SymbolIcon name="sparkles" size={22} color={theme.text} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingText, { color: theme.text }]}>
                            {t("cloudSyncAnnualCta")}
                          </Text>
                          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                            {annualPrice ?? t("storagePlanProAnnualFallback")}
                          </Text>
                        </View>
                      </View>
                      <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.settingItem,
                        { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={handleRestorePro}
                      disabled={isPurchaseBusy || !isPurchaseConfigured}
                    >
                      <View style={styles.settingLeft}>
                        <SymbolIcon name="refresh" size={22} color={theme.text} />
                        <Text style={[styles.settingText, { color: theme.text }]}>
                          {t("cloudSyncRestoreCta")}
                        </Text>
                      </View>
                      <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </>
                )}

                {cloudEnabled && (
                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={handleSyncLocal}
                    disabled={isSyncBusy}
                  >
                    <View style={styles.settingLeft}>
                      <SymbolIcon name="cloud-upload" size={22} color={theme.text} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingText, { color: theme.text }]}>
                          {syncPrimaryTitle}
                        </Text>
                        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                          {syncPrimaryDetail}
                        </Text>
                      </View>
                    </View>
                    <SymbolIcon
                      name={isSyncBusy ? "hourglass" : "chevron-forward"}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {cloudEnabled && (
                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={handlePullCloud}
                    disabled={isSyncBusy}
                  >
                    <View style={styles.settingLeft}>
                      <SymbolIcon name="cloud-download" size={22} color={theme.text} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingText, { color: theme.text }]}>
                          {t("cloudSyncPullCta")}
                        </Text>
                        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                          {t("cloudSyncPullDetail")}
                        </Text>
                      </View>
                    </View>
                    <SymbolIcon
                      name={isSyncBusy ? "hourglass" : "chevron-forward"}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}

            {!cloudEnabled && !hasUnlimitedLocal && (
              <View style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.settingLeft}>
                  <SymbolIcon name="server" size={22} color={theme.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>
                      {t("localLimitTitle")}
                    </Text>
                    <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                      {t("localLimitValue")
                        .replace("{count}", String(totalCount))
                        .replace("{limit}", String(FREE_LOCAL_RECORD_LIMIT))}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
              onPress={() => setIsStoragePlanSheetVisible(true)}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="cart" size={22} color={theme.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("storageUpgradeTitle")}
                  </Text>
                  <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                    {currentStoragePlanLabel}
                  </Text>
                  <Text style={[styles.settingMeta, { color: theme.textSecondary }]}>
                    {t("storageUpgradeSubtitle")}
                  </Text>
                </View>
              </View>
              <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity
                style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                onPress={async () => {
                  if (isPro) {
                    await signOutResetProDebug();
                    Alert.alert("Dev", "Pro disabled");
                  } else {
                    await enableProDebug();
                    Alert.alert("Dev", "Pro enabled");
                  }
                }}
              >
                <View style={styles.settingLeft}>
                  <SymbolIcon name="bug" size={22} color={theme.textSecondary} />
                  <Text style={[styles.settingText, { color: theme.textSecondary }]}>
                    {isPro ? "Dev: Disable Pro" : "Dev: Enable Pro"}
                  </Text>
                </View>
                <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}

            {__DEV__ && (
              <TouchableOpacity
                style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                onPress={() => {
                  Alert.alert(
                    "Seed demo expenses",
                    `Replace all records with ~150 demo expenses in ${resolvedLanguage.toUpperCase()}?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Seed",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            const batch = await seedDemoExpenses(resolvedLanguage, {
                              replaceExisting: true,
                            });
                            await refresh();
                            Alert.alert("Dev", `Seeded ${batch.records.length} demo records.`);
                          } catch (error) {
                            logger.error("Failed to seed demo expenses", error);
                            Alert.alert("Dev", "Failed to seed demo expenses.");
                          }
                        },
                      },
                    ],
                  );
                }}
              >
                <View style={styles.settingLeft}>
                  <SymbolIcon name="local-drive" size={22} color={theme.textSecondary} />
                  <Text style={[styles.settingText, { color: theme.textSecondary }]}>
                    Dev: Seed demo expenses
                  </Text>
                </View>
                <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </GlassContainer>

          <GlassContainer intensity="medium" style={styles.sectionCard}>
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={exportToCSV}
              disabled={isExporting}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="download" size={22} color={theme.text} />
                <Text style={[styles.settingText, { color: theme.text }]}>{t("exportCSV")}</Text>
              </View>
              {isExporting ? (
                <SymbolIcon name="hourglass" size={20} color={theme.textSecondary} />
              ) : (
                <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              onPress={handleGlossaryPress}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="sparkles" size={22} color={theme.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("smartGlossaryTitle")}
                  </Text>
                  <Text style={[styles.settingMeta, { color: theme.textSecondary }]}>
                    {t("smartGlossarySubtitle")}
                  </Text>
                </View>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                  {glossarySummary}
                </Text>
                <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              onPress={handleLanguagePress}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="language" size={22} color={theme.text} />
                <Text style={[styles.settingText, { color: theme.text }]}>
                  {t("selectLanguage")}
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                  {currentLanguageLabel}
                </Text>
                <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </GlassContainer>

          <GlassContainer intensity="medium" style={styles.sectionCard}>
            <TouchableOpacity style={styles.settingItem} onPress={handleClearHistory}>
              <View style={styles.settingLeft}>
                <SymbolIcon name="trash" size={22} color="#FF3B30" />
                <Text style={[styles.settingText, { color: "#FF3B30" }]}>
                  {t("clearHistory")}
                </Text>
              </View>
              <SymbolIcon name="chevron-forward" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </GlassContainer>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={isStoragePlanSheetVisible}
        onRequestClose={() => setIsStoragePlanSheetVisible(false)}
      >
        <SafeAreaView style={[styles.planSheet, { backgroundColor: theme.background }]}>
          <View style={styles.planSheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planSheetEyebrow, { color: theme.textSecondary }]}>
                {t("storageUpgradeEyebrow")}
              </Text>
              <Text style={[styles.planSheetTitle, { color: theme.text }]}>
                {t("storageUpgradeTitle")}
              </Text>
              <Text style={[styles.planSheetSubtitle, { color: theme.textSecondary }]}>
                {t("storageUpgradeIntro")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsStoragePlanSheetVisible(false)}
              style={[styles.planSheetClose, { backgroundColor: theme.surface }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <SymbolIcon name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.planSheetContent}
          >
            {storagePlanCards.map((plan) => {
              const isCurrentPlan = plan.id === storagePlanId;
              return (
                <GlassContainer
                  key={plan.id}
                  intensity="medium"
                  style={[
                    styles.planCard,
                    {
                      borderColor: isCurrentPlan ? theme.foreground : theme.border,
                      backgroundColor: theme.isDark
                        ? "rgba(28, 28, 30, 0.72)"
                        : "rgba(255, 255, 255, 0.78)",
                    },
                  ]}
                >
                  <View style={styles.planCardHeader}>
                    <View style={styles.planTitleRow}>
                      <SymbolIcon name={plan.icon} size={22} color={theme.text} />
                      <Text style={[styles.planTitle, { color: theme.text }]}>{plan.title}</Text>
                    </View>
                    {isCurrentPlan ? (
                      <View style={[styles.currentBadge, { backgroundColor: theme.foreground }]}>
                        <Text style={[styles.currentBadgeText, { color: theme.background }]}>
                          {t("storagePlanCurrentBadge")}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.planPrice, { color: theme.text }]}>{plan.price}</Text>
                  <Text style={[styles.planDescription, { color: theme.textSecondary }]}>
                    {plan.description}
                  </Text>

                  <View style={styles.planFeatureList}>
                    {plan.features.map((feature) => (
                      <View key={feature} style={styles.planFeatureRow}>
                        <SymbolIcon name="checkmark-circle" size={17} color={theme.textSecondary} />
                        <Text style={[styles.planFeatureText, { color: theme.textSecondary }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </GlassContainer>
              );
            })}

            <GlassContainer intensity="medium" style={styles.planActionsCard}>
              <Text style={[styles.planActionsTitle, { color: theme.text }]}>
                {t("storageUpgradeActionsTitle")}
              </Text>

              <TouchableOpacity
                style={[styles.planActionButton, { backgroundColor: theme.foreground }]}
                onPress={() => void handlePurchasePro("annual")}
                disabled={isPurchaseBusy || !isPurchaseConfigured}
              >
                <Text style={[styles.planActionButtonText, { color: theme.background }]}>
                  {t("storageUpgradeProAnnualCta").replace(
                    "{price}",
                    annualPrice ?? t("storagePlanProAnnualFallback")
                  )}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.planSecondaryButton,
                  { borderColor: theme.border },
                  (!isPurchaseConfigured || isPurchaseBusy) && { opacity: 0.56 },
                ]}
                onPress={() => void handlePurchasePro("monthly")}
                disabled={isPurchaseBusy || !isPurchaseConfigured}
              >
                <Text style={[styles.planSecondaryButtonText, { color: theme.text }]}>
                  {t("storageUpgradeProMonthlyCta").replace(
                    "{price}",
                    monthlyPrice ?? t("storagePlanProMonthlyFallback")
                  )}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.planSecondaryButton,
                  { borderColor: theme.border },
                  (!isPurchaseConfigured || isPurchaseBusy || !isPlusPackageAvailable) && {
                    opacity: 0.56,
                  },
                ]}
                onPress={() => void handlePurchasePlus()}
                disabled={isPurchaseBusy || !isPurchaseConfigured || !isPlusPackageAvailable}
              >
                <Text style={[styles.planSecondaryButtonText, { color: theme.text }]}>
                  {isPlusPackageAvailable
                    ? t("storageUpgradePlusCta").replace(
                        "{price}",
                        plusPrice ?? recommendedPlusPrice
                      )
                    : t("storageUpgradePlusComingSoon")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.planRestoreButton}
                onPress={handleRestorePro}
                disabled={isPurchaseBusy || !isPurchaseConfigured}
              >
                <Text style={[styles.planRestoreText, { color: theme.textSecondary }]}>
                  {t("cloudSyncRestoreCta")}
                </Text>
              </TouchableOpacity>

              {!isPurchaseConfigured ? (
                <Text style={[styles.planFootnote, { color: theme.textSecondary }]}>
                  {t("iapNotReadyMessage")}
                </Text>
              ) : null}
            </GlassContainer>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
  },
  headerGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  contentInner: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: 16,
  },
  sectionCard: {
    borderRadius: 24,
    overflow: "hidden",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  settingSection: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  settingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingValue: {
    fontWeight: "600",
  },
  settingMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  planSheet: {
    flex: 1,
  },
  planSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  planSheetEyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  planSheetTitle: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  planSheetSubtitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 21,
  },
  planSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  planSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    overflow: "hidden",
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  planTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  currentBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  planPrice: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  planDescription: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  planFeatureList: {
    gap: 9,
    marginTop: 14,
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  planFeatureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  planActionsCard: {
    borderRadius: 24,
    padding: 18,
    gap: 10,
    overflow: "hidden",
  },
  planActionsTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  planActionsSubtitle: {
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  planActionButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  planActionButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  planSecondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  planSecondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  planRestoreButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  planRestoreText: {
    fontSize: 14,
    fontWeight: "700",
  },
  planFootnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
