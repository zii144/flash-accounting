import { GlassContainer } from "@/components/GlassContainer";
import { SettingsModal } from "@/components/SettingsModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStats } from "@/hooks/useConsumptionStats";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import {
  SORT_OPTIONS,
  TIME_FILTERS,
  type SortOption,
  type TimeFilter,
  type ViewMode,
} from "@/utils/constants";
import {
  formatCurrency,
  formatGroupedDate,
  formatMonthLabel,
  formatTime,
} from "@/utils/formatting";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, Layout } from "react-native-reanimated";

interface GroupedConsumption {
  date: string;
  dateLabel: string;
  consumptions: Consumption[];
  total: number;
}

export function StatisticsView() {
  const { theme } = useTheme();
  const { resolvedLanguage, t } = useLanguage();
  const { consumptions } = useConsumptionStorage();
  const statsHook = useConsumptionStats();
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  
  // Stats state
  const [stats, setStats] = useState({ total: 0, count: 0, logDay: 0 });
  const [displayData, setDisplayData] = useState<GroupedConsumption[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const STATS_PAGE_SIZE = 5; // Show 5 groups per page
  const loadDataRef = useRef<((pageNum: number, append: boolean) => Promise<void>) | null>(null);
  const statsHookRef = useRef(statsHook);
  
  // Update ref when hook changes
  useEffect(() => {
    statsHookRef.current = statsHook;
  }, [statsHook]);

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsVisible(true);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const handleTimeFilterChange = useCallback((filter: TimeFilter) => {
    setTimeFilter(filter);
  }, []);

  const handleSortToggle = useCallback(() => {
    setSortOption((prev) => {
      const currentIndex = SORT_OPTIONS.indexOf(prev);
      return SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length];
    });
  }, []);

  // Parse sort option to SQL format
  const sortConfig = useMemo(() => {
    switch (sortOption) {
      case "date-desc":
        return { sortBy: 'date' as const, sortOrder: 'DESC' as const };
      case "date-asc":
        return { sortBy: 'date' as const, sortOrder: 'ASC' as const };
      case "amount-desc":
        return { sortBy: 'amount' as const, sortOrder: 'DESC' as const };
      case "amount-asc":
        return { sortBy: 'amount' as const, sortOrder: 'ASC' as const };
      default:
        return { sortBy: 'date' as const, sortOrder: 'DESC' as const };
    }
  }, [sortOption]);

  // Load stats and grouped data using SQL queries
  useEffect(() => {
    let cancelled = false;

    const loadData = async (pageNum: number = 1, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingStats(true);
        setPage(1);
        setDisplayData([]); // Clear existing data when loading new page
      }

      try {
        const hook = statsHookRef.current;
        
        // Load stats (only on initial load or when filter changes)
        if (!append) {
          const statsData = await hook.getStats(timeFilter);
          if (!cancelled) {
            setStats(statsData);
          }
        }

        // Load grouped data with pagination
        let result;
        if (viewMode === "day") {
          result = await hook.getGroupedByDay(
            timeFilter,
            sortConfig.sortBy,
            sortConfig.sortOrder,
            pageNum,
            STATS_PAGE_SIZE
          );
        } else {
          result = await hook.getGroupedByMonth(
            timeFilter,
            sortConfig.sortBy,
            sortConfig.sortOrder,
            pageNum,
            STATS_PAGE_SIZE
          );
        }

        if (!cancelled) {
          const formatted = result.data.map((group) => {
            if (viewMode === "day") {
              const date = new Date(group.date);
              const dateLabel = formatGroupedDate(
                date.toDateString(),
                resolvedLanguage,
                t("today_label"),
                t("yesterday")
              );
              return {
                ...group,
                dateLabel,
                consumptions: group.consumptions.map((c) => ({
                  ...c,
                  category: c.category,
                })) as Consumption[],
              };
            } else {
              const dateLabel = formatMonthLabel(
                group.consumptions[0]?.date || group.date,
                resolvedLanguage
              );
              return {
                ...group,
                dateLabel,
                consumptions: group.consumptions.map((c) => ({
                  ...c,
                  category: c.category,
                })) as Consumption[],
              };
            }
          });

          if (append) {
            setDisplayData((prev) => [...prev, ...formatted]);
          } else {
            setDisplayData(formatted);
          }
          
          setHasMore(result.hasMore);
          setPage(pageNum);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingStats(false);
          setIsLoadingMore(false);
        }
      }
    };

    // Store loadData in ref for handleLoadMore
    loadDataRef.current = loadData;

    // Reset to page 1 when filters change
    loadData(1, false);

    return () => {
      cancelled = true;
    };
  }, [timeFilter, viewMode, sortConfig.sortBy, sortConfig.sortOrder, resolvedLanguage, t]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && !isLoadingStats && hasMore && loadDataRef.current) {
      loadDataRef.current(page + 1, true);
    }
  }, [isLoadingMore, isLoadingStats, hasMore, page]);

  // Gradient colors for fade overlay
  const fadeGradientColors = useMemo(() => {
    if (theme.isDark) {
      return [
        'rgba(0, 0, 0, 0)',
        'rgba(0, 0, 0, 0.3)',
        'rgba(0, 0, 0, 0.7)',
        theme.background,
      ] as const;
    } else {
      return [
        'rgba(255, 255, 255, 0)',
        'rgba(255, 255, 255, 0.3)',
        'rgba(255, 255, 255, 0.7)',
        theme.background,
      ] as const;
    }
  }, [theme.isDark, theme.background]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t("statistics")}
        </Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSettingsPress}
        >
          <GlassContainer intensity="medium" style={styles.settingsGlass}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </GlassContainer>
        </TouchableOpacity>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={displayData}
          keyExtractor={(item) => item.date}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
          <>
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
                ${formatCurrency(stats.total, 2)}
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
                {stats.count}
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
                {stats.logDay}
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
            onPress={() => handleViewModeChange("day")}
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
            onPress={() => handleViewModeChange("month")}
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
                {TIME_FILTERS.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterButton,
                      timeFilter === filter && {
                        backgroundColor: theme.foreground,
                      },
                    ]}
                    onPress={() => handleTimeFilterChange(filter)}
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
              onPress={handleSortToggle}
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
          </>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingFooter}>
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                {t("loading") || "Loading..."}
              </Text>
            </View>
          ) : null
        }
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
                    {formatTime(consumption.date, resolvedLanguage)}
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
      <LinearGradient
        colors={fadeGradientColors}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.fadeOverlay}
        pointerEvents="none"
      />
      </View>

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
  listWrapper: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 140,
  },
  fadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 10,
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
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
  },
});
