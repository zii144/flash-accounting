import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export type GlassIntensity = "clear" | "light" | "medium" | "heavy";

interface GlassContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: GlassIntensity;
  interactive?: boolean;
  animated?: boolean;
}

function getGlassEffectStyle(intensity: GlassIntensity) {
  return intensity === "clear" || intensity === "light" ? "clear" : "regular";
}

function getBlurTint(intensity: GlassIntensity) {
  switch (intensity) {
    case "clear":
    case "light":
      return "systemUltraThinMaterial" as const;
    case "heavy":
      return "systemThickMaterial" as const;
    default:
      return "systemMaterial" as const;
  }
}

function getBlurIntensity(intensity: GlassIntensity) {
  switch (intensity) {
    case "clear":
      return 35;
    case "light":
      return 45;
    case "heavy":
      return 90;
    default:
      return 70;
  }
}

function getUnderlayColor(theme: Theme, intensity: GlassIntensity) {
  if (theme.isDark) {
    switch (intensity) {
      case "clear":
        return "rgba(28, 28, 30, 0.58)";
      case "light":
        return "rgba(28, 28, 30, 0.72)";
      case "heavy":
        return "rgba(28, 28, 30, 0.94)";
      default:
        return "rgba(28, 28, 30, 0.84)";
    }
  }

  switch (intensity) {
    case "clear":
      return "rgba(255, 255, 255, 0.58)";
    case "light":
      return "rgba(255, 255, 255, 0.74)";
    case "heavy":
      return "rgba(255, 255, 255, 0.96)";
    default:
      return "rgba(255, 255, 255, 0.88)";
  }
}

function isNativeGlassAvailable() {
  if (process.env.EXPO_OS !== "ios") {
    return false;
  }

  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

function resolveBorderRadius(style?: StyleProp<ViewStyle>) {
  const flatStyle = StyleSheet.flatten(style);
  return typeof flatStyle?.borderRadius === "number" ? flatStyle.borderRadius : 16;
}

export function GlassContainer({
  children,
  style,
  intensity = "medium",
  interactive = false,
  animated = false,
}: GlassContainerProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(animated ? 0.98 : 1);
  const [isAnimationComplete, setIsAnimationComplete] = React.useState(!animated);
  const glassAvailable = React.useMemo(() => isNativeGlassAvailable(), []);

  React.useEffect(() => {
    if (!animated) {
      return;
    }

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
  }, [animated, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderRadius = resolveBorderRadius(style);
  const underlayColor = getUnderlayColor(theme, intensity);
  const borderColor = theme.isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.08)";
  const shellStyle = [
    styles.shell,
    {
      borderRadius,
      borderCurve: "continuous" as const,
      overflow: "hidden" as const,
      borderColor,
    },
    !theme.isDark ? styles.lightFallbackShadow : null,
    style,
  ];

  const shouldUseGlassView = glassAvailable && isAnimationComplete;
  const shouldUseBlur =
    !shouldUseGlassView &&
    (process.env.EXPO_OS === "ios" || process.env.EXPO_OS === "web");

  const shell = (
    <View style={shellStyle} collapsable={false} needsOffscreenAlphaCompositing>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius, backgroundColor: underlayColor },
        ]}
      />
      {shouldUseGlassView ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle={getGlassEffectStyle(intensity)}
          isInteractive={interactive}
          colorScheme={theme.isDark ? "dark" : "light"}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : null}
      {shouldUseBlur ? (
        <BlurView
          pointerEvents="none"
          tint={getBlurTint(intensity)}
          intensity={getBlurIntensity(intensity)}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : null}
      {children}
    </View>
  );

  if (animated) {
    return <Animated.View style={animatedStyle}>{shell}</Animated.View>;
  }

  return shell;
}

const styles = StyleSheet.create({
  shell: {
    position: "relative",
    borderWidth: StyleSheet.hairlineWidth,
  },
  lightFallbackShadow: {
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  },
});
