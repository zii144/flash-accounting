import { GlassContainer } from "@/components/GlassContainer";
import { SettingsModal } from "@/components/SettingsModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, Layout } from "react-native-reanimated";

type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type TimeFilter = "all" | "today" | "week" | "month" | "year";

interface GroupedConsumption {
  date: string;
  dateLabel: string;
  consumptions: Consumption[];
  total: number;
}

// Format currency with thousand separators
const formatCurrency = (amount: number, decimals: number = 2): string => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function StatisticsView() {
  const { theme } = useTheme();
  const { resolvedLanguage, t } = useLanguage();
  const { consumptions } = useConsumptionStorage();
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Filter consumptions by time
  const filteredConsumptions = useMemo(() => {
    const now = new Date();
    return consumptions.filter((c) => {
      const date = new Date(c.date);
      switch (timeFilter) {
        case "today":
          return date.toDateString() === now.toDateString();
        case "week": {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return date >= weekAgo;
        }
        case "month": {
          return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        }
        case "year": {
          return date.getFullYear() === now.getFullYear();
        }
        default:
          return true;
      }
    });
  }, [consumptions, timeFilter]);

  // Sort consumptions
  const sortedConsumptions = useMemo(() => {
    const sorted = [...filteredConsumptions];
    switch (sortOption) {
      case "date-desc":
        return sorted.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      case "date-asc":
        return sorted.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      case "amount-desc":
        return sorted.sort((a, b) => b.amount - a.amount);
      case "amount-asc":
        return sorted.sort((a, b) => a.amount - b.amount);
      default:
        return sorted;
    }
  }, [filteredConsumptions, sortOption]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups: { [key: string]: Consumption[] } = {};

    sortedConsumptions.forEach((c) => {
      const date = new Date(c.date);
      const key = date.toDateString();

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(c);
    });

    return Object.entries(groups)
      .map(([date, items]) => {
        const dateObj = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel = "";
        if (dateObj.toDateString() === today.toDateString()) {
          dateLabel = t("today_label");
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
          dateLabel = t("yesterday");
        } else {
          const localeMap: Record<string, string> = {
            en: "en-US",
            zh: "zh-TW",
            es: "es-ES",
            fr: "fr-FR",
            de: "de-DE",
            ja: "ja-JP",
          };
          dateLabel = dateObj.toLocaleDateString(
            localeMap[resolvedLanguage] || "en-US",
            {
              weekday: "short",
              month: "short",
              day: "numeric",
            }
          );
        }

        return {
          date,
          dateLabel,
          consumptions: items,
          total: items.reduce((sum, item) => sum + item.amount, 0),
        } as GroupedConsumption;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sortedConsumptions, resolvedLanguage, t]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups: { [key: string]: Consumption[] } = {};

    sortedConsumptions.forEach((c) => {
      const date = new Date(c.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(c);
    });

    return Object.entries(groups)
      .map(([key, items]) => {
        const dateObj = new Date(items[0].date);
        const localeMap: Record<string, string> = {
          en: "en-US",
          zh: "zh-TW",
          es: "es-ES",
          fr: "fr-FR",
          de: "de-DE",
          ja: "ja-JP",
        };
        const dateLabel = dateObj.toLocaleDateString(
          localeMap[resolvedLanguage] || "en-US",
          {
            month: "long",
            year: "numeric",
          }
        );

        return {
          date: key,
          dateLabel,
          consumptions: items,
          total: items.reduce((sum, item) => sum + item.amount, 0),
        } as GroupedConsumption;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sortedConsumptions, resolvedLanguage]);

  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const displayData = viewMode === "day" ? groupedByDay : groupedByMonth;

  const totalAmount = filteredConsumptions.reduce(
    (sum, c) => sum + c.amount,
    0
  );

  // Calculate log day (days since first entry)
  const logDay = useMemo(() => {
    if (consumptions.length === 0) return 0;
    const dates = consumptions.map((c) => new Date(c.date).getTime());
    const firstDate = Math.min(...dates);
    const today = new Date().setHours(0, 0, 0, 0);
    const firstDay = new Date(firstDate).setHours(0, 0, 0, 0);
    const diffTime = today - firstDay;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [consumptions]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t("statistics")}
        </Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSettingsVisible(true);
          }}
        >
          <GlassContainer intensity="medium" style={styles.settingsGlass}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </GlassContainer>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Summary Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCardWrapper, styles.statCardWrapperDouble]}>
            <GlassContainer intensity="light" style={styles.statCard}>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                {t("total")}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { color: theme.text }]}
              >
                ${formatCurrency(totalAmount, 2)}
              </Text>
            </GlassContainer>
          </View>

          <View style={styles.statCardWrapper}>
            <GlassContainer intensity="light" style={styles.statCard}>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                {t("count")}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { color: theme.text }]}
              >
                {filteredConsumptions.length}
              </Text>
            </GlassContainer>
          </View>

          <View style={styles.statCardWrapper}>
            <GlassContainer intensity="light" style={styles.statCard}>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                {t("logDay")}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { color: theme.text }]}
              >
                {logDay}
              </Text>
            </GlassContainer>
          </View>
        </View>

        {/* View Mode Toggle */}
        <GlassContainer intensity="medium" style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              viewMode === "day" && styles.toggleButtonActive,
              {
                backgroundColor:
                  viewMode === "day"
                    ? theme.isDark
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(255, 255, 255, 0.9)"
                    : "transparent",
              },
            ]}
            onPress={() => setViewMode("day")}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color: viewMode === "day" ? theme.text : theme.textSecondary,
                  fontWeight: viewMode === "day" ? "700" : "500",
                },
              ]}
            >
              {t("byDay")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              viewMode === "month" && styles.toggleButtonActive,
              {
                backgroundColor:
                  viewMode === "month"
                    ? theme.isDark
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(255, 255, 255, 0.9)"
                    : "transparent",
              },
            ]}
            onPress={() => setViewMode("month")}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    viewMode === "month" ? theme.text : theme.textSecondary,
                  fontWeight: viewMode === "month" ? "700" : "500",
                },
              ]}
            >
              {t("byMonth")}
            </Text>
          </TouchableOpacity>
        </GlassContainer>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <GlassContainer intensity="light" style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              {t("time")}:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterButtons}>
                {(
                  ["all", "today", "week", "month", "year"] as TimeFilter[]
                ).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterButton,
                      timeFilter === filter && {
                        backgroundColor: theme.foreground,
                      },
                    ]}
                    onPress={() => setTimeFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        {
                          color:
                            timeFilter === filter
                              ? theme.background
                              : theme.text,
                        },
                      ]}
                    >
                      {t(filter)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </GlassContainer>

          <GlassContainer intensity="light" style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              {t("sort")}:
            </Text>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                const options: SortOption[] = [
                  "date-desc",
                  "date-asc",
                  "amount-desc",
                  "amount-asc",
                ];
                const currentIndex = options.indexOf(sortOption);
                setSortOption(options[(currentIndex + 1) % options.length]);
              }}
            >
              <Ionicons
                name={
                  sortOption === "date-desc"
                    ? "calendar-outline"
                    : sortOption === "date-asc"
                    ? "calendar"
                    : sortOption === "amount-desc"
                    ? "trending-down-outline"
                    : "trending-up-outline"
                }
                size={20}
                color={theme.text}
              />
              <Text style={[styles.sortButtonText, { color: theme.text }]}>
                {sortOption === "date-desc"
                  ? t("newest")
                  : sortOption === "date-asc"
                  ? t("oldest")
                  : sortOption === "amount-desc"
                  ? t("highest")
                  : t("lowest")}
              </Text>
            </TouchableOpacity>
          </GlassContainer>
        </View>

        {/* Grouped List */}
        <FlatList
          data={displayData}
          keyExtractor={(item) => item.date}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Animated.View
              entering={FadeIn.duration(300)}
              layout={Layout.springify().damping(25)}
              style={styles.groupContainer}
            >
              <GlassContainer intensity="light" style={styles.groupHeader}>
                <View>
                  <Text style={[styles.groupDate, { color: theme.text }]}>
                    {item.dateLabel}
                  </Text>
                  <Text
                    style={[styles.groupCount, { color: theme.textSecondary }]}
                  >
                    {item.consumptions.length}{" "}
                    {item.consumptions.length === 1 ? t("item") : t("items")}
                  </Text>
                </View>
                <Text style={[styles.groupTotal, { color: theme.text }]}>
                  ${formatCurrency(item.total, 2)}
                </Text>
              </GlassContainer>

              {item.consumptions.map((consumption) => (
                <View
                  key={consumption.id}
                  style={[
                    styles.consumptionRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={styles.consumptionInfo}>
                    <Text
                      style={[styles.consumptionAmount, { color: theme.text }]}
                    >
                      ${formatCurrency(consumption.amount, 2)}
                    </Text>
                    <Text
                      style={[
                        styles.consumptionDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {consumption.description?.trim() &&
                      consumption.description.trim() !== "No description"
                        ? consumption.description.trim()
                        : t("noDescription")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.consumptionTime,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {new Date(consumption.date).toLocaleTimeString(
                      resolvedLanguage === "en"
                        ? "en-US"
                        : resolvedLanguage === "zh"
                        ? "zh-TW"
                        : resolvedLanguage === "es"
                        ? "es-ES"
                        : resolvedLanguage === "fr"
                        ? "fr-FR"
                        : resolvedLanguage === "de"
                        ? "de-DE"
                        : "ja-JP",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {t("noConsumptions")}
              </Text>
            </View>
          }
        />
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        consumptions={consumptions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    flex: 1,
  },
  settingsButton: {
    marginLeft: 12,
  },
  settingsGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 140,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statCardWrapper: {
    flex: 1,
    minWidth: 0,
  },
  statCardWrapperDouble: {
    flex: 2,
  },
  statCard: {
    width: "100%",
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    minHeight: 80,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
  },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  toggleButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
  },
  filtersContainer: {
    gap: 12,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    minWidth: 50,
  },
  filterButtons: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  groupDate: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  groupCount: {
    fontSize: 13,
  },
  groupTotal: {
    fontSize: 18,
    fontWeight: "700",
  },
  consumptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  consumptionInfo: {
    flex: 1,
  },
  consumptionAmount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  consumptionDescription: {
    fontSize: 14,
  },
  consumptionTime: {
    fontSize: 12,
    marginLeft: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
});
