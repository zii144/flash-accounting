import { ConsumptionForm } from "@/components/ConsumptionForm";
import { ConsumptionItem } from "@/components/ConsumptionItem";
import { GlassTabBar } from "@/components/GlassTabBar";
import { StatisticsView } from "@/components/StatisticsView";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import React, { useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

export default function Index() {
  const { theme } = useTheme();
  const { consumptions, isLoading, saveConsumption, deleteConsumption } =
    useConsumptionStorage();
  const [activeTab, setActiveTab] = useState<"accounting" | "statistics">(
    "accounting"
  );

  const handleSubmit = (data: Omit<Consumption, "id" | "date">) => {
    const consumption: Consumption = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
    };
    saveConsumption(consumption);
  };

  const totalAmount = consumptions.reduce((sum, c) => sum + c.amount, 0);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />

      {activeTab === "accounting" ? (
        <Animated.View
          key="accounting"
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          layout={Layout.springify().damping(25)}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Flash Accounting
            </Text>
            <Text style={[styles.total, { color: theme.textSecondary }]}>
              Total: ${totalAmount.toFixed(2)}
            </Text>
          </View>

          <ConsumptionForm onSubmit={handleSubmit} />

          <FlatList
            data={consumptions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConsumptionItem
                consumption={item}
                onDelete={deleteConsumption}
              />
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <Text
                    style={[styles.emptyText, { color: theme.textSecondary }]}
                  >
                    No consumptions yet
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Add your first expense above
                  </Text>
                </View>
              ) : null
            }
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="statistics"
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          layout={Layout.springify().damping(25)}
          style={styles.content}
        >
          <StatisticsView />
        </Animated.View>
      )}

      <GlassTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  total: {
    fontSize: 18,
    fontWeight: "500",
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
});
