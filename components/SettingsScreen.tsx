import { GlassContainer } from "@/components/GlassContainer";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePro } from "@/contexts/ProContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { getAppErrorCode } from "@/utils/app-error";
import { FREE_LOCAL_RECORD_LIMIT } from "@/utils/constants";
import { getLanguageOptions } from "@/utils/language-options";
import { logger } from "@/utils/logger";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  const { language, t } = useLanguage();
  const { user, isSignedIn, isFirebaseReady, signInWithCredential, signOut } = useAuth();
  const {
    annualPrice,
    enableProDebug,
    isBusy: isPurchaseBusy,
    isConfigured: isPurchaseConfigured,
    isPro,
    monthlyPrice,
    purchasePro,
    recommendedAnnualPrice,
    recommendedMonthlyPrice,
    restorePurchases,
    signOutResetProDebug,
  } = usePro();
  const cloudEnabled = Boolean(user?.uid && isPro);
  const { clearAll, getAllForExport, syncLocalToCloud, totalCount } = useConsumptionStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const languages = useMemo(() => getLanguageOptions(t), [t]);
  const currentLanguageLabel =
    languages.find((option) => option.code === language)?.name ?? t("device");
  const showAppleSignIn = isFirebaseReady && Platform.OS === "ios" && isAppleAuthAvailable;
  const shouldShowAuthSetupNotice = !isSignedIn && !showAppleSignIn;
  const shouldShowPurchaseActions = !cloudEnabled && !isPro && isPurchaseConfigured;
  const shouldShowPurchaseSetupNotice = !cloudEnabled && !isPro && !isPurchaseConfigured;

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleLanguagePress = useCallback(() => {
    Haptics.selectionAsync();
    router.push("/select-language");
  }, []);

  const exportToCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const allConsumptions = await getAllForExport();

      if (allConsumptions.length === 0) {
        Alert.alert(t("exportError"), t("noConsumptionsYet"));
        return;
      }

      const headers = ["Date", "Amount", "Description", "Category"];
      const rows = allConsumptions.map((consumption) => {
        const date = new Date(consumption.date).toLocaleString();
        const amount = consumption.amount.toFixed(2);
        const description = (consumption.description || "").replace(/"/g, '""');
        const category = (consumption.category || "").replace(/"/g, '""');
        return `"${date}","${amount}","${description}","${category}"`;
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
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
        Alert.alert(t("exportError"), "Sharing is not available on this device");
      }
    } catch (error) {
      logger.error("Export error", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(t("exportError"), errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [getAllForExport, t]);

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
              error instanceof Error ? error.message : "Failed to clear history";
            Alert.alert("Error", errorMessage);
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
      Haptics.selectionAsync();
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
      const errorCode = getAppErrorCode(error);
      if (errorCode === "IAP_NOT_CONFIGURED") {
        Alert.alert(t("iapNotReadyTitle"), t("iapNotReadyMessage"));
        return;
      }
      if (errorCode === "PURCHASE_CANCELLED") {
        return;
      }
      logger.error("Purchase failed", error, { plan });
      Alert.alert(t("iapErrorTitle"), t("iapErrorMessage"));
    }
  }, [purchasePro, t]);

  const handleRestorePro = useCallback(async () => {
    try {
      await restorePurchases();
    } catch (error) {
      if (getAppErrorCode(error) === "IAP_NOT_CONFIGURED") {
        Alert.alert(t("iapNotReadyTitle"), t("iapNotReadyMessage"));
        return;
      }
      logger.error("Restore purchase failed", error);
      Alert.alert(t("iapErrorTitle"), t("iapErrorMessage"));
    }
  }, [restorePurchases, t]);

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

  const cloudStatusMessage = useMemo(() => {
    if (cloudEnabled) {
      return t("cloudSyncActive");
    }

    if (isSignedIn && !isPro) {
      return t("cloudSyncLockedSignedIn");
    }

    if (!isSignedIn && isPro) {
      return t("cloudSyncLockedPaid");
    }

    return t("cloudSyncLockedSignedOut");
  }, [cloudEnabled, isPro, isSignedIn, t]);

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <GlassContainer intensity="medium" style={styles.headerGlass}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
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
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t("authFeatureTitle")}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                {t("authFeatureSubtitle")}
              </Text>
            </View>

            <View style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.settingLeft}>
                <Ionicons name="person-circle-outline" size={22} color={theme.text} />
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
              <>
                {showAppleSignIn && (
                  <TouchableOpacity
                    style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                    onPress={handleSignInApple}
                    disabled={isAuthBusy || !isAppleAuthAvailable}
                  >
                    <View style={styles.settingLeft}>
                      <Ionicons name="logo-apple" size={22} color={theme.text} />
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("authContinueApple")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}

                {shouldShowAuthSetupNotice && (
                  <View style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="construct-outline" size={22} color={theme.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingText, { color: theme.text }]}>
                          {t("authNotConfiguredTitle")}
                        </Text>
                        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                          {t("authNotConfiguredMessage")}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                onPress={handleSignOut}
                disabled={isAuthBusy}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="log-out-outline" size={22} color={theme.text} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("authSignOut")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}

            <View style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.settingLeft}>
                <Ionicons name="cloud-outline" size={22} color={theme.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("cloudSyncTitle")}
                  </Text>
                  <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                    {cloudStatusMessage}
                  </Text>
                </View>
              </View>
            </View>

            {shouldShowPurchaseActions && (
              <>
                <TouchableOpacity
                  style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                  onPress={() => void handlePurchasePro("monthly")}
                  disabled={isPurchaseBusy || !isPurchaseConfigured}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="cart-outline" size={22} color={theme.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("cloudSyncMonthlyCta")}
                      </Text>
                      <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                        {monthlyPrice ?? recommendedMonthlyPrice}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                  onPress={() => void handlePurchasePro("annual")}
                  disabled={isPurchaseBusy || !isPurchaseConfigured}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="sparkles-outline" size={22} color={theme.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingText, { color: theme.text }]}>
                        {t("cloudSyncAnnualCta")}
                      </Text>
                      <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                        {annualPrice ?? recommendedAnnualPrice}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                  onPress={handleRestorePro}
                  disabled={isPurchaseBusy || !isPurchaseConfigured}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="refresh-outline" size={22} color={theme.text} />
                    <Text style={[styles.settingText, { color: theme.text }]}>
                      {t("cloudSyncRestoreCta")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </>
            )}

            {shouldShowPurchaseSetupNotice && (
              <View style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.settingLeft}>
                  <Ionicons name="cart-outline" size={22} color={theme.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>
                      {t("iapNotReadyTitle")}
                    </Text>
                    <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                      {t("iapNotReadyMessage")}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {cloudEnabled && (
              <TouchableOpacity
                style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                onPress={handleSyncLocal}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="cloud-upload-outline" size={22} color={theme.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>
                      {t("cloudSyncSyncCta")}
                    </Text>
                    <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                      {t("cloudSyncSyncDetail")}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}

            {!cloudEnabled && (
              <View style={[styles.settingItem, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.settingLeft}>
                  <Ionicons name="server-outline" size={22} color={theme.text} />
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
                  <Ionicons name="bug-outline" size={22} color={theme.textSecondary} />
                  <Text style={[styles.settingText, { color: theme.textSecondary }]}>
                    {isPro ? "Dev: Disable Pro" : "Dev: Enable Pro"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
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
                <Ionicons name="download-outline" size={22} color={theme.text} />
                <Text style={[styles.settingText, { color: theme.text }]}>{t("exportCSV")}</Text>
              </View>
              {isExporting ? (
                <Ionicons name="hourglass-outline" size={20} color={theme.textSecondary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={handleLanguagePress}>
              <View style={styles.settingLeft}>
                <Ionicons name="language-outline" size={22} color={theme.text} />
                <Text style={[styles.settingText, { color: theme.text }]}>
                  {t("selectLanguage")}
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                  {currentLanguageLabel}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </GlassContainer>

          <GlassContainer intensity="medium" style={styles.sectionCard}>
            <TouchableOpacity style={styles.settingItem} onPress={handleClearHistory}>
              <View style={styles.settingLeft}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                <Text style={[styles.settingText, { color: "#FF3B30" }]}>
                  {t("clearHistory")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </GlassContainer>
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
});
