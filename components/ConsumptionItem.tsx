import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Consumption } from "@/types/consumption";
import { formatCurrency, formatDate, formatTime } from "@/utils/formatting";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ConsumptionItemProps {
  consumption: Consumption;
  onDelete: (id: string) => void;
  onEdit: (consumption: Consumption) => void;
}

function ConsumptionItemComponent({
  consumption,
  onDelete,
  onEdit,
}: ConsumptionItemProps) {
  const { theme } = useTheme();
  const { resolvedLanguage, t } = useLanguage();
  const [isPressed, setIsPressed] = React.useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(isPressed ? 0.98 : 1, {
      damping: 25,
      stiffness: 200,
    });
    opacity.value = withTiming(isPressed ? 0.9 : 1, { duration: 100 });
  }, [isPressed, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleDelete = useCallback(() => {
    onDelete(consumption.id);
  }, [consumption.id, onDelete]);

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
        <AnimatedTouchable
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          activeOpacity={1}
          style={styles.wrapper}
        >
          <GlassContainer intensity="light" style={styles.container}>
            <View style={styles.content}>
              <View style={styles.mainInfo}>
                <View style={styles.amountRow}>
                  <Text style={[styles.amount, { color: theme.text }]}>
                    {consumption.type === "income" ? "+" : "-"}
                    ${formatCurrency(consumption.amount, 2)}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          consumption.type === "income"
                            ? theme.isDark
                              ? "rgba(255, 255, 255, 0.15)"
                              : "rgba(0, 0, 0, 0.08)"
                            : "transparent",
                        borderWidth: consumption.type === "expense" ? 1 : 0,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        consumption.type === "income"
                          ? "arrow-up-outline"
                          : "arrow-down-outline"
                      }
                      size={12}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {consumption.type === "income"
                        ? t("income")
                        : t("expense")}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.description, { color: theme.textSecondary }]}
                >
                  {displayDescription}
                </Text>
              </View>
              <View style={styles.meta}>
                <Text style={[styles.date, { color: theme.textSecondary }]}>
                  {displayDate}
                </Text>
                <Text style={[styles.time, { color: theme.textSecondary }]}>
                  {displayTime}
                </Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={handleEdit}
                style={[styles.actionButton, { backgroundColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={16} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={[styles.actionButton, { backgroundColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.deleteText, { color: theme.text }]}>×</Text>
              </TouchableOpacity>
            </View>
          </GlassContainer>
        </AnimatedTouchable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  wrapper: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 0,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
  },
  meta: {
    alignItems: "flex-end",
    marginLeft: 16,
  },
  date: {
    fontSize: 13,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 24,
  },
});

export const ConsumptionItem = memo(ConsumptionItemComponent);
