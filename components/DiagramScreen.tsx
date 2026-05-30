import { GlassContainer } from "@/components/GlassContainer";
import { GlassIconButton } from "@/components/glass-icon-button";
import { SymbolIcon } from "@/components/symbol-icon";
import { useGlossary } from "@/contexts/GlossaryContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStats } from "@/hooks/useConsumptionStats";
import type { Consumption } from "@/types/consumption";
import type { TimeFilter } from "@/utils/constants";
import { TIME_FILTERS } from "@/utils/constants";
import {
  buildCategoryBreakdown,
  buildDiagramSummary,
  buildTrendSeries,
  type CategoryDatum,
  type TrendDatum,
} from "@/utils/diagram-data";
import { formatCurrency } from "@/utils/formatting";
import { logger } from "@/utils/logger";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

type DiagramMode = "pie" | "treemap" | "bar" | "line";

const MONO_PALETTE = [
  "#000000",
  "#2C2C2E",
  "#48484A",
  "#636366",
  "#8E8E93",
  "#AEAEB2",
  "#C7C7CC",
  "#D1D1D6",
];

const DARK_MONO_PALETTE = [
  "#FFFFFF",
  "#E5E5EA",
  "#D1D1D6",
  "#AEAEB2",
  "#8E8E93",
  "#636366",
  "#48484A",
  "#3A3A3C",
];

function polarToCartesian(center: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(angleInRadians),
    y: center + radius * Math.sin(angleInRadians),
  };
}

function describeDonutArc(
  center: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(center, radius, endAngle);
  const outerEnd = polarToCartesian(center, radius, startAngle);
  const innerStart = polarToCartesian(center, innerRadius, startAngle);
  const innerEnd = polarToCartesian(center, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    outerStart.x,
    outerStart.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    outerEnd.x,
    outerEnd.y,
    "L",
    innerStart.x,
    innerStart.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    innerEnd.x,
    innerEnd.y,
    "Z",
  ].join(" ");
}

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();

  return (
    <GlassContainer intensity="light" style={styles.segmentControl}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentButton,
              selected && { backgroundColor: theme.foreground },
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[
                styles.segmentText,
                { color: selected ? theme.background : theme.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassContainer>
  );
}

function PieDiagram({ data, size }: { data: CategoryDatum[]; size: number }) {
  const { theme } = useTheme();
  const palette = theme.isDark ? DARK_MONO_PALETTE : MONO_PALETTE;
  const center = size / 2;
  const radius = size / 2 - 6;
  const innerRadius = radius * 0.56;
  const segments = data.reduce<{ datum: CategoryDatum; start: number; end: number }[]>(
    (acc, datum) => {
      const start = acc[acc.length - 1]?.end ?? 0;
      const end = start + Math.max(1.8, datum.percentage * 360);
      return [...acc, { datum, start, end }];
    },
    [],
  );

  if (data.length === 0) {
    return (
      <View style={[styles.emptyDiagram, { width: size, height: size }]}>
        <Text style={[styles.emptyDiagramText, { color: theme.textSecondary }]}>0</Text>
      </View>
    );
  }

  return (
    <Svg width={size} height={size}>
      <G>
        {segments.map((segment, index) => {
          return (
            <Path
              key={segment.datum.label}
              d={describeDonutArc(center, radius, innerRadius, segment.start, segment.end - 1.2)}
              fill={palette[index % palette.length]}
            />
          );
        })}
      </G>
      <Circle cx={center} cy={center} r={innerRadius - 2} fill={theme.background} />
      <SvgText
        x={center}
        y={center - 2}
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill={theme.text}
      >
        {data.length}
      </SvgText>
      <SvgText
        x={center}
        y={center + 17}
        textAnchor="middle"
        fontSize="11"
        fill={theme.textSecondary}
      >
        groups
      </SvgText>
    </Svg>
  );
}

function TreemapDiagram({
  data,
  width,
  height,
}: {
  data: CategoryDatum[];
  width: number;
  height: number;
}) {
  const { theme } = useTheme();
  const palette = theme.isDark ? DARK_MONO_PALETTE : MONO_PALETTE;
  const visibleData = data.slice(0, 9);
  const total = visibleData.reduce((sum, datum) => sum + datum.amount, 0);
  const rects = visibleData.reduce<
    {
      x: number;
      y: number;
      width: number;
      height: number;
      datum: CategoryDatum;
      remaining: { x: number; y: number; width: number; height: number };
    }[]
  >((acc, datum, index) => {
    const previous = acc[acc.length - 1]?.remaining ?? { x: 0, y: 0, width, height };
    const remainingTotal = visibleData.slice(index).reduce((sum, item) => sum + item.amount, 0);
    const share = remainingTotal > 0 ? datum.amount / remainingTotal : 0;
    const horizontal = previous.width >= previous.height;
    const rect = horizontal
      ? {
          x: previous.x,
          y: previous.y,
          width: index === visibleData.length - 1 ? previous.width : previous.width * share,
          height: previous.height,
        }
      : {
          x: previous.x,
          y: previous.y,
          width: previous.width,
          height: index === visibleData.length - 1 ? previous.height : previous.height * share,
        };
    const remaining = horizontal
      ? {
          x: previous.x + rect.width,
          y: previous.y,
          width: previous.width - rect.width,
          height: previous.height,
        }
      : {
          x: previous.x,
          y: previous.y + rect.height,
          width: previous.width,
          height: previous.height - rect.height,
        };

    return [...acc, { ...rect, datum, remaining }];
  }, []);

  if (total <= 0) {
    return (
      <View style={[styles.treemap, { height }]}>
        <Text style={[styles.emptyDiagramText, { color: theme.textSecondary }]}>No data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.treemap, { height }]}>
      {rects.map((rect, index) => (
        <View
          key={rect.datum.label}
          style={[
            styles.treemapTile,
            {
              left: rect.x,
              top: rect.y,
              width: Math.max(0, rect.width - 4),
              height: Math.max(0, rect.height - 4),
              backgroundColor: palette[index % palette.length],
            },
          ]}
        >
          {rect.width > 78 && rect.height > 48 ? (
            <>
              <Text
                numberOfLines={1}
                style={[
                  styles.treemapLabel,
                  { color: index < 5 || theme.isDark ? theme.background : theme.text },
                ]}
              >
                {rect.datum.label}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.treemapValue,
                  { color: index < 5 || theme.isDark ? theme.background : theme.text },
                ]}
              >
                {Math.round(rect.datum.percentage * 100)}%
              </Text>
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function BarDiagram({ data, width, height }: { data: TrendDatum[]; width: number; height: number }) {
  const { theme } = useTheme();
  const chartWidth = width - 28;
  const chartHeight = height - 34;
  const maxValue = Math.max(1, ...data.map((datum) => Math.max(datum.expense, datum.income)));
  const groupWidth = data.length > 0 ? chartWidth / data.length : chartWidth;
  const barWidth = Math.max(4, Math.min(14, groupWidth / 3));

  return (
    <Svg width={width} height={height}>
      <Line x1={16} y1={chartHeight} x2={width - 8} y2={chartHeight} stroke={theme.border} />
      {data.map((datum, index) => {
        const centerX = 18 + index * groupWidth + groupWidth / 2;
        const expenseHeight = (datum.expense / maxValue) * (chartHeight - 14);
        const incomeHeight = (datum.income / maxValue) * (chartHeight - 14);
        return (
          <G key={datum.key}>
            <Rect
              x={centerX - barWidth - 2}
              y={chartHeight - expenseHeight}
              width={barWidth}
              height={expenseHeight}
              rx={3}
              fill={theme.text}
            />
            <Rect
              x={centerX + 2}
              y={chartHeight - incomeHeight}
              width={barWidth}
              height={incomeHeight}
              rx={3}
              fill={theme.textSecondary}
            />
            {index % Math.ceil(data.length / 5 || 1) === 0 ? (
              <SvgText
                x={centerX}
                y={height - 8}
                fontSize="10"
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                {datum.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

function LineDiagram({ data, width, height }: { data: TrendDatum[]; width: number; height: number }) {
  const { theme } = useTheme();
  const chartWidth = width - 28;
  const chartHeight = height - 34;
  const maxValue = Math.max(1, ...data.map((datum) => datum.expense));
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const points = data.map((datum, index) => ({
    x: 14 + index * step,
    y: chartHeight - (datum.expense / maxValue) * (chartHeight - 16),
    datum,
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <Svg width={width} height={height}>
      <Line x1={14} y1={chartHeight} x2={width - 8} y2={chartHeight} stroke={theme.border} />
      <Path d={path} fill="none" stroke={theme.text} strokeWidth={3} strokeLinecap="round" />
      {points.map((point, index) => (
        <G key={point.datum.key}>
          <Circle cx={point.x} cy={point.y} r={4} fill={theme.background} stroke={theme.text} strokeWidth={2} />
          {index % Math.ceil(points.length / 5 || 1) === 0 ? (
            <SvgText
              x={point.x}
              y={height - 8}
              fontSize="10"
              fill={theme.textSecondary}
              textAnchor="middle"
            >
              {point.datum.label}
            </SvgText>
          ) : null}
        </G>
      ))}
    </Svg>
  );
}

export function DiagramScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { canonicalizeLabel, isReady } = useGlossary();
  const { getFilteredConsumptions } = useConsumptionStats();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const [mode, setMode] = useState<DiagramMode>("pie");
  const [records, setRecords] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const contentWidth = Math.max(280, width - 32);
  const pieSize = Math.min(260, contentWidth * 0.78);
  const trendHeight = Math.max(220, Math.min(300, contentWidth * 0.7));
  const trendData = useMemo(() => buildTrendSeries(records, timeFilter), [records, timeFilter]);

  const categoryData = isReady ? buildCategoryBreakdown(records, canonicalizeLabel) : [];
  const summary = isReady
    ? buildDiagramSummary(records, canonicalizeLabel)
    : {
          expenseTotal: 0,
          incomeTotal: 0,
          netTotal: 0,
          topCategory: null,
          averageExpense: 0,
        };

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFilteredConsumptions(timeFilter, "date", "ASC");
      setRecords(data);
    } catch (error) {
      logger.error("Failed to load diagram data", error, { timeFilter });
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [getFilteredConsumptions, timeFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadRecords();
    }, [loadRecords]),
  );

  const handleSettingsPress = useCallback(() => {
    router.push("/settings");
  }, []);

  const modeOptions = useMemo(
    () => [
      { value: "pie" as const, label: t("pie") },
      { value: "treemap" as const, label: t("treemap") },
      { value: "bar" as const, label: t("bar") },
      { value: "line" as const, label: t("line") },
    ],
    [t],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>{t("diagram")}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {mode === "pie" || mode === "treemap" ? t("moneyFlowQuestion") : t("timeQuestion")}
          </Text>
        </View>
        <GlassIconButton
          size={40}
          onPress={handleSettingsPress}
          accessibilityLabel={t("settings")}
        >
          <SymbolIcon name="settings" size={20} color={theme.text} />
        </GlassIconButton>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SegmentControl options={modeOptions} value={mode} onChange={setMode} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TIME_FILTERS.map((filter) => {
            const selected = filter === timeFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => setTimeFilter(filter)}
                style={[
                  styles.filterChip,
                  { borderColor: theme.border },
                  selected && { backgroundColor: theme.foreground },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: selected ? theme.background : theme.text },
                  ]}
                >
                  {t(filter)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Animated.View entering={FadeIn.duration(260)}>
          <GlassContainer intensity="light" style={styles.chartPanel}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={[styles.chartTitle, { color: theme.text }]}>
                  {mode === "pie"
                    ? t("spendingPie")
                    : mode === "treemap"
                      ? t("spendingTreemap")
                      : mode === "bar"
                        ? t("periodCompare")
                        : t("spendingTrend")}
                </Text>
                <Text style={[styles.chartCaption, { color: theme.textSecondary }]}>
                  {isLoading ? t("loading") : `${records.length} ${t("items")}`}
                </Text>
              </View>
              <Text
                selectable
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.chartAmount, { color: theme.text }]}
              >
                ${formatCurrency(summary.expenseTotal, 0)}
              </Text>
            </View>

            <View style={styles.diagramStage}>
              {mode === "pie" ? (
                <PieDiagram data={categoryData} size={pieSize} />
              ) : mode === "treemap" ? (
                <TreemapDiagram
                  data={categoryData}
                  width={contentWidth - 36}
                  height={Math.max(260, Math.min(420, width * 0.88))}
                />
              ) : mode === "bar" ? (
                <BarDiagram data={trendData} width={contentWidth - 36} height={trendHeight} />
              ) : (
                <LineDiagram data={trendData} width={contentWidth - 36} height={trendHeight} />
              )}
            </View>
          </GlassContainer>
        </Animated.View>

        <View style={styles.metricGrid}>
          <GlassContainer intensity="light" style={styles.metricCard}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{t("topFlow")}</Text>
            <Text
              selectable
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.metricValue, { color: theme.text }]}
            >
              {summary.topCategory?.label ?? t("noDescription")}
            </Text>
            <Text style={[styles.metricMeta, { color: theme.textSecondary }]}>
              {summary.topCategory
                ? `${Math.round(summary.topCategory.percentage * 100)}%`
                : "0%"}
            </Text>
          </GlassContainer>

          <GlassContainer intensity="light" style={styles.metricCard}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              {t("dailyAverage")}
            </Text>
            <Text
              selectable
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.metricValue, { color: theme.text }]}
            >
              ${formatCurrency(summary.averageExpense, 0)}
            </Text>
            <Text style={[styles.metricMeta, { color: theme.textSecondary }]}>
              {t("expense")}
            </Text>
          </GlassContainer>
        </View>

        <GlassContainer intensity="light" style={styles.legendPanel}>
          {categoryData.slice(0, 6).map((datum, index) => (
            <View key={datum.label} style={styles.legendRow}>
              <View
                style={[
                  styles.legendSwatch,
                  {
                    backgroundColor: (theme.isDark ? DARK_MONO_PALETTE : MONO_PALETTE)[
                      index % MONO_PALETTE.length
                    ],
                  },
                ]}
              />
              <Text numberOfLines={1} style={[styles.legendLabel, { color: theme.text }]}>
                {datum.label}
              </Text>
              <Text
                selectable
                style={[styles.legendValue, { color: theme.textSecondary }]}
              >
                ${formatCurrency(datum.amount, 0)}
              </Text>
            </View>
          ))}
          {categoryData.length === 0 ? (
            <Text style={[styles.emptyLegend, { color: theme.textSecondary }]}>
              {t("noConsumptions")}
            </Text>
          ) : null}
        </GlassContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
  },
  segmentControl: {
    flexDirection: "row",
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
  },
  filterRow: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chartPanel: {
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 18,
    gap: 16,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  chartCaption: {
    fontSize: 12,
    marginTop: 4,
  },
  chartAmount: {
    maxWidth: 130,
    fontSize: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  diagramStage: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  emptyDiagram: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyDiagramText: {
    fontSize: 16,
    fontWeight: "700",
  },
  treemap: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
    borderCurve: "continuous",
    justifyContent: "center",
    alignItems: "center",
  },
  treemapTile: {
    position: "absolute",
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 10,
    justifyContent: "space-between",
  },
  treemapLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  treemapValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  metricGrid: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 112,
    padding: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  metricMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendPanel: {
    borderRadius: 18,
    borderCurve: "continuous",
    padding: 14,
    gap: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  legendValue: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  emptyLegend: {
    textAlign: "center",
    paddingVertical: 16,
  },
});
