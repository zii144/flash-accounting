import { useTheme } from "@/contexts/ThemeContext";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import React from "react";
import { Platform, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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
  const opacity = useSharedValue(animated ? 0 : 1);

  React.useEffect(() => {
    if (animated) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [animated, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  // On iOS 26+, use native Liquid Glass effect
  // On other platforms, fallback to semi-transparent background
  const [isAvailable, setIsAvailable] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === "ios") {
      try {
        setIsAvailable(isLiquidGlassAvailable());
      } catch {
        setIsAvailable(false);
      }
    }
  }, []);

  if (isAvailable) {
    // Map our intensity prop to GlassView's style prop
    // 'clear' for light, 'regular' for medium/heavy
    const glassEffectStyle = intensity === "light" ? "clear" : "regular";

    return (
      <Animated.View style={animatedStyle}>
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

  // Fallback for other platforms
  const fallbackBackgroundColor = theme.isDark
    ? "rgba(255, 255, 255, 0.05)"
    : "rgba(0, 0, 0, 0.03)";

  return (
    <Animated.View
      style={[
        animatedStyle,
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
