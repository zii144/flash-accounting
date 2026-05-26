import { GlassContainer, type GlassIntensity } from "@/components/GlassContainer";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BUTTON_RADIUS = 14;

type GlassButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: GlassIntensity;
  haptic?: boolean;
  accessibilityLabel?: string;
};

export function GlassButton({
  onPress,
  disabled = false,
  children,
  style,
  contentStyle,
  intensity = "medium",
  haptic = true,
  accessibilityLabel,
}: GlassButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) {
      return;
    }
    scale.value = withSpring(0.97, { damping: 20, stiffness: 320 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  const handlePress = () => {
    if (disabled || !onPress) {
      return;
    }

    if (haptic && process.env.EXPO_OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress();
  };

  return (
    <Animated.View style={[styles.slot, animatedStyle, style]}>
      <GlassContainer
        intensity={disabled ? "light" : intensity}
        interactive={!disabled}
        style={styles.glass}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.pressable, contentStyle]}
        >
          {children}
        </AnimatedPressable>
      </GlassContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    overflow: "visible",
  },
  glass: {
    borderRadius: BUTTON_RADIUS,
    borderCurve: "continuous",
  },
  pressable: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
});
