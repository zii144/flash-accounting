import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function StatisticsView() {
  const { theme } = useTheme();
  const { consumptions } = useConsumptionStorage();

  // Calculate statistics
  const totalAmount = consumptions.reduce((sum, c) => sum + c.amount, 0);
  const todayAmount = consumptions
    .filter((c) => {
      const date = new Date(c.date);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    })
    .reduce((sum, c) => sum + c.amount, 0);

  const thisWeekAmount = consumptions
    .filter((c) => {
      const date = new Date(c.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    })
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Statistics</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              ${totalAmount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Today
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              ${todayAmount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Week
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              ${thisWeekAmount.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.placeholder}>
          <Text
            style={[styles.placeholderText, { color: theme.textSecondary }]}
          >
            Chart visualization coming soon...
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
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
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
  },
});
