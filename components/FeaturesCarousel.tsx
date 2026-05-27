import { UpcomingFeaturesBanner } from "@/components/UpcomingFeaturesBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { AppIconName } from "@/utils/app-icons";
import React, { useCallback, useRef } from "react";
import {
  StyleSheet,
  useWindowDimensions,
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

export interface FeatureItem {
  titleKey: string;
  messageKey: string;
  icon?: AppIconName;
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
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
          snapToInterval={screenWidth}
          snapToAlignment="center"
          contentContainerStyle={styles.scrollContent}
        >
          {items.map((item, index) => (
            <CarouselItem
              key={index}
              item={item}
              index={index}
              scrollX={scrollX}
              screenWidth={screenWidth}
              screenHeight={screenHeight}
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
              screenWidth={screenWidth}
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
  screenWidth: number;
  screenHeight: number;
  isLast: boolean;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

function CarouselItem({
  item,
  index,
  scrollX,
  screenWidth,
  screenHeight,
  isLast,
  onDismiss,
  onDontShowAgain,
}: CarouselItemProps) {
  const { t } = useLanguage();
  const inputRange = [
    (index - 1) * screenWidth,
    index * screenWidth,
    (index + 1) * screenWidth,
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
    <Animated.View
      style={[
        styles.itemContainer,
        { width: screenWidth, height: screenHeight },
        animatedStyle,
      ]}
    >
      <View style={[styles.bannerWrapper, { maxWidth: screenWidth - 40 }]}>
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
  screenWidth: number;
  theme: any;
}

function PaginationDot({ index, scrollX, screenWidth, theme }: PaginationDotProps) {
  const inputRange = [
    (index - 1) * screenWidth,
    index * screenWidth,
    (index + 1) * screenWidth,
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
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  scrollContent: {
    alignItems: "center",
  },
  itemContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  bannerWrapper: {
    width: "100%",
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
