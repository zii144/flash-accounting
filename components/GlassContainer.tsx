import { useTheme } from "@/contexts/ThemeContext";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export type GlassIntensity = "clear" | "light" | "medium" | "heavy";

interface GlassContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
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

function resolveBorderRadius(style?: ViewStyle) {
  return typeof style?.borderRadius === "number" ? style.borderRadius : 16;
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
  const clipStyle = {
    borderRadius,
    borderCurve: "continuous" as const,
    overflow: "hidden" as const,
  };
  const shellStyle = [clipStyle, style];

  const shouldUseGlassView = glassAvailable && isAnimationComplete;

  if (shouldUseGlassView) {
    return (
      <Animated.View style={animated ? animatedStyle : undefined}>
        <View style={clipStyle} collapsable={false}>
          <GlassView
            glassEffectStyle={getGlassEffectStyle(intensity)}
            isInteractive={interactive}
            colorScheme={theme.isDark ? "dark" : "light"}
            style={shellStyle}
          >
            {children}
          </GlassView>
        </View>
      </Animated.View>
    );
  }

  if (process.env.EXPO_OS === "ios" || process.env.EXPO_OS === "web") {
    return (
      <Animated.View style={animated ? animatedStyle : undefined}>
        <View style={[shellStyle, styles.blurShell]} collapsable={false}>
          <BlurView
            tint={getBlurTint(intensity)}
            intensity={getBlurIntensity(intensity)}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
          />
          <View style={styles.blurContent}>{children}</View>
        </View>
      </Animated.View>
    );
  }

  const fallbackBackgroundColor = theme.isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(255, 255, 255, 0.72)";

  return (
    <Animated.View style={animated ? animatedStyle : undefined}>
      <View
        style={[
          shellStyle,
          styles.fallbackShell,
          {
            backgroundColor: fallbackBackgroundColor,
            borderColor: theme.isDark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.06)",
          },
        ]}
        collapsable={false}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blurShell: {
    position: "relative",
  },
  blurContent: {
    position: "relative",
    zIndex: 1,
  },
  fallbackShell: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
