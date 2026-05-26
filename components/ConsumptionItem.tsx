import { GlassContainer } from "@/components/GlassContainer";
import { GlassIconButton } from "@/components/glass-icon-button";
import { SymbolIcon } from "@/components/symbol-icon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Consumption } from "@/types/consumption";
import { formatCurrency, formatDate, formatTime } from "@/utils/formatting";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface ConsumptionItemProps {
  consumption: Consumption;
  onEdit: (consumption: Consumption) => void;
}

function ConsumptionItemComponent({
  consumption,
  onEdit,
}: ConsumptionItemProps) {
  const { theme } = useTheme();
  const { resolvedLanguage, t } = useLanguage();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleEdit = useCallback(() => {
    onEdit(consumption);
  }, [consumption, onEdit]);

  const displayDate = formatDate(
    consumption.date,
    resolvedLanguage,
    t("today_label"),
    t("yesterday")
  );
  const displayTime = formatTime(consumption.date, resolvedLanguage);
  const displayDescription =
    consumption.description?.trim() &&
    consumption.description.trim() !== "No description"
      ? consumption.description.trim()
      : t("noDescription");

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(35).stiffness(80)}
      exiting={FadeOutUp.duration(200)}
      layout={Layout.springify().damping(40).stiffness(60)}
      style={styles.outerContainer}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPressIn={() => {
            scale.value = withSpring(0.985, { damping: 22, stiffness: 280 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 20, stiffness: 240 });
          }}
          style={styles.wrapper}
        >
          <GlassContainer intensity="medium" style={styles.container}>
            <View style={styles.content}>
              <View style={styles.mainInfo}>
                <View style={styles.amountRow}>
                  <Text
                    selectable
                    style={[styles.amount, { color: theme.text, fontVariant: ["tabular-nums"] }]}
                  >
                    {consumption.type === "income" ? "+" : "-"}
                    ${formatCurrency(consumption.amount, 2)}
                  </Text>
                  <GlassContainer intensity="clear" style={styles.typeBadge}>
                    <View style={styles.typeBadgeContent}>
                      <SymbolIcon
                        name={
                          consumption.type === "income"
                            ? "arrow-up-outline"
                            : "arrow-down-outline"
                        }
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[styles.typeText, { color: theme.textSecondary }]}
                      >
                        {consumption.type === "income" ? t("income") : t("expense")}
                      </Text>
                    </View>
                  </GlassContainer>
                </View>
                <Text
                  selectable
                  style={[styles.description, { color: theme.textSecondary }]}
                >
                  {displayDescription}
                </Text>
              </View>
              <View style={styles.meta}>
                <Text style={[styles.date, { color: theme.textSecondary }]}>
                  {displayDate}
                </Text>
                <Text
                  selectable
                  style={[styles.time, { color: theme.textSecondary, fontVariant: ["tabular-nums"] }]}
                >
                  {displayTime}
                </Text>
              </View>
            </View>
            <GlassIconButton
              size={34}
              onPress={handleEdit}
              accessibilityLabel={t("editConsumption") || "Edit"}
              style={styles.editButton}
            >
              <SymbolIcon name="pencil" size={16} color={theme.text} />
            </GlassIconButton>
          </GlassContainer>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  wrapper: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderCurve: "continuous",
    gap: 12,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainInfo: {
    flex: 1,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: "600",
  },
  typeBadge: {
    borderRadius: 999,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  typeBadgeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  description: {
    fontSize: 14,
  },
  meta: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  date: {
    fontSize: 13,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
  },
  editButton: {
    flexShrink: 0,
  },
});

export const ConsumptionItem = memo(ConsumptionItemComponent);
