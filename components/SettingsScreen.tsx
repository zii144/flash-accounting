import { GlassContainer } from "@/components/GlassContainer";
import { useAuth } from "@/contexts/AuthContext";
import { useDiagramAppearance } from "@/contexts/DiagramAppearanceContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePro } from "@/contexts/ProContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGlossary } from "@/contexts/GlossaryContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { useProviderAuth } from "@/hooks/useProviderAuth";
import { getAppErrorCode } from "@/utils/app-error";
import { FREE_LOCAL_RECORD_LIMIT } from "@/utils/constants";
import { parseConsumptionsCsv } from "@/utils/csv-import";
import { buildConsumptionsCsv } from "@/utils/export";
import { LOCALE_MAP } from "@/utils/formatting";
import { getLanguageOptions } from "@/utils/language-options";
import { logger } from "@/utils/logger";
import { seedDemoExpenses } from "@/utils/seed-data/seed-database";
import { router } from "expo-router";
import { SymbolIcon } from "@/components/symbol-icon";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import { PAYWALL_RESULT } from "react-native-purchases-ui";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function SettingsScreen() {
  const { theme } = useTheme();
  const { language, resolvedLanguage, t } = useLanguage();
  const { isAccentPaletteEnabled, setAccentPaletteEnabled } = useDiagramAppearance();
  const { activeEntryCount } = useGlossary();
  const { user, isSignedIn, isFirebaseReady } = useAuth();
  const {
    activeAuthProvider,
    canUseAppleAuth,
    handleSignInApple,
    handleSignInFacebook,
    handleSignInGoogle,
    handleSignOut,
    isAuthBusy,
  } = useProviderAuth();
  const {
    enableProDebug,
    hasUnlimitedLocal,
    isBusy: isPurchaseBusy,
    isConfigured: isPurchaseConfigured,
    isPro,
    presentPaywall,
    restorePurchases,
    signOutResetProDebug,
    storagePlanId,
  } = usePro();
  const cloudEnabled = Boolean(user?.uid && isPro);
  const {
    clearAll,
    getAllForExport,
    importConsumptions,
    isSyncBusy,
    pullCloudToLocal,
    refresh,
    syncLocalToCloud,
    syncSnapshot,
    totalCount,
  } = useConsumptionStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAccountHelpRequested, setIsAccountHelpRequested] = useState(false);
  const languages = useMemo(() => getLanguageOptions(t), [t]);
  const currentLanguageLabel =
    languages.find((option) => option.code === language)?.name ?? t("device");
  const showAuthOptions = isFirebaseReady && !isSignedIn;
  const needsAccountForActivePro = isPro && !isSignedIn;
  const shouldPromptForAccount = isAccountHelpRequested && !isSignedIn;
  const showAuthSection =
    isSignedIn || (showAuthOptions && (needsAccountForActivePro || shouldPromptForAccount));
  const showCloudSection = cloudEnabled || isPro || (isPurchaseConfigured && isSignedIn);
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
  const authStatusDetail = useMemo(() => {
    if (isSignedIn) {
      return user?.email || user?.displayName || user?.uid || t("authStatusSignedIn");
    }

    if (isAuthBusy) {
      const providerLabel =
        activeAuthProvider === "google"
          ? "Google"
          : activeAuthProvider === "facebook"
            ? "Facebook"
            : activeAuthProvider === "apple"
              ? "Apple"
              : null;

      return providerLabel
        ? t("authSigningInWithProvider").replace("{provider}", providerLabel)
        : t("authSigningIn");
    }

    if (needsAccountForActivePro) {
      return t("authRequiredForProCloud");
    }

    if (shouldPromptForAccount) {
      return t("authRequiredBeforeSubscription");
    }

    return t("authOptionalNote");
  }, [
    activeAuthProvider,
    isAuthBusy,
    isSignedIn,
    needsAccountForActivePro,
    shouldPromptForAccount,
    t,
    user?.displayName,
    user?.email,
    user?.uid,
  ]);

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

  const importFromCSV = useCallback(async () => {
    setIsImporting(true);
    try {
      const result = await File.pickFileAsync({
        mimeTypes: ["text/csv", "text/comma-separated-values", "application/csv"],
      });

      if (result.canceled) {
        return;
      }

      const file = result.result;
      if (!file) {
        Alert.alert(t("importCSVError"), t("importCSVInvalid"));
        return;
      }

      const csvContent = await file.text();
      const { consumptions: importedRecords } = parseConsumptionsCsv(csvContent);
      const importResult = await importConsumptions(importedRecords);

      Alert.alert(
        t("importCSVSuccess"),
        t("importCSVSuccessMessage").replace("{count}", String(importResult.imported))
      );
    } catch (error) {
      logger.error("Import error", error);
      if (getAppErrorCode(error) === "LOCAL_LIMIT_REACHED") {
        Alert.alert(
          t("localLimitReachedTitle"),
          t("localLimitReachedLocalOnlyMessage").replace(
            "{limit}",
            String(FREE_LOCAL_RECORD_LIMIT)
          )
        );
        return;
      }

      const errorMessage = error instanceof Error ? error.message : t("importCSVInvalid");
      Alert.alert(t("importCSVError"), errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [importConsumptions, t]);

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

  const handleOpenPaywall = useCallback(async () => {
    try {
      const { result, storagePlanId: purchasedPlanId } = await presentPaywall();

      if (result === PAYWALL_RESULT.ERROR) {
        Alert.alert(t("iapErrorTitle"), t("iapErrorMessage"));
        return;
      }

      if (result === PAYWALL_RESULT.NOT_PRESENTED) {
        Alert.alert(t("iapNotReadyTitle"), t("iapPackageUnavailableMessage"));
        return;
      }

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        if (purchasedPlanId === "pro") {
          if (isSignedIn) {
            Alert.alert(t("iapPurchaseSuccessTitle"), t("iapPurchaseSuccessProMessage"));
          } else if (isFirebaseReady) {
            setIsAccountHelpRequested(true);
            Alert.alert(t("iapPurchaseSuccessTitle"), t("iapPurchaseSuccessProSignInMessage"));
          } else {
            Alert.alert(t("iapPurchaseSuccessTitle"), t("iapPurchaseSuccessMessage"));
          }
          return;
        }

        if (purchasedPlanId === "plus") {
          setIsAccountHelpRequested(false);
          Alert.alert(t("iapPurchaseSuccessTitle"), t("iapPurchaseSuccessPlusMessage"));
          return;
        }

        Alert.alert(t("iapPurchaseSuccessTitle"), t("iapPurchaseSuccessMessage"));
      }
    } catch (error) {
      handlePurchaseError(error, "paywall");
    }
  }, [handlePurchaseError, isFirebaseReady, isSignedIn, presentPaywall, t]);

  const handleRestorePro = useCallback(async () => {
    try {
      await restorePurchases();
    } catch (error) {
      handlePurchaseError(error, "restore");
    }
  }, [handlePurchaseError, restorePurchases]);

  const handleSignOutFromSettings = useCallback(async () => {
    await handleSignOut();
    setIsAccountHelpRequested(false);
  }, [handleSignOut]);

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
          {showAuthSection && (
            <GlassContainer intensity="medium" style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t("settingsSectionAccount")}
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
                        {authStatusDetail}
                      </Text>
                    ) : (
                      <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                        {authStatusDetail}
                      </Text>
                    )}
                  </View>
                </View>
                {isAuthBusy ? <ActivityIndicator color={theme.textSecondary} /> : null}
              </View>

              {!isSignedIn ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={handleSignInGoogle}
                    disabled={isAuthBusy}
                  >
                    <View style={styles.settingLeft}>
                      <SymbolIcon name="person-circle" size={22} color={theme.text} />
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("authContinueGoogle")}
                      </Text>
                    </View>
                    {activeAuthProvider === "google" ? (
                      <ActivityIndicator color={theme.textSecondary} />
                    ) : (
                      <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.settingItem,
                      { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={handleSignInFacebook}
                    disabled={isAuthBusy}
                  >
                    <View style={styles.settingLeft}>
                      <SymbolIcon name="person-circle" size={22} color={theme.text} />
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("authContinueFacebook")}
                      </Text>
                    </View>
                    {activeAuthProvider === "facebook" ? (
                      <ActivityIndicator color={theme.textSecondary} />
                    ) : (
                      <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {canUseAppleAuth ? (
                    <TouchableOpacity
                      style={[
                        styles.settingItem,
                        { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={handleSignInApple}
                      disabled={isAuthBusy || !canUseAppleAuth}
                    >
                      <View style={styles.settingLeft}>
                        <SymbolIcon name="apple-logo" size={22} color={theme.text} />
                        <Text style={[styles.settingText, { color: theme.text }]}>
                          {t("authContinueApple")}
                        </Text>
                      </View>
                      {activeAuthProvider === "apple" ? (
                        <ActivityIndicator color={theme.textSecondary} />
                      ) : (
                        <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.settingItem,
                    { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                  onPress={() => void handleSignOutFromSettings()}
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
            </GlassContainer>
          )}

          <GlassContainer intensity="medium" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t("settingsSectionStorage")}
              </Text>
            </View>

            {showCloudSection && (
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
              onPress={() => void handleOpenPaywall()}
              disabled={isPurchaseBusy}
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
              {isPurchaseBusy ? (
                <ActivityIndicator color={theme.textSecondary} />
              ) : (
                <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
              )}
            </TouchableOpacity>

            {shouldShowPurchaseActions && (
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
          </GlassContainer>

          <GlassContainer intensity="medium" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t("settingsSectionData")}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
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
              onPress={importFromCSV}
              disabled={isImporting}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="cloud-upload" size={22} color={theme.text} />
                <Text style={[styles.settingText, { color: theme.text }]}>{t("importCSV")}</Text>
              </View>
              {isImporting ? (
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
          </GlassContainer>

          <GlassContainer intensity="medium" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t("settingsSectionAppearance")}
              </Text>
            </View>

            <View
              style={[
                styles.settingItem,
                { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="chart" size={22} color={theme.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("diagramPaletteTitle")}
                  </Text>
                  <Text style={[styles.settingMeta, { color: theme.textSecondary }]}>
                    {t("diagramPaletteHint")}
                  </Text>
                </View>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                  {isAccentPaletteEnabled
                    ? t("diagramPaletteAccent")
                    : t("diagramPaletteMono")}
                </Text>
                <Switch
                  value={isAccentPaletteEnabled}
                  onValueChange={(value) => {
                    void setAccentPaletteEnabled(value);
                  }}
                  trackColor={{
                    false: theme.isDark ? "#3A3A3C" : "#D1D1D6",
                    true: theme.foreground,
                  }}
                  thumbColor={theme.background}
                  ios_backgroundColor={theme.isDark ? "#3A3A3C" : "#D1D1D6"}
                />
              </View>
            </View>

            <TouchableOpacity
              testID="settings-language-row"
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
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t("settingsSectionDanger")}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
              onPress={handleClearHistory}
            >
              <View style={styles.settingLeft}>
                <SymbolIcon name="trash" size={22} color={theme.destructive} />
                <Text style={[styles.settingText, { color: theme.destructive }]}>
                  {t("clearHistory")}
                </Text>
              </View>
              <SymbolIcon name="chevron-forward" size={18} color={theme.destructive} />
            </TouchableOpacity>
          </GlassContainer>

          {__DEV__ && (
            <GlassContainer intensity="medium" style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t("settingsSectionDeveloper")}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.settingItem,
                  { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
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

              <TouchableOpacity
                testID="seed-demo-button"
                style={[
                  styles.settingItem,
                  { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
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
            </GlassContainer>
          )}
        </View>
      </ScrollView>
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
