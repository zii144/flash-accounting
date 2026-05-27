import { GlassContainer, type GlassIntensity } from "@/components/GlassContainer";
import React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const BUTTON_RADIUS = 14;

type GlassButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: GlassIntensity;
  accessibilityLabel?: string;
};

export function GlassButton({
  onPress,
  disabled = false,
  children,
  style,
  contentStyle,
  intensity = "medium",
  accessibilityLabel,
}: GlassButtonProps) {
  const handlePress = () => {
    if (disabled || !onPress) {
      return;
    }

    onPress();
  };

  return (
    <GlassContainer
      intensity={disabled ? "light" : intensity}
      interactive={!disabled}
      style={[styles.glass, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.pressable,
          contentStyle,
          !disabled && pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.82,
  },
});
