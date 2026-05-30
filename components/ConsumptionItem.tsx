import { GlassContainer } from "@/components/GlassContainer";
import { GlassIconButton } from "@/components/glass-icon-button";
import { SymbolIcon } from "@/components/symbol-icon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Consumption } from "@/types/consumption";
import { formatCurrency, formatDate, formatTime } from "@/utils/formatting";
import * as Haptics from "expo-haptics";
import { memo, useCallback, useRef } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  FadeInDown,
  FadeOutUp,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

const DELETE_ACTION_MARGIN_LEFT = 12;
const DELETE_ACTION_WIDTH = 88;
const DELETE_ACTION_TOTAL_WIDTH = DELETE_ACTION_MARGIN_LEFT + DELETE_ACTION_WIDTH;

interface ConsumptionItemProps {
  consumption: Consumption;
  onEdit: (consumption: Consumption) => void;
  onDelete: (id: string) => void;
}

type DeleteActionProps = {
  translation: SharedValue<number>;
  label: string;
  onPress: () => void;
  isDark: boolean;
};

function DeleteAction({ translation, label, onPress, isDark }: DeleteActionProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + DELETE_ACTION_TOTAL_WIDTH }],
  }));

  return (
    <Animated.View
      style={[styles.deleteAction, { width: DELETE_ACTION_TOTAL_WIDTH }, animatedStyle]}
    >
      <GlassContainer interactive intensity="medium" style={styles.deleteGlass}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.deleteTint,
            {
              backgroundColor: isDark
                ? "rgba(255, 69, 58, 0.76)"
                : "rgba(255, 59, 48, 0.82)",
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.deletePressable,
            pressed && styles.deleteButtonPressed,
          ]}
        >
          <SymbolIcon name="trash" size={18} color="#FFFFFF" />
          <Text style={styles.deleteLabel}>{label}</Text>
        </Pressable>
      </GlassContainer>
    </Animated.View>
  );
}

function ConsumptionItemComponent({
  consumption,
  onEdit,
  onDelete,
}: ConsumptionItemProps) {
  const { theme } = useTheme();
  const { resolvedLanguage, t } = useLanguage();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleEdit = useCallback(() => {
    onEdit(consumption);
  }, [consumption, onEdit]);

  const handleDeletePress = useCallback(() => {
    Alert.alert(t("deleteEntry"), t("deleteConfirmation"), [
      {
        text: t("cancel"),
        style: "cancel",
        onPress: () => {
          swipeableRef.current?.close();
        },
      },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          swipeableRef.current?.close();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDelete(consumption.id);
        },
      },
    ]);
  }, [consumption.id, onDelete, t]);

  const renderRightActions = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <DeleteAction
        translation={translation}
        label={t("delete")}
        onPress={handleDeletePress}
        isDark={theme.isDark}
      />
    ),
    [handleDeletePress, t, theme.isDark]
  );

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
      style={styles.outerContainer}
    >
      <Swipeable
        ref={swipeableRef}
        friction={2}
        overshootRight={false}
        rightThreshold={40}
        containerStyle={styles.swipeable}
        renderRightActions={renderRightActions}
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
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: theme.isDark
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(120, 120, 128, 0.12)",
                    },
                  ]}
                >
                  <SymbolIcon
                    name={
                      consumption.type === "income"
                        ? "arrow-up-outline"
                        : "arrow-down-outline"
                    }
                    size={12}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.typeText, { color: theme.textSecondary }]}>
                    {consumption.type === "income" ? t("income") : t("expense")}
                  </Text>
                </View>
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
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  swipeable: {
    overflow: "visible",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderCurve: "continuous",
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
  deleteAction: {
    paddingLeft: DELETE_ACTION_MARGIN_LEFT,
  },
  deleteGlass: {
    flex: 1,
    borderRadius: 24,
    borderCurve: "continuous",
  },
  deleteTint: {
    borderRadius: 24,
    borderCurve: "continuous",
  },
  deletePressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  deleteButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  deleteLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export const ConsumptionItem = memo(ConsumptionItemComponent);
