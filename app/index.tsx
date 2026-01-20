import { ConsumptionForm } from "@/components/ConsumptionForm";
import { ConsumptionItem } from "@/components/ConsumptionItem";
import { GlassContainer } from "@/components/GlassContainer";
import { GlassTabBar } from "@/components/GlassTabBar";
import { SettingsModal } from "@/components/SettingsModal";
import { StatisticsView } from "@/components/StatisticsView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { formatCurrency } from "@/utils/formatting";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

export default function Index() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { consumptions, isLoading, saveConsumption, deleteConsumption } =
    useConsumptionStorage();
  const [activeTab, setActiveTab] = useState<"accounting" | "statistics">(
    "accounting"
  );
  const [settingsVisible, setSettingsVisible] = useState(false);

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsVisible(true);
  }, []);

  const handleSubmit = useCallback(
    (data: Omit<Consumption, "id" | "date">) => {
      const consumption: Consumption = {
        ...data,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        date: new Date().toISOString(),
      };
      saveConsumption(consumption);
    },
    [saveConsumption]
  );

  const totalAmount = useMemo(
    () => consumptions.reduce((sum, c) => sum + c.amount, 0),
    [consumptions]
  );

  const handleTabChange = useCallback((tab: "accounting" | "statistics") => {
    setActiveTab(tab);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteConsumption(id);
    },
    [deleteConsumption]
  );

  const renderItem: ListRenderItem<Consumption> = useCallback(
    ({ item }) => (
      <ConsumptionItem consumption={item} onDelete={handleDelete} />
    ),
    [handleDelete]
  );

  const keyExtractor = useCallback((item: Consumption) => item.id, []);

  const ListEmptyComponent = useMemo(
    () =>
      !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t("noConsumptionsYet")}
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            {t("addFirstExpense")}
          </Text>
        </View>
      ) : null,
    [isLoading, theme.textSecondary, t]
  );

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
            <View style={styles.headerTop}>
              <Text style={[styles.title, { color: theme.text }]}>
                {t("flashAccounting")}
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
            <Text style={[styles.total, { color: theme.textSecondary }]}>
              {t("total")}: ${formatCurrency(totalAmount, 2)}
            </Text>
          </View>

          <ConsumptionForm onSubmit={handleSubmit} />

          <FlatList
            data={consumptions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
            getItemLayout={(data, index) => ({
              length: 72,
              offset: 72 * index,
              index,
            })}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={ListEmptyComponent}
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

      <GlassTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        consumptions={consumptions}
      />
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
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
  total: {
    fontSize: 18,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 0,
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
