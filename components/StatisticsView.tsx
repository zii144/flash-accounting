import { GlassContainer } from "@/components/GlassContainer";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";

type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type TimeFilter = "all" | "today" | "week" | "month" | "year";

interface GroupedConsumption {
  date: string;
  dateLabel: string;
  consumptions: Consumption[];
  total: number;
}

export function StatisticsView() {
  const { theme } = useTheme();
  const { consumptions } = useConsumptionStorage();
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

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
          dateLabel = "Today";
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
          dateLabel = "Yesterday";
        } else {
          dateLabel = dateObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
        }

        return {
          date,
          dateLabel,
          consumptions: items,
          total: items.reduce((sum, item) => sum + item.amount, 0),
        } as GroupedConsumption;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sortedConsumptions]);

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
        const dateLabel = dateObj.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        return {
          date: key,
          dateLabel,
          consumptions: items,
          total: items.reduce((sum, item) => sum + item.amount, 0),
        } as GroupedConsumption;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sortedConsumptions]);

  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const displayData = viewMode === "day" ? groupedByDay : groupedByMonth;

  const totalAmount = filteredConsumptions.reduce(
    (sum, c) => sum + c.amount,
    0
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.title, { color: theme.text }]}>Statistics</Text>

        {/* Summary Cards */}
        <View style={styles.statsContainer}>
          <GlassContainer intensity="light" style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              ${totalAmount.toFixed(2)}
            </Text>
          </GlassContainer>

          <GlassContainer intensity="light" style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Count
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {filteredConsumptions.length}
            </Text>
          </GlassContainer>
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
              By Day
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
              By Month
            </Text>
          </TouchableOpacity>
        </GlassContainer>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <GlassContainer intensity="light" style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Time:
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
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </GlassContainer>

          <GlassContainer intensity="light" style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Sort:
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
                  ? "Newest"
                  : sortOption === "date-asc"
                  ? "Oldest"
                  : sortOption === "amount-desc"
                  ? "Highest"
                  : "Lowest"}
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
              entering={FadeInDown.springify().damping(25)}
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
                    {item.consumptions.length === 1 ? "item" : "items"}
                  </Text>
                </View>
                <Text style={[styles.groupTotal, { color: theme.text }]}>
                  ${item.total.toFixed(2)}
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
                      ${consumption.amount.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.consumptionDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {consumption.description}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.consumptionTime,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {new Date(consumption.date).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No consumptions found
              </Text>
            </View>
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
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
