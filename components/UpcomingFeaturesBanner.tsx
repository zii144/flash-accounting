import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import Animated, {
    SlideInDown,
    SlideInUp,
    SlideOutDown,
    SlideOutUp,
} from "react-native-reanimated";

export interface UpcomingFeaturesBannerProps {
  /** Title text displayed prominently */
  title: string;
  /** Description or message text */
  message: string;
  /** Custom icon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Position of the banner */
  position?: "top" | "bottom";
  /** Auto-dismiss after milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Whether banner is visible */
  visible?: boolean;
  /** Use relative positioning instead of absolute (for carousel usage) */
  relative?: boolean;
  /** Show "Don't Show Again" button */
  showDontShowAgain?: boolean;
  /** Callback when "Don't Show Again" is pressed */
  onDontShowAgain?: () => void;
}

export function UpcomingFeaturesBanner({
  title,
  message,
  icon = "sparkles-outline",
  position = "top",
  autoDismissMs = 0,
  style,
  visible = true,
  relative = false,
  showDontShowAgain = false,
  onDontShowAgain,
}: UpcomingFeaturesBannerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (autoDismissMs > 0 && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, isVisible]);

  if (!isVisible) {
    return null;
  }

  const slideAnimation =
    position === "top"
      ? { entering: SlideInUp, exiting: SlideOutUp }
      : { entering: SlideInDown, exiting: SlideOutDown };

  return (
    <Animated.View
      entering={slideAnimation.entering.duration(300).springify()}
      exiting={slideAnimation.exiting.duration(200)}
      style={[
        relative ? styles.relativeContainer : styles.container,
        !relative && (position === "top" ? styles.topContainer : styles.bottomContainer),
        style,
      ]}
    >
      <GlassContainer intensity="medium" style={styles.glassWrapper}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={24} color={theme.text} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.comingSoonBadge,
                  {
                    backgroundColor: theme.isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.comingSoonText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t("comingSoon")}
                </Text>
              </View>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </Text>
          </View>
        </View>

        {showDontShowAgain && (
          <TouchableOpacity
            style={[
              styles.dontShowAgainButton,
              {
                borderColor: theme.border,
                backgroundColor: theme.isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.03)",
              },
            ]}
            onPress={onDontShowAgain}
          >
            <Text style={[styles.dontShowAgainText, { color: theme.text }]}>
              {t("dontShowAgain")}
            </Text>
          </TouchableOpacity>
        )}
      </GlassContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  relativeContainer: {
    width: "100%",
    paddingHorizontal: 16,
  },
  topContainer: {
    top: 0,
    paddingTop: 16,
  },
  bottomContainer: {
    bottom: 0,
    paddingBottom: 16,
  },
  glassWrapper: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconContainer: {
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  comingSoonBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  dontShowAgainButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  dontShowAgainText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
