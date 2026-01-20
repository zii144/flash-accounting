import { ConsumptionForm } from "@/components/ConsumptionForm";
import { ConsumptionItem } from "@/components/ConsumptionItem";
import { EditConsumptionModal } from "@/components/EditConsumptionModal";
import { FeatureItem, FeaturesCarousel } from "@/components/FeaturesCarousel";
import { GlassContainer } from "@/components/GlassContainer";
import { GlassTabBar } from "@/components/GlassTabBar";
import { SettingsModal } from "@/components/SettingsModal";
import { StatisticsView } from "@/components/StatisticsView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { dismissFeatureCarousel, shouldShowFeatureCarousel } from "@/utils/feature-carousel";
import { FEATURES, getFeatureTranslationKeys } from "@/utils/features";
import { formatCurrency } from "@/utils/formatting";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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

const PAGE_SIZE = 5;

export default function Index() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    consumptions,
    isLoading,
    saveConsumption,
    updateConsumption,
    deleteConsumption,
    loadPaginated,
    totalCount,
  } = useConsumptionStorage();
  const [activeTab, setActiveTab] = useState<"accounting" | "statistics">(
    "accounting"
  );
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<Consumption | null>(null);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [isCheckingCarousel, setIsCheckingCarousel] = useState(true);
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<Consumption[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const prevTotalCountRef = useRef<number>(0);
  const loadPageRef = useRef<((pageNum: number, append?: boolean) => Promise<void>) | null>(null);
  const lastActiveTabRef = useRef<string>('');

  const featureItems: FeatureItem[] = useMemo(
    () =>
      FEATURES.map((feature) => {
        const keys = getFeatureTranslationKeys(feature.id);
        return {
          titleKey: keys.titleKey,
          messageKey: keys.messageKey,
          icon: feature.icon,
        };
      }),
    []
  );

  // Check if carousel should be shown on mount
  useEffect(() => {
    const checkCarouselVisibility = async () => {
      try {
        const shouldShow = await shouldShowFeatureCarousel();
        setCarouselVisible(shouldShow);
      } catch (error) {
        console.error('Failed to check carousel visibility:', error);
        // On error, show the carousel to be safe
        setCarouselVisible(true);
      } finally {
        setIsCheckingCarousel(false);
      }
    };

    checkCarouselVisibility();
  }, []);

  const handleCarouselDismiss = useCallback(async () => {
    try {
      await dismissFeatureCarousel();
      setCarouselVisible(false);
    } catch (error) {
      console.error('Failed to dismiss carousel:', error);
      // Still hide the carousel even if save fails
      setCarouselVisible(false);
    }
  }, []);

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsVisible(true);
  }, []);

  // Load paginated data
  const loadPage = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (isLoadingMore) return;
      
      setIsLoadingMore(true);
      try {
        const result = await loadPaginated({
          page: pageNum,
          pageSize: PAGE_SIZE,
          sortBy: 'date',
          sortOrder: 'DESC',
        });
        
        if (append) {
          setPaginatedData((prev) => [...prev, ...result.data]);
        } else {
          setPaginatedData(result.data);
        }
        
        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (error) {
        console.error('Failed to load page:', error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [loadPaginated, isLoadingMore]
  );

  // Store loadPage in ref to avoid dependency issues
  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  // Load initial page when app loads or tab switches to accounting
  useEffect(() => {
    if (!isLoading && loadPageRef.current) {
      if (activeTab === 'accounting' && lastActiveTabRef.current !== activeTab) {
        // Switching to accounting tab - load page 1
        lastActiveTabRef.current = activeTab;
        prevTotalCountRef.current = totalCount;
        setPaginatedData([]); // Clear existing data
        loadPageRef.current(1, false);
      } else if (activeTab !== 'accounting') {
        // Switching away from accounting - reset ref for next time
        lastActiveTabRef.current = activeTab;
      }
    }
  }, [isLoading, activeTab, totalCount]);

  // Refresh paginated data when consumptions change (e.g., after add/delete)
  // Only reload if totalCount actually changed and we're on accounting tab
  useEffect(() => {
    if (
      activeTab === 'accounting' && 
      !isLoading && 
      totalCount !== prevTotalCountRef.current &&
      !isLoadingMore &&
      loadPageRef.current
    ) {
      prevTotalCountRef.current = totalCount;
      loadPageRef.current(1, false); // Reset to page 1 when data changes
    }
  }, [totalCount, activeTab, isLoading, isLoadingMore]);

  const handleSubmit = useCallback(
    async (data: Omit<Consumption, "id" | "date">) => {
      try {
        const consumption: Consumption = {
          ...data,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          date: new Date().toISOString(),
        };
        await saveConsumption(consumption);
        // Success feedback is handled by the form
      } catch (error) {
        // Show user-friendly error message
        const errorMessage = error instanceof Error 
          ? error.message 
          : t("errorSaveFailed");
        
        Alert.alert(
          t("errorOccurred") || "Error",
          errorMessage,
          [{ text: t("tryAgain") || "OK" }]
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [saveConsumption, t]
  );

  // Calculate total from paginated data only (or get from DB if needed)
  const totalAmount = useMemo(
    () => paginatedData.reduce((sum, c) => sum + c.amount, 0),
    [paginatedData]
  );

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

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadPage(page + 1, true);
    }
  }, [isLoadingMore, hasMore, page, loadPage]);

  const handleTabChange = useCallback((tab: "accounting" | "statistics") => {
    setActiveTab(tab);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteConsumption(id);
        // Success feedback is handled by the item component
      } catch (error) {
        // Show user-friendly error message
        const errorMessage = error instanceof Error 
          ? error.message 
          : t("errorDeleteFailed");
        
        Alert.alert(
          t("errorOccurred") || "Error",
          errorMessage,
          [{ text: t("tryAgain") || "OK" }]
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [deleteConsumption, t]
  );

  const handleEdit = useCallback((consumption: Consumption) => {
    setEditingConsumption(consumption);
    setEditModalVisible(true);
  }, []);

  const handleEditSave = useCallback(
    async (consumption: Consumption) => {
      await updateConsumption(consumption);
      // Refresh the list after update
      if (loadPageRef.current) {
        loadPageRef.current(1, false);
      }
    },
    [updateConsumption]
  );

  const handleEditClose = useCallback(() => {
    setEditModalVisible(false);
    setEditingConsumption(null);
  }, []);

  const renderItem: ListRenderItem<Consumption> = useCallback(
    ({ item }) => (
      <ConsumptionItem consumption={item} onEdit={handleEdit} />
    ),
    [handleEdit]
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

      {!isCheckingCarousel && (
        <FeaturesCarousel
          items={featureItems}
          visible={carouselVisible}
          onDismiss={handleCarouselDismiss}
        />
      )}

      {!carouselVisible && (
        <>
          {activeTab === "accounting" ? (
        <Animated.View
          key="accounting"
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
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

          <View style={styles.listWrapper}>
            <FlatList
              data={paginatedData}
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
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={styles.loadingFooter}>
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                      {t("loading") || "Loading..."}
                    </Text>
                  </View>
                ) : null
              }
            />
            <LinearGradient
              colors={fadeGradientColors}
              locations={[0, 0.4, 0.7, 1]}
              style={styles.fadeOverlay}
              pointerEvents="none"
            />
          </View>
        </Animated.View>
      ) : (
        <Animated.View
          key="statistics"
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
          layout={Layout.springify().damping(25)}
          style={styles.content}
        >
          <StatisticsView />
        </Animated.View>
      )}

          <Animated.View
            entering={FadeIn.duration(400).delay(100)}
            exiting={FadeOut.duration(300)}
          >
            <GlassTabBar activeTab={activeTab} onTabChange={handleTabChange} />
          </Animated.View>
        </>
      )}

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
    alignItems: "flex-start",
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
    alignSelf: "flex-start",
  },
  listWrapper: {
    flex: 1,
    position: "relative",
  },
  listContent: {
    paddingBottom: 120,
  },
  fadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 10,
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
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
  },
});
