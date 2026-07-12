import { CategoryDetailSheet } from "@/components/CategoryDetailSheet";
import { EditConsumptionModal } from "@/components/EditConsumptionModal";
import { GlassContainer } from "@/components/GlassContainer";
import { GlassIconButton } from "@/components/glass-icon-button";
import { SymbolIcon } from "@/components/symbol-icon";
import { useDiagramAppearance } from "@/contexts/DiagramAppearanceContext";
import { useGlossary } from "@/contexts/GlossaryContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsumptionStats, type CustomDateRange } from "@/hooks/useConsumptionStats";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import type { Consumption } from "@/types/consumption";
import type { TimeFilter } from "@/utils/constants";
import { TIME_FILTERS } from "@/utils/constants";
import { normalizeDateRange } from "@/utils/date-utils";
import {
  buildCategoryBreakdown,
  buildCategoryDetail,
  buildDiagramSummary,
  buildTrendSeries,
  type CategoryDatum,
  type TrendDatum,
} from "@/utils/diagram-data";
import { formatCurrency, LOCALE_MAP } from "@/utils/formatting";
import { logger } from "@/utils/logger";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

type DiagramMode = "pie" | "treemap" | "bar" | "line";
const OVERVIEW_SELECTION = "__overview__";

const LIGHT_MONO_PIE_PALETTE = [
  "#000000",
  "#2C2C2E",
  "#48484A",
  "#636366",
  "#8E8E93",
  "#AEAEB2",
  "#C7C7CC",
  "#D1D1D6",
  "#E5E5EA",
  "#F2F2F7",
];

const DARK_MONO_PIE_PALETTE = [
  "#FFFFFF",
  "#E5E5EA",
  "#D1D1D6",
  "#AEAEB2",
  "#8E8E93",
  "#636366",
  "#48484A",
  "#3A3A3C",
  "#2C2C2E",
  "#1C1C1E",
];

const LIGHT_ACCENT_PIE_PALETTE = [
  "#0A84FF",
  "#30D158",
  "#FF9F0A",
  "#FF453A",
  "#5E5CE6",
  "#64D2FF",
  "#FFD60A",
  "#BF5AF2",
  "#34C759",
  "#FF375F",
  "#8E8E93",
  "#AC8E68",
];

const DARK_ACCENT_PIE_PALETTE = [
  "#64D2FF",
  "#32D74B",
  "#FFB340",
  "#FF6961",
  "#7D7AFF",
  "#5DE6FF",
  "#FFE066",
  "#D28CFF",
  "#5EE38A",
  "#FF6482",
  "#AEAEB2",
  "#C7A97D",
];

function getPieColor(index: number, isDark: boolean, useAccentPalette: boolean) {
  const palette = useAccentPalette
    ? isDark
      ? DARK_ACCENT_PIE_PALETTE
      : LIGHT_ACCENT_PIE_PALETTE
    : isDark
      ? DARK_MONO_PIE_PALETTE
      : LIGHT_MONO_PIE_PALETTE;
  return palette[index % palette.length];
}

function formatPercentage(percentage: number) {
  const value = percentage * 100;
  return value > 0 && value < 10 ? `${value.toFixed(1)}%` : `${Math.round(value)}%`;
}

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
            testID={`diagram-mode-${option.value}`}
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

function PieDiagram({
  data,
  size,
  groupLabel,
  itemLabel,
  totalAmount,
  selectedLabel,
  onSelect,
  useAccentPalette,
}: {
  data: CategoryDatum[];
  size: number;
  groupLabel: string;
  itemLabel: string;
  totalAmount: number;
  selectedLabel: string | null;
  onSelect: (label: string) => void;
  useAccentPalette: boolean;
}) {
  const { theme } = useTheme();
  const center = size / 2;
  const radius = size / 2 - 12;
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

  const selectedDatum = data.find((datum) => datum.label === selectedLabel) ?? null;
  const selectedIndex = selectedDatum
    ? data.findIndex((datum) => datum.label === selectedDatum.label)
    : -1;
  const centerColor =
    selectedIndex >= 0
      ? getPieColor(selectedIndex, theme.isDark, useAccentPalette)
      : theme.text;
  const centerSize = innerRadius * 2 - 18;

  return (
    <View style={[styles.pieDiagramShell, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G>
          {segments.map((segment, index) => {
            const isSelected = segment.datum.label === selectedLabel;
            const interactiveProps =
              process.env.EXPO_OS === "web"
                ? {}
                : { onPress: () => onSelect(segment.datum.label) };
            return (
              <Path
                key={segment.datum.label}
                d={describeDonutArc(
                  center,
                  isSelected ? radius + 6 : radius,
                  innerRadius,
                  segment.start,
                  segment.end - 1.2,
                )}
                fill={getPieColor(index, theme.isDark, useAccentPalette)}
                opacity={selectedLabel && !isSelected ? 0.45 : 1}
                stroke={theme.background}
                strokeWidth={isSelected ? 4 : 2}
                {...interactiveProps}
              />
            );
          })}
        </G>
        <Circle cx={center} cy={center} r={innerRadius - 2} fill={theme.background} />
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.pieCenterOverlay,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
      >
        {selectedDatum ? (
          <>
            <View style={styles.pieCenterLabelRow}>
              <View
                style={[styles.pieCenterSwatch, { backgroundColor: centerColor }]}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.pieCenterLabel, { color: theme.text }]}
              >
                {selectedDatum.label}
              </Text>
            </View>
            <Text
              selectable
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.pieCenterAmount, { color: theme.text }]}
            >
              ${formatCurrency(selectedDatum.amount, 0)}
            </Text>
            <Text
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.pieCenterMeta, { color: theme.textSecondary }]}
            >
              {formatPercentage(selectedDatum.percentage)} • {selectedDatum.count} {itemLabel}
            </Text>
          </>
        ) : (
          <>
            <Text
              selectable
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={[styles.pieCenterAmount, { color: theme.text }]}
            >
              ${formatCurrency(totalAmount, 0)}
            </Text>
            <Text style={[styles.pieCenterMeta, { color: theme.textSecondary }]}>
              {data.length} {groupLabel}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function TreemapDiagram({
  data,
  width,
  height,
  emptyLabel,
  useAccentPalette,
  onSelect,
}: {
  data: CategoryDatum[];
  width: number;
  height: number;
  emptyLabel: string;
  useAccentPalette: boolean;
  onSelect: (label: string) => void;
}) {
  const { theme } = useTheme();
  const visibleData = data.slice(0, 9);
  const palette = visibleData.map((_, index) =>
    getPieColor(index, theme.isDark, useAccentPalette),
  );
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
        <Text style={[styles.emptyDiagramText, { color: theme.textSecondary }]}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.treemap, { height }]}>
      {rects.map((rect, index) => (
        <Pressable
          key={rect.datum.label}
          onPress={() => onSelect(rect.datum.label)}
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
        </Pressable>
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

function getTrendPointX(index: number, pointCount: number, width: number) {
  const paddingLeft = 18;
  const paddingRight = 10;
  const plotWidth = width - paddingLeft - paddingRight;

  if (pointCount <= 1) {
    return paddingLeft + plotWidth / 2;
  }

  return paddingLeft + (index / (pointCount - 1)) * plotWidth;
}

function LineDiagram({
  data,
  width,
  height,
  emptyLabel,
}: {
  data: TrendDatum[];
  width: number;
  height: number;
  emptyLabel: string;
}) {
  const { theme } = useTheme();
  const chartHeight = height - 34;
  const axisY = chartHeight;

  if (data.length === 0) {
    return (
      <View style={[styles.emptyTrendChart, { width, height }]}>
        <Text style={[styles.emptyDiagramText, { color: theme.textSecondary }]}>{emptyLabel}</Text>
      </View>
    );
  }

  const maxValue = Math.max(1, ...data.map((datum) => datum.expense));
  const points = data.map((datum, index) => ({
    x: getTrendPointX(index, data.length, width),
    y: axisY - (datum.expense / maxValue) * (chartHeight - 16),
    datum,
  }));
  const path =
    points.length > 1
      ? points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
      : null;

  return (
    <Svg width={width} height={height}>
      <Line x1={14} y1={axisY} x2={width - 8} y2={axisY} stroke={theme.border} />
      {path ? (
        <Path
          d={path}
          fill="none"
          stroke={theme.text}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
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
  const { t, resolvedLanguage } = useLanguage();
  const { isAccentPaletteEnabled, setAccentPaletteEnabled } = useDiagramAppearance();
  const { canonicalizeLabel, isReady } = useGlossary();
  const { getFilteredConsumptions } = useConsumptionStats();
  const { updateConsumption, deleteConsumption } = useConsumptionStorage();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const [mode, setMode] = useState<DiagramMode>("pie");
  const [records, setRecords] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customRange, setCustomRange] = useState<CustomDateRange>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    return { start, end };
  });
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);
  const [detailLabel, setDetailLabel] = useState<string | null>(null);
  const [editingConsumption, setEditingConsumption] = useState<Consumption | null>(null);
  // Holds a record tapped in the detail sheet until that sheet finishes
  // dismissing (iOS), so the editor sheet isn't presented mid-animation.
  const pendingEditRef = useRef<Consumption | null>(null);

  const contentWidth = Math.max(280, width - 32);
  const pieSize = Math.min(260, contentWidth * 0.78);
  const trendHeight = Math.max(220, Math.min(300, contentWidth * 0.7));
  const trendData = useMemo(
    () => buildTrendSeries(records, timeFilter, resolvedLanguage),
    [records, timeFilter, resolvedLanguage],
  );

  const categoryData = useMemo(
    () => (isReady ? buildCategoryBreakdown(records, canonicalizeLabel) : []),
    [canonicalizeLabel, isReady, records],
  );
  const summary = useMemo(
    () =>
      isReady
        ? buildDiagramSummary(records, canonicalizeLabel)
        : {
            expenseTotal: 0,
            incomeTotal: 0,
            netTotal: 0,
            topCategory: null,
            averageExpense: 0,
          },
    [canonicalizeLabel, isReady, records],
  );

  const effectiveSelectedCategoryLabel = useMemo(() => {
    if (selectedCategoryLabel === OVERVIEW_SELECTION) {
      return null;
    }

    if (
      selectedCategoryLabel &&
      categoryData.some((datum) => datum.label === selectedCategoryLabel)
    ) {
      return selectedCategoryLabel;
    }

    return categoryData[0]?.label ?? null;
  }, [categoryData, selectedCategoryLabel]);

  const selectedCategory = useMemo(
    () => categoryData.find((datum) => datum.label === effectiveSelectedCategoryLabel) ?? null,
    [categoryData, effectiveSelectedCategoryLabel],
  );

  const activeRange = isCustomRange ? customRange : null;

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFilteredConsumptions(timeFilter, "date", "ASC", activeRange);
      setRecords(data);
    } catch (error) {
      logger.error("Failed to load diagram data", error, { timeFilter });
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeRange, getFilteredConsumptions, timeFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadRecords();
    }, [loadRecords]),
  );

  const handleSettingsPress = useCallback(() => {
    router.push("/settings");
  }, []);

  const handleCategorySelect = useCallback((label: string) => {
    setSelectedCategoryLabel(label);
    setDetailLabel(label);
  }, []);

  const handleSelectPresetFilter = useCallback((filter: TimeFilter) => {
    setIsCustomRange(false);
    setActivePicker(null);
    setTimeFilter(filter);
  }, []);

  const handleToggleCustomRange = useCallback(() => {
    setIsCustomRange((current) => {
      const next = !current;
      setActivePicker(null);
      return next;
    });
  }, []);

  const handleRangeChange = useCallback(
    (which: "start" | "end", nextDate?: Date) => {
      if (Platform.OS !== "ios") {
        setActivePicker(null);
      }
      if (!nextDate) {
        return;
      }
      setCustomRange((current) => normalizeDateRange(which, nextDate, current));
    },
    [],
  );

  const { records: detailRecords, total: detailTotal } = useMemo(() => {
    if (!detailLabel || !isReady) {
      return { records: [] as Consumption[], total: 0 };
    }
    return buildCategoryDetail(records, canonicalizeLabel, detailLabel);
  }, [canonicalizeLabel, detailLabel, isReady, records]);

  const detailIndex = detailLabel
    ? categoryData.findIndex((datum) => datum.label === detailLabel)
    : -1;
  const detailSwatchColor = getPieColor(
    detailIndex >= 0 ? detailIndex : 0,
    theme.isDark,
    isAccentPaletteEnabled,
  );

  const handleCloseDetail = useCallback(() => {
    setDetailLabel(null);
    // On iOS the editor open is deferred to here (the sheet's onDismiss) so we
    // never present one pageSheet while another is still dismissing.
    const pendingEdit = pendingEditRef.current;
    pendingEditRef.current = null;
    if (pendingEdit) {
      setEditingConsumption(pendingEdit);
    }
  }, []);

  const handleSelectRecord = useCallback((record: Consumption) => {
    if (Platform.OS === "ios") {
      // Defer: close the detail sheet, open the editor once it has dismissed.
      pendingEditRef.current = record;
      setDetailLabel(null);
    } else {
      setDetailLabel(null);
      setEditingConsumption(record);
    }
  }, []);

  const handleEditClose = useCallback(() => {
    setEditingConsumption(null);
  }, []);

  const handleEditSave = useCallback(
    async (consumption: Consumption) => {
      await updateConsumption(consumption);
      await loadRecords();
    },
    [loadRecords, updateConsumption],
  );

  const handleEditDelete = useCallback(
    async (id: string) => {
      await deleteConsumption(id);
      await loadRecords();
    },
    [deleteConsumption, loadRecords],
  );

  const formatRangeBound = useCallback(
    (date: Date) =>
      date.toLocaleDateString(LOCALE_MAP[resolvedLanguage] || "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [resolvedLanguage],
  );

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
      key={resolvedLanguage}
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
          testID="settings-button"
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
            const selected = !isCustomRange && filter === timeFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => handleSelectPresetFilter(filter)}
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
          <Pressable
            onPress={handleToggleCustomRange}
            style={[
              styles.filterChip,
              styles.customChip,
              { borderColor: theme.border },
              isCustomRange && { backgroundColor: theme.foreground },
            ]}
          >
            <SymbolIcon
              name="calendar-outline"
              size={14}
              color={isCustomRange ? theme.background : theme.text}
            />
            <Text
              style={[
                styles.filterText,
                { color: isCustomRange ? theme.background : theme.text },
              ]}
            >
              {t("customRange")}
            </Text>
          </Pressable>
        </ScrollView>

        {isCustomRange ? (
          <GlassContainer intensity="light" style={styles.rangeCard}>
            <View style={styles.rangeRow}>
              <TouchableOpacity
                style={styles.rangeField}
                activeOpacity={0.7}
                onPress={() => setActivePicker(activePicker === "start" ? null : "start")}
              >
                <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
                  {t("startDate")}
                </Text>
                <Text style={[styles.rangeValue, { color: theme.text }]}>
                  {formatRangeBound(customRange.start)}
                </Text>
              </TouchableOpacity>
              <SymbolIcon name="chevron-forward" size={16} color={theme.textSecondary} />
              <TouchableOpacity
                style={styles.rangeField}
                activeOpacity={0.7}
                onPress={() => setActivePicker(activePicker === "end" ? null : "end")}
              >
                <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
                  {t("endDate")}
                </Text>
                <Text style={[styles.rangeValue, { color: theme.text }]}>
                  {formatRangeBound(customRange.end)}
                </Text>
              </TouchableOpacity>
            </View>
            {activePicker && Platform.OS !== "web" ? (
              <View style={styles.rangePickerWrapper}>
                <DateTimePicker
                  value={activePicker === "start" ? customRange.start : customRange.end}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={(_event, nextDate) => handleRangeChange(activePicker, nextDate)}
                />
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={[styles.rangeDone, { backgroundColor: theme.foreground }]}
                    onPress={() => setActivePicker(null)}
                  >
                    <Text style={[styles.rangeDoneText, { color: theme.background }]}>
                      {t("confirm")}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </GlassContainer>
        ) : null}

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
                <PieDiagram
                  data={categoryData}
                  size={pieSize}
                  groupLabel={t("groups")}
                  itemLabel={t("items")}
                  totalAmount={summary.expenseTotal}
                  selectedLabel={effectiveSelectedCategoryLabel}
                  onSelect={handleCategorySelect}
                  useAccentPalette={isAccentPaletteEnabled}
                />
              ) : mode === "treemap" ? (
                <TreemapDiagram
                  data={categoryData}
                  width={contentWidth - 36}
                  height={Math.max(260, Math.min(420, width * 0.88))}
                  emptyLabel={t("noData")}
                  useAccentPalette={isAccentPaletteEnabled}
                  onSelect={handleCategorySelect}
                />
              ) : mode === "bar" ? (
                <BarDiagram data={trendData} width={contentWidth - 36} height={trendHeight} />
              ) : (
                <LineDiagram
                  data={trendData}
                  width={contentWidth - 36}
                  height={trendHeight}
                  emptyLabel={t("noData")}
                />
              )}
            </View>
          </GlassContainer>
        </Animated.View>

        {(mode === "pie" || mode === "treemap") ? (
          <GlassContainer intensity="light" style={styles.paletteToggleCard}>
            <View style={styles.paletteToggleTextBlock}>
              <Text style={[styles.paletteToggleTitle, { color: theme.text }]}>
                {t("diagramPaletteTitle")}
              </Text>
              <Text style={[styles.paletteToggleSubtitle, { color: theme.textSecondary }]}>
                {isAccentPaletteEnabled
                  ? t("diagramPaletteAccent")
                  : t("diagramPaletteMono")}
              </Text>
            </View>
            <Switch
              value={isAccentPaletteEnabled}
              onValueChange={(value) => {
                void setAccentPaletteEnabled(value);
              }}
              trackColor={{
                false: theme.isDark ? "#3A3A3C" : "#D1D1D6",
                true: theme.foreground,
              }}
              thumbColor={theme.background}
              ios_backgroundColor={theme.isDark ? "#3A3A3C" : "#D1D1D6"}
            />
          </GlassContainer>
        ) : null}

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
          {categoryData.map((datum, index) => {
            const swatchColor = getPieColor(index, theme.isDark, isAccentPaletteEnabled);
            const isSelected = datum.label === selectedCategory?.label;
            return (
              <Pressable
                key={datum.label}
                testID={`legend-row-${index}`}
                onPress={() => handleCategorySelect(datum.label)}
                style={[
                  styles.legendRow,
                  {
                    backgroundColor:
                      isSelected
                        ? theme.isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)"
                        : "transparent",
                    borderColor: isSelected ? swatchColor : "transparent",
                  },
                ]}
              >
                <View
                  style={[styles.legendSwatch, { backgroundColor: swatchColor }]}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.legendLabel, { color: theme.text }]}
                >
                  {datum.label}
                </Text>
                <Text style={[styles.legendPercentage, { color: theme.textSecondary }]}>
                  {formatPercentage(datum.percentage)}
                </Text>
                <Text
                  selectable
                  style={[styles.legendValue, { color: theme.textSecondary }]}
                >
                  ${formatCurrency(datum.amount, 0)}
                </Text>
              </Pressable>
            );
          })}
          {categoryData.length === 0 ? (
            <Text style={[styles.emptyLegend, { color: theme.textSecondary }]}>
              {t("noConsumptions")}
            </Text>
          ) : null}
        </GlassContainer>
      </ScrollView>

      <CategoryDetailSheet
        visible={detailLabel !== null}
        label={detailLabel}
        records={detailRecords}
        totalAmount={detailTotal}
        swatchColor={detailSwatchColor}
        onClose={handleCloseDetail}
        onSelectRecord={handleSelectRecord}
      />

      <EditConsumptionModal
        visible={editingConsumption !== null}
        consumption={editingConsumption}
        onClose={handleEditClose}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
      />
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
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rangeCard: {
    borderRadius: 18,
    borderCurve: "continuous",
    padding: 14,
    gap: 12,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rangeField: {
    flex: 1,
    gap: 2,
  },
  rangeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  rangeValue: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  rangePickerWrapper: {
    alignItems: "center",
  },
  rangeDone: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  rangeDoneText: {
    fontSize: 15,
    fontWeight: "700",
  },
  chartPanel: {
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 18,
    gap: 16,
  },
  paletteToggleCard: {
    minHeight: 64,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paletteToggleTextBlock: {
    flex: 1,
    gap: 2,
  },
  paletteToggleTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  paletteToggleSubtitle: {
    fontSize: 12,
    fontWeight: "500",
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
  pieDiagramShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenterOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 4,
  },
  pieCenterLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
  pieCenterSwatch: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  pieCenterLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  pieCenterAmount: {
    fontSize: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  pieCenterMeta: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyDiagramText: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyTrendChart: {
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 42,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  legendPercentage: {
    width: 48,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  legendValue: {
    width: 84,
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  emptyLegend: {
    textAlign: "center",
    paddingVertical: 16,
  },
});
