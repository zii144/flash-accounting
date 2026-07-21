import { ConsumptionForm } from "@/components/ConsumptionForm";
import { ConsumptionItem } from "@/components/ConsumptionItem";
import { EditConsumptionModal } from "@/components/EditConsumptionModal";
import { GlassIconButton } from "@/components/glass-icon-button";
import { Screen } from "@/components/screen";
import { SymbolIcon } from "@/components/symbol-icon";
import { Text } from "@/components/text";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePro } from "@/contexts/ProContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStats } from "@/hooks/useConsumptionStats";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { Consumption, ConsumptionDraft } from "@/types/consumption";
import { isAppErrorCode } from "@/utils/app-error";
import { FREE_LOCAL_RECORD_LIMIT } from "@/utils/constants";
import { createConsumptionRecord } from "@/utils/consumption-record";
import { formatCurrency } from "@/utils/formatting";
import { logger } from "@/utils/logger";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    ListRenderItem,
    Platform,
    StyleSheet,
    View,
} from "react-native";

const PAGE_SIZE = 5;

export function AccountingScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getStats } = useConsumptionStats();
  const { isFirebaseReady, isSignedIn } = useAuth();
  const { isConfigured: isPurchaseConfigured } = usePro();
  const {
    consumptions,
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
  const loadGenerationRef = useRef(0);
  const loadPageRef = useRef<((pageNum: number, append?: boolean) => Promise<void>) | null>(null);
  const canUnlockCloudStorage =
    isPurchaseConfigured && (isSignedIn || (Platform.OS === "ios" && isFirebaseReady));

  const handleSettingsPress = useCallback(() => {
    router.push("/settings");
  }, []);

  const loadPage = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (append && isLoadingMore) {
        return;
      }

      const generation = append
        ? loadGenerationRef.current
        : ++loadGenerationRef.current;

      setIsLoadingMore(true);
      try {
        const result = await loadPaginated({
          page: pageNum,
          pageSize: PAGE_SIZE,
          sortBy: "date",
          sortOrder: "DESC",
        });

        if (generation !== loadGenerationRef.current) {
          return;
        }

        if (append) {
          setPaginatedData((prev) => [...prev, ...result.data]);
        } else {
          setPaginatedData(result.data);
        }

        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (error) {
        if (generation !== loadGenerationRef.current) {
          return;
        }
        logger.error("Failed to load page", error, { page: pageNum });
      } finally {
        if (generation === loadGenerationRef.current) {
          setIsLoadingMore(false);
        }
      }
    },
    [isLoadingMore, loadPaginated]
  );

  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  useEffect(() => {
    if (isLoading || !loadPageRef.current) {
      return;
    }

    loadPageRef.current(1, false);
  }, [isLoading, totalCount]);

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
  }, [consumptions, getStats, isLoading, totalCount]);

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
          return;
        }

        const errorMessage = error instanceof Error ? error.message : t("errorSaveFailed");

        Alert.alert(t("errorOccurred") || "Error", errorMessage, [
          { text: t("tryAgain") || "OK" },
        ]);
      }
    },
    [canUnlockCloudStorage, saveConsumption, t]
  );

  const totalAmount = useMemo(() => {
    const sign = ledgerNetTotal < 0 ? "-" : "";
    return `${sign}$${formatCurrency(Math.abs(ledgerNetTotal), 2)}`;
  }, [ledgerNetTotal]);

  const fadeGradientColors = theme.fadeGradient;

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
    ({ item }) => (
      <ConsumptionItem consumption={item} onEdit={handleEdit} onDelete={handleDelete} />
    ),
    [handleDelete, handleEdit]
  );

  const ListEmptyComponent = useMemo(
    () =>
      !isLoading && !isLoadingMore ? (
        <View style={styles.emptyContainer}>
          <Text variant="body" weight="regular" color="textSecondary" style={styles.emptyText}>
            {t("noConsumptionsYet")}
          </Text>
          <Text variant="label" weight="regular" color="textSecondary">
            {t("addFirstExpense")}
          </Text>
        </View>
      ) : null,
    [isLoading, isLoadingMore, t]
  );

  return (
    <Screen
      title={t("flashAccounting")}
      titleWeight="bold"
      headerRight={
        <GlassIconButton
          size={40}
          onPress={handleSettingsPress}
          accessibilityLabel={t("settings")}
          testID="settings-button"
        >
          <SymbolIcon name="settings" size={20} color={theme.text} />
        </GlassIconButton>
      }
      headerSubtitle={
        <Text
          selectable
          variant="bodyEmphasis"
          weight="medium"
          color="textSecondary"
          tabularNums
          style={styles.total}
        >
          {t("total")}: {totalAmount}
        </Text>
      }
    >
      <ConsumptionForm onSubmit={handleSubmit} history={consumptions} />

      <View style={styles.listWrapper}>
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={paginatedData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={(_, index) => ({
            length: 88,
            offset: 88 * index,
            index,
          })}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={ListEmptyComponent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingFooter}>
                <Text variant="label" weight="regular" color="textSecondary">
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: {
    // typography via <Text variant="bodyEmphasis" weight="medium">
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
    marginBottom: 8,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
