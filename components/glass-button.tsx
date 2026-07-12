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
  testID?: string;
};

export function GlassButton({
  onPress,
  disabled = false,
  children,
  style,
  contentStyle,
  intensity = "medium",
  accessibilityLabel,
  testID,
}: GlassButtonProps) {
  const handlePress = () => {
    if (disabled || !onPress) {
      return;
    }

    onPress();
  };

  return (
    <GlassContainer
      intensity={intensity}
      interactive
      style={[styles.glass, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.pressable,
          contentStyle,
          disabled && styles.disabledContent,
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
    height: 52,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  pressed: {
    opacity: 0.82,
  },
  disabledContent: {
    opacity: 0.45,
  },
});
