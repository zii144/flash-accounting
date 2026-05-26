import { ConsumptionForm } from "@/components/ConsumptionForm";
import { ConsumptionItem } from "@/components/ConsumptionItem";
import { EditConsumptionModal } from "@/components/EditConsumptionModal";
import { GlassContainer } from "@/components/GlassContainer";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePro } from "@/contexts/ProContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { useConsumptionStats } from "@/hooks/useConsumptionStats";
import { Consumption, ConsumptionDraft } from "@/types/consumption";
import { isAppErrorCode } from "@/utils/app-error";
import { createConsumptionRecord } from "@/utils/consumption-record";
import { FREE_LOCAL_RECORD_LIMIT } from "@/utils/constants";
import { formatCurrency } from "@/utils/formatting";
import { logger } from "@/utils/logger";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { SymbolIcon } from "@/components/symbol-icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  ListRenderItem,
  Platform,
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
  const { getStats } = useConsumptionStats();
  const { isFirebaseReady, isSignedIn } = useAuth();
  const { isConfigured: isPurchaseConfigured } = usePro();
  const {
    isLoading,
    saveConsumption,
    updateConsumption,
    deleteConsumption,
    loadPaginated,
    totalCount,
  } = useConsumptionStorage();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<Consumption | null>(null);
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<Consumption[]>([]);
  const [ledgerNetTotal, setLedgerNetTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const prevTotalCountRef = useRef<number>(0);
  const loadPageRef = useRef<((pageNum: number, append?: boolean) => Promise<void>) | null>(null);
  const canUnlockCloudStorage =
    isPurchaseConfigured && (isSignedIn || (Platform.OS === "ios" && isFirebaseReady));

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings");
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

  useFocusEffect(
    useCallback(() => {
      if (!isLoading && loadPageRef.current) {
        loadPageRef.current(1, false);
      }
    }, [isLoading])
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stats = await getStats("all");
        if (!cancelled) {
          setLedgerNetTotal(stats.netTotal);
        }
      } catch (error) {
        logger.error("Failed to load ledger total", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getStats, isLoading, totalCount]);

  const handleSubmit = useCallback(
    async (data: ConsumptionDraft) => {
      try {
        const consumption = createConsumptionRecord({
          ...data,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          date: new Date().toISOString(),
        });
        await saveConsumption(consumption);
      } catch (error) {
        if (isAppErrorCode(error, "LOCAL_LIMIT_REACHED")) {
          const limitMessage = canUnlockCloudStorage
            ? t("localLimitReachedMessage")
            : t("localLimitReachedLocalOnlyMessage").replace(
                "{limit}",
                String(FREE_LOCAL_RECORD_LIMIT)
              );

          Alert.alert(t("localLimitReachedTitle"), limitMessage, [{ text: t("confirm") || "OK" }]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }

        const errorMessage = error instanceof Error ? error.message : t("errorSaveFailed");

        Alert.alert(t("errorOccurred") || "Error", errorMessage, [
          { text: t("tryAgain") || "OK" },
        ]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [canUnlockCloudStorage, saveConsumption, t]
  );

  const totalAmount = useMemo(() => {
    const sign = ledgerNetTotal < 0 ? "-" : "";
    return `${sign}$${formatCurrency(Math.abs(ledgerNetTotal), 2)}`;
  }, [ledgerNetTotal]);

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

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.text }]}>{t("flashAccounting")}</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
            <GlassContainer intensity="medium" style={styles.settingsGlass}>
              <SymbolIcon name="settings" size={20} color={theme.text} />
            </GlassContainer>
          </TouchableOpacity>
        </View>
        <Text style={[styles.total, { color: theme.textSecondary }]}>
          {t("total")}: {totalAmount}
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
