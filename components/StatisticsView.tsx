import { EditConsumptionModal } from "@/components/EditConsumptionModal";
import { GlassContainer } from "@/components/GlassContainer";
import { SettingsModal } from "@/components/SettingsModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStats } from "@/hooks/useConsumptionStats";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { logger } from "@/utils/logger";
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
  Dimensions,
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
  const { consumptions, updateConsumption, deleteConsumption } = useConsumptionStorage();
  const statsHook = useConsumptionStats();
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<Consumption | null>(null);
  
  // Calculate card width so expense and income take up most of the initial viewport
  const cardWidth = useMemo(() => {
    const screenWidth = Dimensions.get("window").width;
    // Each card should be approximately (screenWidth - padding - gap) / 2.2
    // This ensures expense and income are fully visible, with a hint of total card
    const padding = 32; // 16px on each side
    const gap = 8;
    return Math.floor((screenWidth - padding - gap * 2) / 2.2);
  }, []);
  
  // Stats state
  const [stats, setStats] = useState({ 
    total: 0, 
    expenseTotal: 0,
    incomeTotal: 0,
    netTotal: 0,
    count: 0, 
    expenseCount: 0,
    incomeCount: 0,
    logDay: 0 
  });
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

  const handleEdit = useCallback((consumption: Consumption) => {
    setEditingConsumption(consumption);
    setEditModalVisible(true);
  }, []);

  const handleEditSave = useCallback(
    async (consumption: Consumption) => {
      await updateConsumption(consumption);
      // Refresh the data after update
      if (loadDataRef.current) {
        loadDataRef.current(1, false);
      }
    },
    [updateConsumption]
  );

  const handleEditClose = useCallback(() => {
    setEditModalVisible(false);
    setEditingConsumption(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteConsumption(id);
        // Refresh the data after deletion
        if (loadDataRef.current) {
          loadDataRef.current(1, false);
        }
      } catch (error) {
        logger.error('Failed to delete consumption', error, { consumptionId: id });
        // Refresh anyway to ensure UI is in sync
        if (loadDataRef.current) {
          loadDataRef.current(1, false);
        }
      }
    },
    [deleteConsumption]
  );

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
        logger.error('Failed to load stats', error, { viewMode, timeFilter, sortBy, sortOrder });
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
        {/* Summary Cards - Horizontally Scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScrollContent}
          style={styles.statsScrollView}
          decelerationRate="fast"
          pagingEnabled={false}
        >
          <View style={[styles.statCardWrapper, { width: cardWidth }]}>
            <GlassContainer intensity="light" style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <Ionicons
                  name="trending-up-outline"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  {t("income")}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.statValue, { color: theme.text }]}
              >
                +${formatCurrency(stats.incomeTotal, 2)}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.statSubtext, { color: theme.textSecondary }]}
              >
                {stats.incomeCount} {stats.incomeCount === 1 ? t("item") : t("items")}
              </Text>
            </GlassContainer>
          </View>

          <View style={[styles.statCardWrapper, { width: cardWidth }]}>
            <GlassContainer intensity="light" style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <Ionicons
                  name="trending-down-outline"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  {t("expense")}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.statValue, { color: theme.text }]}
              >
                -${formatCurrency(stats.expenseTotal, 2)}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.statSubtext, { color: theme.textSecondary }]}
              >
                {stats.expenseCount} {stats.expenseCount === 1 ? t("item") : t("items")}
              </Text>
            </GlassContainer>
          </View>

          <View style={[styles.statCardWrapper, { width: cardWidth }]}>
            <GlassContainer intensity="light" style={styles.statCard}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                {t("total")}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  styles.statValue,
                  { color: theme.text },
                ]}
              >
                {`${stats.netTotal >= 0 ? "+" : ""}$${formatCurrency(Math.abs(stats.netTotal), 2)}`}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.statSubtext, { color: theme.textSecondary }]}
              >
                {stats.incomeCount + stats.expenseCount} {stats.incomeCount + stats.expenseCount === 1 ? t("item") : t("items")}
              </Text>
            </GlassContainer>
          </View>
        </ScrollView>

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
                  {item.total >= 0 ? "+" : "-"}${formatCurrency(Math.abs(item.total), 2)}
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
                    <View style={styles.consumptionAmountRow}>
                      <Text
                        style={[styles.consumptionAmount, { color: theme.text }]}
                      >
                        {consumption.type === "income" ? "+" : "-"}
                        ${formatCurrency(consumption.amount, 2)}
                      </Text>
                      <View
                        style={[
                          styles.consumptionTypeBadge,
                          {
                            backgroundColor:
                              consumption.type === "income"
                                ? theme.isDark
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "rgba(0, 0, 0, 0.05)"
                                : "transparent",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            consumption.type === "income"
                              ? "arrow-up"
                              : "arrow-down"
                          }
                          size={10}
                          color={theme.textSecondary}
                        />
                      </View>
                    </View>
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
                  <View style={styles.consumptionActions}>
                    <Text
                      style={[
                        styles.consumptionTime,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {formatTime(consumption.date, resolvedLanguage)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleEdit(consumption as Consumption)}
                      style={[styles.editButton, { backgroundColor: theme.border }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={14} color={theme.text} />
                    </TouchableOpacity>
                  </View>
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

      <EditConsumptionModal
        visible={editModalVisible}
        consumption={editingConsumption}
        onClose={handleEditClose}
        onSave={handleEditSave}
        onDelete={handleDelete}
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
  statsScrollView: {
    marginBottom: 16,
  },
  statsScrollContent: {
    paddingHorizontal: 16, // Padding for first and last cards
    paddingRight: 16, // Extra padding on right for last card
    gap: 8,
  },
  statCardWrapper: {
    // Width is set dynamically via inline style based on screen width
    minHeight: 100, // Fixed minimum height for consistency
    marginRight: 8, // Gap between cards
  },
  statCard: {
    width: "100%",
    height: 100, // Fixed height for all cards - ensures stability
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "space-between", // Distribute content evenly
  },
  statCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    width: "100%",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 18, // Slightly reduced for better fit
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
    marginVertical: 4,
  },
  statSubtext: {
    fontSize: 11,
    marginTop: 2,
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
  consumptionAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  consumptionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  consumptionTypeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  consumptionDescription: {
    fontSize: 14,
  },
  consumptionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  consumptionTime: {
    fontSize: 12,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
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
