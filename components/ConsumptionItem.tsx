import { GlassContainer } from "@/components/GlassContainer";
import { useTheme } from "@/contexts/ThemeContext";
import { Consumption } from "@/types/consumption";
import React from "react";
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
}

export function ConsumptionItem({
  consumption,
  onDelete,
}: ConsumptionItemProps) {
  const { theme } = useTheme();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
                <Text style={[styles.amount, { color: theme.text }]}>
                  ${consumption.amount.toFixed(2)}
                </Text>
                {consumption.description && (
                  <Text
                    style={[styles.description, { color: theme.textSecondary }]}
                  >
                    {consumption.description}
                  </Text>
                )}
              </View>
              <View style={styles.meta}>
                <Text style={[styles.date, { color: theme.textSecondary }]}>
                  {formatDate(consumption.date)}
                </Text>
                <Text style={[styles.time, { color: theme.textSecondary }]}>
                  {formatTime(consumption.date)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => onDelete(consumption.id)}
              style={[styles.deleteButton, { backgroundColor: theme.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.deleteText, { color: theme.text }]}>×</Text>
            </TouchableOpacity>
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
  amount: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
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
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  deleteText: {
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 24,
  },
});
