# 09 — UI Components

`components/` holds the view layer: design-system + glass primitives, building blocks, four screens, and two
sheet/modal patterns. Files split by convention: **PascalCase** for feature components/screens
(`AccountingScreen.tsx`), **kebab-case** for low-level primitives (`glass-button.tsx`, `symbol-icon.tsx`,
`text.tsx`, `screen.tsx`). See [14](14-conventions-and-agent-skills.md) for conventions and
[08](08-design-system.md) for the tokens these realize.

## Design-system primitives (PR #9)

- **`<Text>` — `components/text.tsx`** — "the ONLY sanctioned way to render text." Wraps RN `Text`; props `variant`
  (13-role `typeScale`, default `body`), `weight` (separate axis), `color` (`text`/`textSecondary`/`destructive`/
  `foreground`/`background`/`inherit`), `tabularNums` (auto for `amount`), `uppercase` (auto for `micro`);
  Dynamic-Type capped at 1.4×. Screens should never import RN `Text` directly.
- **`<Screen>` — `components/screen.tsx`** — "the standard route shell": owns the `SafeAreaView` frame (`edges`
  default `["top"]`), background, status-bar style, and the shared header (`title` via `<Text variant="title">`,
  `titleWeight`, `headerRight`, `headerSubtitle`, `padded`). New routes compose it instead of hand-building
  `SafeAreaView` + header.

**Adoption is early** — only `AccountingScreen` is fully migrated onto these; ~13 components still import RN `Text`
directly. See the migration status in [08](08-design-system.md).

## Glass primitives

### GlassContainer — `components/GlassContainer.tsx`
The core surface primitive. Props: `children`, `style`, `intensity?` (clear/light/medium/heavy, default medium),
`interactive?`, `animated?`. Three-layer render: (1) a shell `View` with hairline border, `borderCurve:
"continuous"`, `overflow: hidden`, and (light mode) a soft fallback shadow; (2) an absolute-fill translucent
underlay colored by theme + intensity; (3) either a native `GlassView` (`expo-glass-effect`) or a `BlurView`
fallback. Native glass is used only on iOS when `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()`
both succeed; otherwise blur. `animated` mode springs scale 0.98→1 and swaps blur→GlassView after the spring
finishes.

### GlassButton — `components/glass-button.tsx`
`GlassContainer` (interactive) around a `Pressable`. Radius 14, height 52, paddingH 16, row layout gap 6.
Pressed opacity 0.82, disabled 0.45. Accessibility role `"button"` with disabled state.

### GlassIconButton — `components/glass-icon-button.tsx`
Circular glass button; `size` default 40, radius = size/2, medium intensity, pressed opacity 0.72.

### SymbolIcon — `components/symbol-icon.tsx`
Platform icon via `expo-image`: `sf:<name>` SF Symbols on iOS, bundled `@expo/material-symbols` XML on Android.
Props `name: AppIconName`, `size` (24), `color` (as `tintColor`). Registry in `utils/app-icons.ts`.

## Building blocks

- **ConsumptionForm** — the entry form: amount + description inputs, Expense/Income buttons, the top-3 smart
  suggestion chips (`getSuggestions`), the web-only mic button + animated listening dots, and iOS dictation text
  cleanup (`normalizeIosDictationText`). `EXPO_PUBLIC_CAPTURE` suppresses autofocus for preview recordings.
- **ConsumptionItem** — a `memo`-wrapped list row with amount (tabular-nums), type badge, description, time, and
  `ReanimatedSwipeable` swipe-to-delete (react-native-gesture-handler).
- **FeaturesCarousel** / **UpcomingFeaturesBanner** — marketing carousel of upcoming features (`utils/features.ts`,
  `utils/feature-carousel.ts`).
- **ErrorBoundary** — the one class component (needs `getDerivedStateFromError`/`componentDidCatch`); deliberately
  context-independent (hardcoded fallback theme + translations); shows "Try Again" reset, prints error in dev.
- **AuthEntryScreen** — the login gate (currently bypassed by `app/index.tsx`).

## Screens

### AccountingScreen — `components/AccountingScreen.tsx`
Home/ledger tab. **The one screen fully migrated to the DS primitives** (commit `af57d0f`, "pixel-preserving
proof"): composes `<Screen title headerRight headerSubtitle>` (no hand-built SafeAreaView/StatusBar/header) and
routes all text through `<Text variant/weight/color>`; its `StyleSheet` is now layout-only. Renders header (app-name
title + settings `GlassIconButton` + "Total: $X" line) → `ConsumptionForm` → a `FlatList` of `ConsumptionItem`s with a bottom `LinearGradient` fade
(`theme.fadeGradient`). Paginated (`PAGE_SIZE = 5`) with generation-guarded loads, `onEndReached` infinite scroll,
fixed row height 88, `useFocusEffect` reload. Net total via `useConsumptionStats().getStats("all")`. Hosts
`EditConsumptionModal`. Optimistic delete.

### StatisticsView — `components/StatisticsView.tsx`
Grouped-by-day ledger + summary. `FlatList` whose header holds: a horizontally-scrolling row of three
`GlassContainer intensity="light"` stat cards (Income / Expense / Net), then Time and Sort filter rows as glass
bars with pill toggles that invert to `theme.foreground`/`background` when active. Each list item is a day group:
glass header (date + count + signed total) then per-consumption rows. SQL-backed pagination
(`getGroupedByDay`, `STATS_PAGE_SIZE = 5`), Reanimated `FadeIn`/`Layout.springify`. Hosts `EditConsumptionModal`.

### DiagramScreen — `components/DiagramScreen.tsx`
The charts tab and widest context consumer (`useDiagramAppearance`, `useGlossary`, `useLanguage`, `useTheme`,
`useConsumptionStats`, `useConsumptionStorage`). A `ScrollView` with: a `SegmentControl` (pie/treemap/bar/line), a
`TIME_FILTERS` chip row + custom-range chip (opens a `DateTimePicker` range card), the chart panel
(`GlassContainer intensity="light"`, radius 24), a mono/accent palette toggle (`Switch`, pie/treemap only), a
two-up metric grid (`topFlow` %, `dailyAverage`), and a tappable legend. Data via `getFilteredConsumptions` +
`buildCategoryBreakdown`/`buildTrendSeries`/`buildDiagramSummary`; category labels canonicalized via
`useGlossary().canonicalizeLabel`. Hosts `CategoryDetailSheet` (with an iOS deferral so the page-sheet fully
dismisses before the editor opens).

### SettingsScreen — `components/SettingsScreen.tsx`
The largest screen (~1,200 lines); consumes essentially every context/hook. A `ScrollView` of
`GlassContainer intensity="medium"` section cards (radius 24): **Account** (Google/Facebook/Apple sign-in or
sign-out via `useProviderAuth`), **Storage** (cloud sync status, local-limit meter, upgrade/paywall via
`usePro().presentPaywall`, restore, sync up/pull down), **Data** (CSV export via `expo-file-system` +
`expo-sharing`, CSV import, Smart Glossary link), **Appearance** (diagram palette Switch, language row →
`/select-language`), **Danger** (clear history, `theme.destructive` — migrated off the raw `#FF3B30` in commit `9370a84`), and a `__DEV__`-only **Developer** section (toggle
Pro, seed ~150 demo expenses). Content width-capped at `maxWidth: 720`.

## Sheets & modals — two patterns

**(a) Native `Modal` sheets** (`presentationStyle="pageSheet"` iOS / `"fullScreen"` else, slide animation):
- **EditConsumptionModal** — edit amount/description/date/type + delete/save; custom grabber, close X,
  `KeyboardAvoidingView`, `DateTimePicker` (spinner on iOS), glass inputs.
- **CategoryDetailSheet** — records in a tapped chart category; reads `useSafeAreaInsets()` directly (SafeAreaView
  doesn't get context inside a native modal); grabber + swatch + "$total • N items" + `FlatList`.
- **SettingsModal** — an **older, centered translucent card** modal; appears legacy/superseded by SettingsScreen
  (uses a hardcoded 7-language list). A cleanup candidate.
- **GlossarySheet** also nests an inner editor `Modal`.

**(b) expo-router form-sheet routes** (Stack `presentation: "formSheet"` + `sheetGrabberVisible` on iOS):
- **LanguageSheet** (`/select-language`) — language picker; glass `listCard` of option rows with checkmark icons,
  and a floating bottom `GlassContainer intensity="heavy"` action bar (Cancel/Confirm).
- **GlossarySheet** (`/glossary`) — the Smart Glossary manager; sectioned glass lists (built-in vs custom), same
  floating heavy-glass bottom bar, plus the nested editor modal.

Shared idioms: selective `SafeAreaView` edges (LanguageSheet + GlossarySheet use `edges={["top","bottom"]}` so the
header clears the status bar / notch — commit `accc06f`); manual grabber view; floating bottom action bar as heavy
glass; selected states invert to `theme.foreground` bg + `theme.background` text; hairline `theme.border` dividers.

## Charts — react-native-svg (all inside DiagramScreen.tsx)

Drawn with `react-native-svg` (`Svg, Circle, G, Line, Path, Rect, Text`):

- **SegmentControl** — generic glass segmented control; selected button fills `theme.foreground`.
- **PieDiagram** (donut) — segments accumulate `max(1.8, percentage*360)` degrees; each slice an SVG `Path` from a
  custom arc builder (`describeDonutArc`/`polarToCartesian`); `innerRadius = radius*0.56`; selected slice pops out,
  others dim to opacity 0.45; central overlay shows selected category or total. Slice `onPress` disabled on web.
- **TreemapDiagram** — squarified-ish layout splitting the remaining rectangle by each datum's share; max 9
  absolutely-positioned `Pressable` tiles (radius 12, 4px gaps); labels drawn only when a tile is large enough.
- **BarDiagram** — grouped expense/income `Rect`s per trend bucket; baseline `Line`; x-labels thinned to ~5.
- **LineDiagram** — expense trend polyline (`Path`, round caps) with `Circle` markers.

Palette selection: `getPieColor(index, isDark, useAccentPalette)` picks mono vs accent × light/dark, wrapping
modulo length. Trend/category math lives in `utils/diagram-data.ts` (see [05](05-data-layer-and-sync.md)).

## Theming consumption

Every component calls `const { theme } = useTheme()` and applies colors as inline overrides on top of a
per-file `StyleSheet.create` object (`[styles.title, { color: theme.text }]`). `StatusBar barStyle` derives from
`theme.isDark`. The theme is fully automatic (follows the OS); `DiagramAppearanceContext` separately holds the
chart palette preference.
