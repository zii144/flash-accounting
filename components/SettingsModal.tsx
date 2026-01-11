import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

type Language = "en" | "zh" | "es" | "fr" | "de" | "ja" | "device";

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

  const languages: { code: Language; name: string }[] = [
    { code: "device", name: t("device") },
    { code: "en", name: t("english") },
    { code: "zh", name: t("chinese") },
    { code: "es", name: t("spanish") },
    { code: "fr", name: t("french") },
    { code: "de", name: t("german") },
    { code: "ja", name: t("japanese") },
  ];

  const exportToCSV = async () => {
    if (consumptions.length === 0) {
      Alert.alert(t("exportError"), "No data to export");
      return;
    }

    setIsExporting(true);
    try {
      // Create CSV content
      const headers = ["Date", "Amount", "Description", "Category"];
      const rows = consumptions.map((c) => {
        const date = new Date(c.date).toLocaleString();
        const amount = c.amount.toFixed(2);
        const description = c.description.replace(/"/g, '""'); // Escape quotes
        const category = c.category || "";
        return `"${date}","${amount}","${description}","${category}"`;
      });

      const csvContent = [
        headers.join(","),
        ...rows,
      ].join("\n");

      // Create file
      const fileName = `flash-accounting-${new Date().toISOString().split("T")[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
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
        Alert.alert(t("exportError"), "Sharing is not available on this device");
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(t("exportError"), String(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearHistory = () => {
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
              Alert.alert("Error", "Failed to clear history");
            }
          },
        },
      ]
    );
  };

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
          style={styles.modalContent}
        >
          <GlassContainer intensity="heavy" style={styles.glassContainer}>
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
          </GlassContainer>
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
  },
  glassContainer: {
    padding: 0,
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
