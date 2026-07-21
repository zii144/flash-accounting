/**
 * Design tokens — the single source of truth for Flash Accounting's visual language.
 *
 * TWO LAYERS
 * ──────────
 *  1. PRIMITIVE tokens (this file): raw, mode-agnostic values. A color ramp, and — as
 *     later design-system topics land — spacing / radii / type / motion scales. Nothing
 *     here knows about light vs dark. These are the vocabulary, not the meaning.
 *
 *  2. SEMANTIC tokens (contexts/ThemeContext.tsx): the adaptive `Theme` object that maps
 *     roles (background, text, destructive, …) onto primitives, per color scheme.
 *     Components consume Layer 2 via `useTheme()` — NEVER a raw hex, and never Layer 1
 *     directly. The one sanctioned exception is charts, which read the reserved
 *     `chart*` palettes below.
 *
 * IDENTITY — monochrome-first (黑白記帳)
 * ─────────────────────────────────────
 * The UI is built entirely from the `neutral` ramp. Active / selected states invert
 * between foreground and background (black ↔ white). Hue is RESERVED for exactly two
 * jobs: (a) destructive actions, and (b) the opt-in accent chart palette. Income and
 * expense are NOT chrome colors — they exist only inside the accent chart palette.
 *
 * See docs/design-system/01-color.md for the rationale and usage contract.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Neutral ramp — the monochrome spine. Ordered light → dark. Every surface, text,
// and border color in the app resolves to one of these. Values are Apple's system
// grays plus the two custom dividers the app already ships.
// ─────────────────────────────────────────────────────────────────────────────
export const neutral = {
  white: "#FFFFFF",
  gray50: "#F2F2F7", // iOS grouped background (light)
  gray100: "#E5E5EA",
  gray200: "#D1D1D6",
  gray250: "#C7C7CC",
  gray300: "#AEAEB2",
  gray350: "#98989D", // secondary text (dark)
  gray400: "#8E8E93",
  gray500: "#636366", // secondary text (light)
  gray600: "#48484A",
  gray700: "#3A3A3C",
  gray750: "#333333", // divider (dark)
  gray800: "#2C2C2E",
  gray900: "#1C1C1E", // surface (dark)
  gray950: "#1A1A1A", // input background (dark)
  black: "#000000",
} as const;

export type NeutralToken = keyof typeof neutral;

// ─────────────────────────────────────────────────────────────────────────────
// Reserved hue — destructive. The ONLY hue that appears in the app chrome. Distinct
// light/dark values so it stays legible on both backgrounds (Apple systemRed).
// Consume via `theme.destructive`, not these raw values.
// ─────────────────────────────────────────────────────────────────────────────
export const destructiveHue = {
  light: "#FF3B30",
  dark: "#FF453A",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Reserved hue — the opt-in accent CHART palette. NOT general-purpose theme roles.
// The monochrome UI never uses these; they surface only in DiagramScreen when the
// user opts into the accent (non-mono) palette. Ordered; consumers wrap modulo length.
// Mirrors the arrays in components/DiagramScreen.tsx verbatim (that file will migrate
// to import these in the Charts topic).
// ─────────────────────────────────────────────────────────────────────────────
export const chartMonoLight = [
  "#000000", "#2C2C2E", "#48484A", "#636366", "#8E8E93",
  "#AEAEB2", "#C7C7CC", "#D1D1D6", "#E5E5EA", "#F2F2F7",
] as const;

export const chartMonoDark = [
  "#FFFFFF", "#E5E5EA", "#D1D1D6", "#AEAEB2", "#8E8E93",
  "#636366", "#48484A", "#3A3A3C", "#2C2C2E", "#1C1C1E",
] as const;

export const chartAccentLight = [
  "#0A84FF", "#30D158", "#FF9F0A", "#FF453A", "#5E5CE6", "#64D2FF",
  "#FFD60A", "#BF5AF2", "#34C759", "#FF375F", "#8E8E93", "#AC8E68",
] as const;

export const chartAccentDark = [
  "#64D2FF", "#32D74B", "#FFB340", "#FF6961", "#7D7AFF", "#5DE6FF",
  "#FFE066", "#D28CFF", "#5EE38A", "#FF6482", "#AEAEB2", "#C7A97D",
] as const;

export const chartPalettes = {
  monoLight: chartMonoLight,
  monoDark: chartMonoDark,
  accentLight: chartAccentLight,
  accentDark: chartAccentDark,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────
// System font (San Francisco on iOS); no bundled custom fonts. Consumed through the
// <Text> primitive (components/text.tsx) — components never hand-set fontSize/weight/
// tracking. See docs/design-system/02-typography.md.

// Named weights → React Native fontWeight strings. Weight is a separate axis from the
// size role: a `body` can be regular or semibold without inventing a new variant.
export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
} as const;

export type FontWeightToken = keyof typeof fontWeight;

// The type scale — one entry per role. Each bundles a size, a DEFAULT weight, and the
// tracking that suits that size (negative on large/display text, positive on small
// labels). Override the weight per-use via <Text weight="…">; tracking is owned by the
// role. Values are the canonical scale (see the doc); where a screen currently differs,
// migrate with a weight override and log it in the doc's drift ledger.
export const typeScale = {
  display: { fontSize: 30, weight: "heavy", letterSpacing: -0.8 }, // Hero balance
  title: { fontSize: 28, weight: "heavy", letterSpacing: -0.5 }, // Screen title
  heading: { fontSize: 24, weight: "bold", letterSpacing: -0.4 }, // Section heading
  cardTitle: { fontSize: 22, weight: "bold", letterSpacing: -0.3 }, // Card title
  subtitle: { fontSize: 20, weight: "bold", letterSpacing: -0.2 }, // Subtitle
  bodyEmphasis: { fontSize: 18, weight: "semibold", letterSpacing: 0 }, // Emphasis body
  amount: { fontSize: 17, weight: "bold", letterSpacing: -0.3 }, // List amount (tabular)
  body: { fontSize: 16, weight: "semibold", letterSpacing: 0 }, // Body (default)
  bodySecondary: { fontSize: 15, weight: "medium", letterSpacing: 0 }, // Secondary body
  label: { fontSize: 14, weight: "semibold", letterSpacing: 0.2 }, // Label
  caption: { fontSize: 13, weight: "medium", letterSpacing: 0.2 }, // Caption
  footnote: { fontSize: 12, weight: "semibold", letterSpacing: 0.4 }, // Footnote
  micro: { fontSize: 11, weight: "semibold", letterSpacing: 0.6 }, // Micro label (UPPER)
} as const satisfies Record<string, { fontSize: number; weight: FontWeightToken; letterSpacing: number }>;

export type TypeVariant = keyof typeof typeScale;

// ─────────────────────────────────────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────────────────────────────────────
// Two ways in, semantic-first. Reach for a `spacing` role when one fits the intent;
// otherwise pick a rung on the closed `spaceScale` ladder. Don't invent in-between
// values (13, 15, 22…) — a value off the ladder is drift. See docs/design-system/03-*.

/** Semantic spacing roles — the intent behind the most-used values. Prefer these. */
export const spacing = {
  screenX: 20, // screen horizontal edges (paddingHorizontal)
  card: 16, // padding inside a glass card / section
  row: 12, // default gap between stacked rows/elements
  tight: 8, // compact gap (chips, inline icon+label)
  section: 32, // gap between major sections
} as const;

export type SpacingRole = keyof typeof spacing;

/** The closed spacing ladder (pt, loosely 4-based with 2pt half-steps). */
export const spaceScale = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 32] as const;
export type SpaceStep = (typeof spaceScale)[number];

// ─────────────────────────────────────────────────────────────────────────────
// RADII — always paired with `borderCurve: "continuous"` (never a sharp circular
// radius). Icon buttons are the exception: radius = size / 2 (computed, fully round).
// ─────────────────────────────────────────────────────────────────────────────
export const radius = {
  listRow: 12,
  button: 14,
  card: 16,
  largeCard: 24,
  pill: 999,
} as const;

export type RadiusRole = keyof typeof radius;
