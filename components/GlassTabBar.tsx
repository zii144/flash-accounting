import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ANIMATION_CONFIG } from "@/utils/constants";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface GlassTabBarProps {
  activeTab: "accounting" | "statistics";
  onTabChange: (tab: "accounting" | "statistics") => void;
}

export function GlassTabBar({ activeTab, onTabChange }: GlassTabBarProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const accountingProgress = useSharedValue(activeTab === "accounting" ? 1 : 0);
  const statisticsProgress = useSharedValue(activeTab === "statistics" ? 1 : 0);

  React.useEffect(() => {
    if (activeTab === "accounting") {
      accountingProgress.value = withSpring(1, {
        damping: ANIMATION_CONFIG.SPRING_DAMPING,
        stiffness: ANIMATION_CONFIG.SPRING_STIFFNESS,
      });
      statisticsProgress.value = withSpring(0, {
        damping: ANIMATION_CONFIG.SPRING_DAMPING,
        stiffness: ANIMATION_CONFIG.SPRING_STIFFNESS,
      });
    } else {
      accountingProgress.value = withSpring(0, {
        damping: ANIMATION_CONFIG.SPRING_DAMPING,
        stiffness: ANIMATION_CONFIG.SPRING_STIFFNESS,
      });
      statisticsProgress.value = withSpring(1, {
        damping: ANIMATION_CONFIG.SPRING_DAMPING,
        stiffness: ANIMATION_CONFIG.SPRING_STIFFNESS,
      });
    }
  }, [activeTab, accountingProgress, statisticsProgress]);

  const handlePress = useCallback(
    (tab: "accounting" | "statistics") => {
      if (activeTab !== tab) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTabChange(tab);
      }
    },
    [activeTab, onTabChange],
  );

  const accountingStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      accountingProgress.value,
      [0, 1],
      [1, 1.02],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ scale }],
    };
  });

  const statisticsStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      statisticsProgress.value,
      [0, 1],
      [1, 1.02],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ scale }],
    };
  });

  const accountingSegmentStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: accountingProgress.value * (theme.isDark ? 0.3 : 0.15),
      elevation: accountingProgress.value * 2,
      shadowColor: theme.isDark ? theme.foreground : "#000",
    };
  });

  const statisticsSegmentStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: statisticsProgress.value * (theme.isDark ? 0.3 : 0.15),
      elevation: statisticsProgress.value * 2,
      shadowColor: theme.isDark ? theme.foreground : "#000",
    };
  });

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom - 12, 8),
          paddingHorizontal: 16,
        },
      ]}
      pointerEvents="box-none"
    >
      <GlassContainer intensity="medium" style={styles.tabBar}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.segment}
            onPress={() => handlePress("accounting")}
            activeOpacity={0.9}
          >
            <Animated.View
              style={[
                styles.segmentContent,
                {
                  backgroundColor:
                    activeTab === "accounting"
                      ? theme.isDark
                        ? "rgba(255, 255, 255, 0.15)"
                        : "rgba(255, 255, 255, 0.9)"
                      : "transparent",
                },
                accountingSegmentStyle,
                accountingStyle,
              ]}
            >
              <Animated.View style={accountingStyle}>
                <Ionicons
                  name="calculator-outline"
                  size={24}
                  color={
                    activeTab === "accounting"
                      ? theme.text
                      : theme.textSecondary
                  }
                />
              </Animated.View>
              <Animated.Text
                style={[
                  styles.segmentLabel,
                  {
                    color:
                      activeTab === "accounting"
                        ? theme.text
                        : theme.textSecondary,
                    fontWeight: activeTab === "accounting" ? "700" : "500",
                  },
                ]}
              >
                {t("accounting")}
              </Animated.Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.segment}
            onPress={() => handlePress("statistics")}
            activeOpacity={0.9}
          >
            <Animated.View
              style={[
                styles.segmentContent,
                {
                  backgroundColor:
                    activeTab === "statistics"
                      ? theme.isDark
                        ? "rgba(255, 255, 255, 0.15)"
                        : "rgba(255, 255, 255, 0.9)"
                      : "transparent",
                },
                statisticsSegmentStyle,
                statisticsStyle,
              ]}
            >
              <Animated.View style={statisticsStyle}>
                <Ionicons
                  name="stats-chart-outline"
                  size={24}
                  color={
                    activeTab === "statistics"
                      ? theme.text
                      : theme.textSecondary
                  }
                />
              </Animated.View>
              <Animated.Text
                style={[
                  styles.segmentLabel,
                  {
                    color:
                      activeTab === "statistics"
                        ? theme.text
                        : theme.textSecondary,
                    fontWeight: activeTab === "statistics" ? "700" : "500",
                  },
                ]}
              >
                {t("statistics")}
              </Animated.Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </GlassContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  tabBar: {
    borderRadius: 28,
    padding: 6,
    minWidth: 300,
  },
  tabContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
  },
  segment: {
    flex: 1,
    minHeight: 52,
  },
  segmentContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 22,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowRadius: 6,
  },
  segmentLabel: {
    fontSize: 16,
  },
});
