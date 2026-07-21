import { Text } from "@/components/text";
import { useTheme } from "@/contexts/ThemeContext";
import { spacing, type FontWeightToken } from "@/theme/tokens";
import type { ReactNode } from "react";
import {
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

/**
 * The standard route shell. Owns the safe-area frame, background, status-bar style, and
 * the shared header pattern (screen title + trailing action + optional subtitle line) so
 * every route is consistent by construction. New screens compose `<Screen>` rather than
 * hand-building a SafeAreaView + header. See docs/design-system/03-spacing-layout.md.
 *
 *   <Screen
 *     title={t("flashAccounting")}
 *     headerRight={<GlassIconButton …/>}
 *     headerSubtitle={<Text …>Total: …</Text>}
 *   >
 *     …body…
 *   </Screen>
 */
type ScreenProps = {
  children: ReactNode;
  /** SafeAreaView edges to inset. Default `["top"]`. */
  edges?: readonly Edge[];
  /** Screen title (rendered as the `title` variant). Omit for a header-less screen. */
  title?: string;
  /**
   * Weight override for the title. Canonical `title` is heavy (800); pass `"bold"` to keep
   * a screen's current 700 while its drift decision is open (see the typography drift ledger).
   */
  titleWeight?: FontWeightToken;
  /** Trailing header content — typically a `GlassIconButton` (or a row of them). */
  headerRight?: ReactNode;
  /** Secondary line under the title row — e.g. a total. Caller supplies a themed `<Text>`. */
  headerSubtitle?: ReactNode;
  /** Add screen horizontal padding to the body. Default false (body controls its own layout). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  edges = ["top"],
  title,
  titleWeight,
  headerRight,
  headerSubtitle,
  padded = false,
  style,
}: ScreenProps) {
  const { theme } = useTheme();
  const hasTopRow = title != null || headerRight != null;
  const hasHeader = hasTopRow || headerSubtitle != null;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: theme.background }, style]}
    >
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />

      {hasHeader ? (
        <View style={styles.header}>
          {hasTopRow ? (
            <View style={styles.headerTop}>
              {title != null ? (
                <Text variant="title" weight={titleWeight} style={styles.title}>
                  {title}
                </Text>
              ) : (
                <View style={styles.title} />
              )}
              {headerRight}
            </View>
          ) : null}
          {headerSubtitle}
        </View>
      ) : null}

      <View style={[styles.body, padded && styles.bodyPadded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header rhythm is defined once, here — the canonical source, not duplicated per screen.
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: "flex-start",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.tight,
  },
  title: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyPadded: {
    paddingHorizontal: spacing.screenX,
  },
});
