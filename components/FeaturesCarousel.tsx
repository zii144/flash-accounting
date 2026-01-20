import { UpcomingFeaturesBanner } from "@/components/UpcomingFeaturesBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef } from "react";
import {
  Dimensions,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface FeatureItem {
  titleKey: string;
  messageKey: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface FeaturesCarouselProps {
  /** Array of feature items to display */
  items: FeatureItem[];
  /** Whether the carousel is visible */
  visible?: boolean;
  /** Callback when carousel is dismissed */
  onDismiss?: () => void;
  /** Callback when a specific item is dismissed */
  onItemDismiss?: (index: number) => void;
  /** Auto-dismiss after milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number;
}

export function FeaturesCarousel({
  items,
  visible = true,
  onDismiss,
  onItemDismiss,
  autoDismissMs = 0,
}: FeaturesCarouselProps) {
  const { theme } = useTheme();
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleItemDismiss = useCallback(
    (index: number) => {
      onItemDismiss?.(index);
      // If all items are dismissed, dismiss the carousel
      // This would need to be managed by parent component
    },
    [onItemDismiss]
  );

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDismiss?.();
  }, [onDismiss]);

  // Auto-dismiss logic
  React.useEffect(() => {
    if (autoDismissMs > 0 && visible) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, visible, handleClose]);

  if (!visible || items.length === 0) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.overlay, { backgroundColor: theme.background }]}
      >
        {/* Carousel */}
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="center"
          contentContainerStyle={styles.scrollContent}
        >
          {items.map((item, index) => (
            <CarouselItem
              key={index}
              item={item}
              index={index}
              scrollX={scrollX}
              isLast={index === items.length - 1}
              onDismiss={() => handleItemDismiss(index)}
              onDontShowAgain={handleClose}
            />
          ))}
        </Animated.ScrollView>

        {/* Pagination Indicators */}
        <View style={styles.pagination}>
          {items.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              scrollX={scrollX}
              theme={theme}
            />
          ))}
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

interface CarouselItemProps {
  item: FeatureItem;
  index: number;
  scrollX: SharedValue<number>;
  isLast: boolean;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

function CarouselItem({
  item,
  index,
  scrollX,
  isLast,
  onDismiss,
  onDontShowAgain,
}: CarouselItemProps) {
  const { t } = useLanguage();
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.itemContainer, animatedStyle]}>
      <View style={styles.bannerWrapper}>
        <UpcomingFeaturesBanner
          title={t(item.titleKey)}
          message={t(item.messageKey)}
          icon={item.icon}
          position="top"
          relative={true}
          showDontShowAgain={isLast}
          onDontShowAgain={onDontShowAgain}
          style={styles.banner}
        />
      </View>
    </Animated.View>
  );
}

interface PaginationDotProps {
  index: number;
  scrollX: SharedValue<number>;
  theme: any;
}

function PaginationDot({ index, scrollX, theme }: PaginationDotProps) {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [1, 1.5, 1],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: theme.text },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  scrollContent: {
    alignItems: "center",
  },
  itemContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  bannerWrapper: {
    width: "100%",
    maxWidth: SCREEN_WIDTH - 40,
  },
  banner: {
    position: "relative",
  },
  pagination: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
