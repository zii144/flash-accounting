import { useTheme } from "@/contexts/ThemeContext";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import React from "react";
import { Platform, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface GlassContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: "light" | "medium" | "heavy";
  animated?: boolean;
}

export function GlassContainer({
  children,
  style,
  intensity = "medium",
  animated = false,
}: GlassContainerProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(animated ? 0.95 : 1);
  const [isAnimationComplete, setIsAnimationComplete] =
    React.useState(!animated);

  React.useEffect(() => {
    if (animated) {
      scale.value = withSpring(
        1,
        {
          damping: 15,
          stiffness: 150,
        },
        (finished) => {
          if (finished) {
            setIsAnimationComplete(true);
          }
        },
      );
    }
  }, [animated, scale]);

  // On iOS 26+, use native Liquid Glass effect
  // On other platforms, fallback to semi-transparent background
  const [isAvailable, setIsAvailable] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === "ios") {
      try {
        // Check both compile-time availability and runtime API availability
        // This prevents crashes on iOS 26.2 where the API might not be available
        const compileTimeAvailable = isLiquidGlassAvailable();
        const runtimeAvailable = isGlassEffectAPIAvailable();
        setIsAvailable(compileTimeAvailable && runtimeAvailable);
      } catch {
        setIsAvailable(false);
      }
    }
  }, []);

  // Map our intensity prop to GlassView's style prop
  // 'clear' for light, 'regular' for medium/heavy
  const glassEffectStyle = intensity === "light" ? "clear" : "regular";

  // Use GlassView only if available AND animation is complete (or not animated)
  // This prevents opacity < 1 on GlassView which causes rendering issues
  const shouldUseGlassView = isAvailable && isAnimationComplete;

  // For GlassView, we can't use opacity < 1, so only animate scale
  // Never apply opacity to GlassView or its parent (per Expo docs)
  const glassAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Fallback for other platforms or during animation
  const fallbackAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  if (shouldUseGlassView) {
    return (
      <Animated.View style={glassAnimatedStyle}>
        <GlassView
          glassEffectStyle={glassEffectStyle}
          style={[styles.glassContainer, style]}
          isInteractive={false}
        >
          {children}
        </GlassView>
      </Animated.View>
    );
  }

  const fallbackBackgroundColor = theme.isDark
    ? "rgba(255, 255, 255, 0.05)"
    : "rgba(0, 0, 0, 0.03)";

  return (
    <Animated.View
      style={[
        fallbackAnimatedStyle,
        styles.fallbackContainer,
        { backgroundColor: fallbackBackgroundColor },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    overflow: "hidden",
  },
  fallbackContainer: {
    overflow: "hidden",
  },
});
