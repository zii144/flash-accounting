import { GlassContainer } from "@/components/GlassContainer";
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

export type BannerVariant = "info" | "warning" | "success" | "feature";

export interface UpcomingFeaturesBannerProps {
  /** Title text displayed prominently */
  title: string;
  /** Description or message text */
  message: string;
  /** Visual variant that affects icon and colors */
  variant?: BannerVariant;
  /** Custom icon name (overrides variant default icon) */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Position of the banner */
  position?: "top" | "bottom";
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number;
  /** Custom action button text */
  actionText?: string;
  /** Callback when action button is pressed */
  onAction?: () => void;
  /** Custom container style */
  style?: ViewStyle;
  /** Whether banner is visible */
  visible?: boolean;
  /** Use relative positioning instead of absolute (for carousel usage) */
  relative?: boolean;
}

const variantConfig: Record<
  BannerVariant,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  info: { icon: "information-circle-outline", color: "#007AFF" },
  warning: { icon: "warning-outline", color: "#FF9500" },
  success: { icon: "checkmark-circle-outline", color: "#34C759" },
  feature: { icon: "sparkles-outline", color: "#AF52DE" },
};

export function UpcomingFeaturesBanner({
  title,
  message,
  variant = "feature",
  icon,
  position = "top",
  dismissible = true,
  onDismiss,
  autoDismissMs = 0,
  actionText,
  onAction,
  style,
  visible = true,
  relative = false,
}: UpcomingFeaturesBannerProps) {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(visible);
  const config = variantConfig[variant];
  const displayIcon = icon || config.icon;
  const iconColor = config.color;

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (autoDismissMs > 0 && isVisible) {
      const timer = setTimeout(() => {
        if (dismissible) {
          setIsVisible(false);
          onDismiss?.();
        }
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, isVisible, dismissible, onDismiss]);

  const handleDismiss = () => {
    if (dismissible) {
      setIsVisible(false);
      onDismiss?.();
    }
  };

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
            <Ionicons name={displayIcon} size={24} color={iconColor} />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </Text>
          </View>

          {dismissible && (
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {(actionText || onAction) && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: iconColor + "20", borderColor: iconColor },
            ]}
            onPress={onAction}
          >
            <Text style={[styles.actionText, { color: iconColor }]}>
              {actionText || "Learn More"}
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
  closeButton: {
    padding: 4,
    marginTop: -4,
    marginRight: -4,
  },
  actionButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
