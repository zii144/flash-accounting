import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { Ionicons } from "@expo/vector-icons";
import { documentDirectory, EncodingType, writeAsStringAsync } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";


interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  consumptions: Consumption[];
}

export function SettingsModal({
  visible,
  onClose,
  consumptions,
}: SettingsModalProps) {
  const { theme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { clearAll } = useConsumptionStorage();
  const [isExporting, setIsExporting] = useState(false);

  const languages = useMemo(
    () => [
      { code: "device" as const, name: t("device") },
      { code: "en" as const, name: t("english") },
      { code: "zh" as const, name: t("chinese") },
      { code: "es" as const, name: t("spanish") },
      { code: "fr" as const, name: t("french") },
      { code: "de" as const, name: t("german") },
      { code: "ja" as const, name: t("japanese") },
    ],
    [t]
  );

  const exportToCSV = useCallback(async () => {
    if (consumptions.length === 0) {
      Alert.alert(t("exportError"), t("noConsumptionsYet"));
      return;
    }

    setIsExporting(true);
    try {
      // Create CSV content with proper escaping
      const headers = ["Date", "Amount", "Description", "Category"];
      const rows = consumptions.map((c) => {
        const date = new Date(c.date).toLocaleString();
        const amount = c.amount.toFixed(2);
        // Escape quotes in CSV format
        const description = (c.description || "").replace(/"/g, '""');
        const category = (c.category || "").replace(/"/g, '""');
        return `"${date}","${amount}","${description}","${category}"`;
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      // Create file with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `flash-accounting-${timestamp}.csv`;
      if (!documentDirectory) {
        throw new Error("Unable to determine document directory");
      }
      const fileUri = `${documentDirectory}${fileName}`;

      await writeAsStringAsync(fileUri, csvContent, {
        encoding: EncodingType.UTF8,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: t("exportCSV"),
        });
        Alert.alert(t("exportSuccess"));
      } else {
        Alert.alert(
          t("exportError"),
          "Sharing is not available on this device"
        );
      }
    } catch (error) {
      console.error("Export error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert(t("exportError"), errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [consumptions, t]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      t("clearHistory"),
      t("clearHistoryConfirm"),
      [
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
              onClose();
            } catch (error) {
              console.error("Clear error:", error);
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Failed to clear history";
              Alert.alert("Error", errorMessage);
            }
          },
        },
      ]
    );
  }, [t, clearAll, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.isDark
                ? "rgba(28, 28, 30, 0.95)"
                : "rgba(255, 255, 255, 0.98)",
            },
          ]}
        >
          <View style={styles.contentContainer}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                {t("settings")}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              {/* Export CSV */}
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.border }]}
                onPress={exportToCSV}
                disabled={isExporting}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name="download-outline"
                    size={22}
                    color={theme.text}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("exportCSV")}
                  </Text>
                </View>
                {isExporting && (
                  <Ionicons
                    name="hourglass-outline"
                    size={20}
                    color={theme.textSecondary}
                  />
                )}
              </TouchableOpacity>

              {/* Language Selection */}
              <View
                style={[styles.settingSection, { borderBottomColor: theme.border }]}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name="language-outline"
                    size={22}
                    color={theme.text}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    {t("selectLanguage")}
                  </Text>
                </View>
                <View style={styles.languageButtons}>
                  {languages.map((lang) => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[
                        styles.languageButton,
                        language === lang.code && {
                          backgroundColor: theme.foreground,
                        },
                        {
                          borderColor:
                            language === lang.code
                              ? theme.foreground
                              : theme.border,
                        },
                      ]}
                      onPress={() => setLanguage(lang.code)}
                    >
                      <Text
                        style={[
                          styles.languageButtonText,
                          {
                            color:
                              language === lang.code
                                ? theme.background
                                : theme.text,
                          },
                        ]}
                      >
                        {lang.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Clear History */}
              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleClearHistory}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color="#FF3B30"
                  />
                  <Text style={[styles.settingText, { color: "#FF3B30" }]}>
                    {t("clearHistory")}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  contentContainer: {
    padding: 0,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  languageButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  languageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
