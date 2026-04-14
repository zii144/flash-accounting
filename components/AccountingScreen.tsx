import { ConsumptionForm } from "@/components/ConsumptionForm";
import { ConsumptionItem } from "@/components/ConsumptionItem";
import { EditConsumptionModal } from "@/components/EditConsumptionModal";
import { FeatureItem, FeaturesCarousel } from "@/components/FeaturesCarousel";
import { GlassContainer } from "@/components/GlassContainer";
import { SettingsModal } from "@/components/SettingsModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption } from "@/types/consumption";
import { dismissFeatureCarousel, shouldShowFeatureCarousel } from "@/utils/feature-carousel";
import { FEATURES, getFeatureTranslationKeys } from "@/utils/features";
import { formatCurrency } from "@/utils/formatting";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  ListRenderItem,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 5;

export function AccountingScreen() {
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

  useEffect(() => {
    const checkCarouselVisibility = async () => {
      try {
        const shouldShow = await shouldShowFeatureCarousel();
        setCarouselVisible(shouldShow);
      } catch (error) {
        logger.error("Failed to check carousel visibility", error);
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
      logger.error("Failed to dismiss carousel", error);
      setCarouselVisible(false);
    }
  }, []);

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsVisible(true);
  }, []);

  const loadPage = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (isLoadingMore) {
        return;
      }

      setIsLoadingMore(true);
      try {
        const result = await loadPaginated({
          page: pageNum,
          pageSize: PAGE_SIZE,
          sortBy: "date",
          sortOrder: "DESC",
        });

        if (append) {
          setPaginatedData((prev) => [...prev, ...result.data]);
        } else {
          setPaginatedData(result.data);
        }

        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (error) {
        logger.error("Failed to load page", error, { page: pageNum });
      } finally {
        setIsLoadingMore(false);
      }
    },
    [isLoadingMore, loadPaginated]
  );

  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  useEffect(() => {
    if (!isLoading && loadPageRef.current) {
      prevTotalCountRef.current = totalCount;
      loadPageRef.current(1, false);
    }
  }, [isLoading, totalCount]);

  useEffect(() => {
    if (
      !isLoading &&
      totalCount !== prevTotalCountRef.current &&
      !isLoadingMore &&
      loadPageRef.current
    ) {
      prevTotalCountRef.current = totalCount;
      loadPageRef.current(1, false);
    }
  }, [isLoading, isLoadingMore, totalCount]);

  const handleSubmit = useCallback(
    async (data: Omit<Consumption, "id" | "date">) => {
      try {
        const consumption: Consumption = {
          ...data,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          date: new Date().toISOString(),
        };
        await saveConsumption(consumption);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t("errorSaveFailed");

        Alert.alert(t("errorOccurred") || "Error", errorMessage, [
          { text: t("tryAgain") || "OK" },
        ]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [saveConsumption, t]
  );

  const totalAmount = useMemo(
    () => paginatedData.reduce((sum, consumption) => sum + consumption.amount, 0),
    [paginatedData]
  );

  const fadeGradientColors = useMemo(() => {
    if (theme.isDark) {
      return [
        "rgba(0, 0, 0, 0)",
        "rgba(0, 0, 0, 0.3)",
        "rgba(0, 0, 0, 0.7)",
        theme.background,
      ] as const;
    }

    return [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 255, 255, 0.3)",
      "rgba(255, 255, 255, 0.7)",
      theme.background,
    ] as const;
  }, [theme.background, theme.isDark]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadPage(page + 1, true);
    }
  }, [hasMore, isLoadingMore, loadPage, page]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        setPaginatedData((prev) => prev.filter((consumption) => consumption.id !== id));
        await deleteConsumption(id);
      } catch (error) {
        if (loadPageRef.current) {
          loadPageRef.current(page, false);
        }

        const errorMessage = error instanceof Error ? error.message : t("errorDeleteFailed");

        Alert.alert(t("errorOccurred") || "Error", errorMessage, [
          { text: t("tryAgain") || "OK" },
        ]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [deleteConsumption, page, t]
  );

  const handleEdit = useCallback((consumption: Consumption) => {
    setEditingConsumption(consumption);
    setEditModalVisible(true);
  }, []);

  const handleEditSave = useCallback(
    async (consumption: Consumption) => {
      await updateConsumption(consumption);
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
    ({ item }) => <ConsumptionItem consumption={item} onEdit={handleEdit} />,
    [handleEdit]
  );

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
    [isLoading, t, theme.textSecondary]
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.background }]}>
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
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={[styles.title, { color: theme.text }]}>{t("flashAccounting")}</Text>
              <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
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
              contentInsetAdjustmentBehavior="automatic"
              data={paginatedData}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
              getItemLayout={(_, index) => ({
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
    paddingBottom: 32,
  },
  fadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 84,
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
