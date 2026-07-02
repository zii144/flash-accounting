import { GlassContainer } from "@/components/GlassContainer";
import { SymbolIcon } from "@/components/symbol-icon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { Consumption } from "@/types/consumption";
import { toDisplayDate } from "@/utils/date-utils";
import { formatCurrency, LOCALE_MAP } from "@/utils/formatting";
import { useCallback } from "react";
import {
  FlatList,
  type ListRenderItem,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

interface CategoryDetailSheetProps {
  visible: boolean;
  label: string | null;
  records: Consumption[];
  totalAmount: number;
  swatchColor: string;
  onClose: () => void;
  onSelectRecord: (record: Consumption) => void;
}

export function CategoryDetailSheet({
  visible,
  label,
  records,
  totalAmount,
  swatchColor,
  onClose,
  onSelectRecord,
}: CategoryDetailSheetProps) {
  const { theme } = useTheme();
  const { t, resolvedLanguage } = useLanguage();

  const formatRecordDate = useCallback(
    (dateString: string) =>
      toDisplayDate(dateString).toLocaleDateString(LOCALE_MAP[resolvedLanguage] || "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [resolvedLanguage],
  );

  const renderItem: ListRenderItem<Consumption> = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => onSelectRecord(item)}
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: theme.border,
            backgroundColor: pressed
              ? theme.isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.05)"
              : "transparent",
          },
        ]}
      >
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.rowDescription, { color: theme.text }]}>
            {item.description || t("noDescription")}
          </Text>
          <Text style={[styles.rowDate, { color: theme.textSecondary }]}>
            {formatRecordDate(item.date)}
          </Text>
        </View>
        <Text style={[styles.rowAmount, { color: theme.text }]}>
          ${formatCurrency(item.amount, 0)}
        </Text>
        <SymbolIcon name="chevron-forward" size={16} color={theme.textSecondary} />
      </Pressable>
    ),
    [formatRecordDate, onSelectRecord, t, theme],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.isDark
                ? "rgba(28, 28, 30, 0.98)"
                : "rgba(255, 255, 255, 0.99)",
            },
          ]}
        >
          <SafeAreaView edges={["bottom"]} style={styles.sheetInner}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <View style={styles.headerTitleRow}>
                  <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
                  <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
                    {label ?? t("categoryTransactions")}
                  </Text>
                </View>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {`$${formatCurrency(totalAmount, 0)} • ${records.length} ${t("items")}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SymbolIcon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={records}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <GlassContainer intensity="light" style={styles.empty}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {t("noConsumptions")}
                  </Text>
                </GlassContainer>
              }
            />
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  sheetInner: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowDescription: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  empty: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
