import { GlassContainer } from "@/components/GlassContainer";
import { type Language } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getLanguageOptions } from "@/utils/language-options";
import { router } from "expo-router";
import { SymbolIcon } from "@/components/symbol-icon";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function LanguageSheet() {
  const { theme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const languageOptions = useMemo(() => getLanguageOptions(t), [t]);

  useEffect(() => {
    setPendingLanguage(language);
  }, [language]);

  const selectedLabel =
    languageOptions.find((option) => option.code === pendingLanguage)?.name ?? t("device");

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleSelect = useCallback((nextLanguage: Language) => {
    setPendingLanguage(nextLanguage);
  }, []);

  const handleApply = useCallback(async () => {
    await setLanguage(pendingLanguage);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [pendingLanguage, setLanguage]);

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t("selectLanguage")}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {selectedLabel}
        </Text>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <GlassContainer intensity="medium" style={styles.listCard}>
          {languageOptions.map((option, index) => {
            const isSelected = option.code === pendingLanguage;
            return (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.optionRow,
                  index < languageOptions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
                onPress={() => handleSelect(option.code)}
                activeOpacity={0.75}
              >
                <View style={styles.optionTextBlock}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    {option.name}
                  </Text>
                  {option.code === "device" ? (
                    <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                      {t("device")}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? (
                  <SymbolIcon name="checkmark-circle" size={22} color={theme.text} />
                ) : (
                  <SymbolIcon name="circle" size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            );
          })}
        </GlassContainer>
      </ScrollView>

      <View style={styles.bottomBar}>
        <GlassContainer intensity="heavy" style={styles.filterBar}>
          <View style={styles.filterCopy}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              {t("selectLanguage")}
            </Text>
            <Text style={[styles.filterValue, { color: theme.text }]}>{selectedLabel}</Text>
          </View>
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.filterButton} onPress={handleClose}>
              <Text style={[styles.filterButtonText, { color: theme.textSecondary }]}>
                {t("cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, styles.filterButtonPrimary, { backgroundColor: theme.foreground }]}
              onPress={handleApply}
            >
              <Text style={[styles.filterButtonText, { color: theme.background }]}>
                {t("confirm")}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassContainer>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140,
  },
  listCard: {
    borderRadius: 24,
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "500",
  },
  optionSubtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  bottomBar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 16,
  },
  filterBar: {
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  filterCopy: {
    gap: 2,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  filterValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonPrimary: {},
  filterButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
