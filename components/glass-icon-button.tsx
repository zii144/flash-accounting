import { GlassContainer } from "@/components/GlassContainer";
import React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type GlassIconButtonProps = {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function GlassIconButton({
  onPress,
  children,
  size = 40,
  style,
  accessibilityLabel,
}: GlassIconButtonProps) {
  const radius = size / 2;

  return (
    <GlassContainer
      interactive
      intensity="medium"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: "continuous",
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          onPress?.();
        }}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.72,
  },
});
