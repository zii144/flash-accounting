import { GlassContainer } from "@/components/GlassContainer";
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
  const scale = useSharedValue(1);
  const radius = size / 2;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <GlassContainer
        interactive
        intensity="medium"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: "continuous",
        }}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            if (process.env.EXPO_OS === "ios") {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onPress?.();
          }}
          onPressIn={() => {
            scale.value = withSpring(0.92, { damping: 18, stiffness: 320 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 16, stiffness: 260 });
          }}
          style={styles.pressable}
        >
          {children}
        </AnimatedPressable>
      </GlassContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
