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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// Insets are read here (in the parent tree) rather than via SafeAreaView, which
// does not receive context inside a native modal presentation.
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();

  const rowBackground = theme.isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)";
  const rowPressed = theme.isDark ? "rgba(255, 255, 255, 0.11)" : "rgba(0, 0, 0, 0.07)";

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
          { backgroundColor: pressed ? rowPressed : rowBackground },
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
    [formatRecordDate, onSelectRecord, rowBackground, rowPressed, t, theme],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
      onDismiss={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
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
            testID="category-detail-close"
            style={[styles.closeButton, { backgroundColor: rowBackground }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SymbolIcon name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
          ListEmptyComponent={
            <GlassContainer intensity="light" style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {t("noConsumptions")}
              </Text>
            </GlassContainer>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.6,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
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
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 10,
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
