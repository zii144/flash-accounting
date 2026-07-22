# 08 — Design System

The design language is **monochrome-first, glass-first, iOS-native**: the entire UI chrome is built
from a single grayscale ramp (黑白 "black & white"), layered as translucent "liquid glass" surfaces over an
iOS grouped background, with continuous (squircle) corners, SF Symbols iconography, the system San Francisco
font, and full light/dark adaptivity switched by the OS color scheme. **Hue is reserved** for exactly two
jobs: destructive actions, and the opt-in accent chart palette. Income/expense are deliberately **not** chrome
colors — they exist only inside the accent chart palette.

As of the 2026-07 design-system foundation (PR #9), the system is being (re)built **topic by topic** under an
explicit two-layer token model. It is **partially migrated** — the token layer, semantic theme, and `Text`/`Screen`
primitives exist and are governed by docs, but only `AccountingScreen` has been fully moved onto the primitives so
far (see [Migration status](#migration-status)).

## Source of truth & the two-layer token model

**The source of truth is the code**, stated verbatim in both `theme/tokens.ts` ("the single source of truth for
Flash Accounting's visual language") and `docs/design-system/README.md` ("Source of truth = Code; these docs
describe and govern it. If code and these docs disagree, that's a bug — fix one of them.").

```
Layer 1 — PRIMITIVE        theme/tokens.ts          raw, mode-agnostic values (the neutral ramp, scales)
        ▼ mapped by
Layer 2 — SEMANTIC         contexts/ThemeContext.tsx the adaptive `Theme` object (roles → primitives per scheme)
        ▼ consumed by
CONSUMERS                  components via useTheme()  never raw hex, never Layer 1
```

The **one rule** (`docs/design-system/README.md`): a component may reference only `theme.*` (and the scale
primitives as they land). A raw `#hex`, a bare `fontSize: 28`, or a magic `padding: 20` in a component is design
debt = a *missing token* — add the token, don't inline. The sole sanctioned exception is charts, which read the
reserved `chart*` palettes from Layer 1 directly.

## Governance docs — `docs/design-system/` (golden-standard, PR #9)

Delivered as a topic-by-topic contract *on top of* the code; each topic is a "decision + codification + doc"
shipped in lockstep, with drift tracked in explicit ledgers rather than silently fixed.

| File | Governs | Status |
|---|---|---|
| `README.md` | Authority/index: 5 principles, two-layer diagram, the one rule, 10-topic map, "building something new" recipe | Living index |
| `01-color.md` | Color & theming: neutral ramp, semantic role table, chart palettes, do/don't, "adding a role" flow, a11y, changelog | ✅ Done |
| `02-typography.md` | Typography: the `<Text>` primitive, role-vs-weight axes, the 13-row scale, tabular figures, Dynamic-Type cap, drift ledger | ✅ Done |
| `03-spacing-layout.md` | Spacing & layout: `spacing.*` roles, the closed `spaceScale` ladder, `radius.*` roles, the `<Screen>` scaffold | ✅ Done |
| (topics 4–10) | Information layering/elevation (⏳ next), Material/liquid glass, Components & contracts, Iconography, Motion, Accessibility & i18n, Governance & recipes | ⏳ Planned |

> **Legacy docs are now stale.** `docs/DESIGN_SYSTEM.md`, `docs/design-tokens.json`, and `docs/design-system.html`
> (all generated 2026-06-30) are the *previous* single-file spec. They still describe `accent`/`income`/`expense` as
> real color roles and `destructive` as mode-invariant `#FF3B30`, which contradicts the current monochrome-first
> code and the `docs/design-system/` directory that supersedes them. They are slated to be regenerated from the code
> tokens once the token layer is complete; until then, trust `theme/tokens.ts` + `docs/design-system/`, not the
> legacy trio.

## Principles

- **Monochrome-first** — the whole chrome is the `neutral` ramp; active/selected states invert foreground↔background (black↔white). Hue is reserved (destructive + accent chart palette only).
- **Glass-first** — primary surfaces are translucent and blurred, layered over content.
- **iOS-native** — grouped backgrounds, SF Symbols, system font, native control sizing, `borderCurve: "continuous"` on all rounded shapes.
- **Adaptive / automatic** — every role ships a light and dark value; theme follows the OS, **no manual toggle**.
- **Tokens, not literals** — vary emphasis with a role/weight, never a new hardcoded value.

## Layer 1 — primitives (`theme/tokens.ts`)

Every export is `as const` with a derived `keyof` type.

- **`neutral`** — the monochrome spine (16 keys, light→dark; Apple system grays + two custom dividers): `white`,
  `gray50` (`#F2F2F7`, iOS grouped bg), `gray100`, `gray200`, `gray250`, `gray300`, `gray350` (`#98989D`),
  `gray400`, `gray500` (`#636366`), `gray600`, `gray700`, `gray750` (`#333333`), `gray800`, `gray900` (`#1C1C1E`,
  surface dark), `gray950` (`#1A1A1A`, input bg dark), `black`. Type `NeutralToken`.
- **`destructiveHue`** — `{ light: "#FF3B30", dark: "#FF453A" }`. The only hue in the chrome; consume via
  `theme.destructive`, never raw.
- **Chart palettes** — `chartMonoLight`, `chartMonoDark`, `chartAccentLight` (12), `chartAccentDark` (12), bundled as
  `chartPalettes = { monoLight, monoDark, accentLight, accentDark }`. Mono is the default ("black & white"); accent
  is opt-in via a Switch. `DiagramScreen.tsx` still defines these arrays inline and is slated to import
  `chartPalettes` in the Charts topic.
- **Typography** — `fontWeight = { regular:"400", medium:"500", semibold:"600", bold:"700", heavy:"800" }` (type
  `FontWeightToken`); **`typeScale`** = 13 roles, each `{ fontSize, weight, letterSpacing }` (type `TypeVariant`) —
  see the table below.
- **Spacing** — semantic-first, two entry points: **`spacing`** roles `{ screenX:20, card:16, row:12, tight:8,
  section:32 }` (type `SpacingRole`); **`spaceScale`** the *closed* ladder `[0,2,4,6,8,10,12,14,16,18,20,32]` (type
  `SpaceStep`) — off-ladder values (13, 15, 22…) are declared "drift."
- **`radius`** — `{ listRow:12, button:14, card:16, largeCard:24, pill:999 }` (type `RadiusRole`); always paired with
  `borderCurve: "continuous"`; icon buttons are the computed exception `size / 2`.

## Layer 2 — semantic theme (`contexts/ThemeContext.tsx`)

The `Theme` interface (10 fields) maps roles → `neutral.*` primitives; `ThemeProvider` reads
`useColorScheme()` and selects `lightTheme`/`darkTheme` (no manual toggle). `useTheme()` returns `{ theme,
colorScheme }` and throws outside the provider.

| Role | Light | Dark | Use |
|---|---|---|---|
| background | `gray50` `#F2F2F7` | `black` `#000000` | App / screen background |
| surface | `white` | `gray900` `#1C1C1E` | Cards, sheets, elevated containers |
| foreground | `black` | `white` | High-emphasis fills (inverse of background) |
| text | `black` | `white` | Primary text |
| textSecondary | `gray500` `#636366` | `gray350` `#98989D` | Secondary / caption text |
| border | `gray200` | `gray750` `#333333` | Dividers, control borders |
| inputBackground | `white` | `gray950` `#1A1A1A` | Text fields and inputs |
| **destructive** | `#FF3B30` | **`#FF453A`** | Delete / destructive actions — **now adaptive** |
| isDark | `false` | `true` | Barstyle / branch flag |
| fadeGradient | 4-stop list-bottom fade keyed to background | | List bottom fade |

> **The adaptive `destructive` role** is the headline color change (commit `f30908b`, `9370a84`). It resolves to
> distinct light/dark values (light `#FF3B30`, dark Apple systemRed dark `#FF453A`) instead of the previous
> mode-invariant `#FF3B30`, fixing a latent dark-mode legibility issue. Live components now read `theme.destructive`;
> the only remaining raw `#FF3B30` is in the legacy `SettingsModal.tsx` (see [15](15-roadmap-and-caveats.md)).

**Adding a role** is a defined flow: add the primitive to `tokens.ts` if new → add the field to `Theme` → set it in
**both** `lightTheme` and `darkTheme` → document the row in `01-color.md`.

## Typography — the `typeScale` and the `<Text>` primitive

System font (San Francisco on iOS), **no bundled custom fonts**. **Size role and weight are separate axes** — pick a
`variant` for size/tracking/default-weight, then optionally override `weight`.

| variant | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| display | 30 | heavy 800 | −0.8 | Hero balance |
| title | 28 | heavy 800 | −0.5 | Screen title |
| heading | 24 | bold 700 | −0.4 | Section heading |
| cardTitle | 22 | bold 700 | −0.3 | Card title |
| subtitle | 20 | bold 700 | −0.2 | Subtitle |
| bodyEmphasis | 18 | semibold 600 | 0 | Emphasis body |
| amount | 17 | bold 700 | −0.3 | List amount (tabular by default) |
| body | 16 | semibold 600 | 0 | **Default** |
| bodySecondary | 15 | medium 500 | 0 | Secondary body |
| label | 14 | semibold 600 | +0.2 | Label |
| caption | 13 | medium 500 | +0.2 | Caption |
| footnote | 12 | semibold 600 | +0.4 | Footnote |
| micro | 11 | semibold 600 | +0.6 | Micro label (uppercase by default) |

Rule: negative tracking on large/display text (to −0.8), positive on small uppercase labels (to +0.6).

**`components/text.tsx`** is documented as "the ONLY sanctioned way to render text" — screens must never import RN
`Text` directly. Props (extends `RNTextProps`):
- `variant?: TypeVariant` (default `"body"`) — sets fontSize + letterSpacing + default weight.
- `weight?: FontWeightToken` — overrides only the weight.
- `color?` — `"text" | "textSecondary" | "destructive" | "foreground" | "background" | "inherit"` (default `"text"`; `inherit` leaves color unset), resolved from `theme[color]`.
- `tabularNums?: boolean` — defaults on when `variant === "amount"`.
- `uppercase?: boolean` — defaults on when `variant === "micro"`.
- Dynamic Type is capped: `maxFontSizeMultiplier = 1.4` (caller-overridable) to protect fixed-height rows.

## Spacing, radii & the `<Screen>` scaffold

- **Spacing** — `spacing.screenX 20 / card 16 / row 12 / tight 8 / section 32`; the `spaceScale` ladder is *closed*
  (snap off-ladder values to a rung; anything else is tracked as drift).
- **Corner radius** (`borderCurve: continuous`) — `listRow 12 / button 14 / card 16 / largeCard 24 / pill 999`; icon
  button = size ÷ 2.
- **`components/screen.tsx`** — "the standard route shell." Owns the safe-area frame, background, status-bar style,
  and the shared header. Props: `children`, `edges?` (default `["top"]`), `title?` (rendered as `<Text
  variant="title">`), `titleWeight?`, `headerRight?`, `headerSubtitle?`, `padded?` (adds `spacing.screenX`),
  `style?`. Header rhythm is defined once here (`paddingHorizontal: spacing.screenX`, `paddingTop: 16`,
  `paddingBottom: 24`). New routes compose `<Screen>` rather than hand-building `SafeAreaView` + header.

## Material — liquid glass

The core surface primitive (`GlassContainer`) uses the native iOS glass effect (`expo-glass-effect`) when available
and otherwise falls back to `expo-blur` `BlurView` + a translucent underlay. Hairline border; in light mode a soft
fallback shadow `0 1px 3px rgba(0,0,0,0.06)`. Border color `rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.12)` dark.
(Material tokens are not yet in the Layer-1 token file — they are a planned governance topic.)

| Intensity | Blur | Underlay (light) | Underlay (dark) |
|---|---|---|---|
| clear | 35 | `rgba(255,255,255,0.58)` | `rgba(28,28,30,0.58)` |
| light | 45 | `rgba(255,255,255,0.74)` | `rgba(28,28,30,0.72)` |
| medium | 70 | `rgba(255,255,255,0.88)` | `rgba(28,28,30,0.84)` |
| heavy | 90 | `rgba(255,255,255,0.96)` | `rgba(28,28,30,0.94)` |

## Component specs (design tokens)

- **GlassButton** — height 52, radius 14, paddingH 16, icon gap 6, medium glass; pressed opacity 0.82, disabled 0.45.
- **GlassIconButton** — default 40×40, fully rounded (radius = size÷2), medium glass; pressed opacity 0.72.
- **List row** — `surface` bg, radius 12, paddingH 16 / paddingV 14; title 16/600, subtitle 12 in `textSecondary`,
  amount 17/700 tracking −0.3 colored by income/expense (the accent chart palette's two colors).
- **Tag (income/expense)** — pill (radius 999), paddingH 14 / paddingV 6, 13/600; status color on an 18%-tinted
  version of itself.

## Iconography

SF Symbols on iOS (Android equivalents mapped from `@expo/material-symbols`), via the `SymbolIcon` primitive,
default size 24. Registry `utils/app-icons.ts` maps ~45 semantic names to `{sf, android}` pairs (e.g. `accounting
→ dollarsign.circle`, `statistics → chart.bar`, `sparkles → sparkles`). Representative set: `dollarsign.circle`,
`chart.bar`, `gearshape`, `xmark`, `chevron.left/right`, `arrow.up/down`, `cloud`, `arrow.clockwise`, `sparkles`,
`cart`, `mic`, `calendar`, `trash`, `pencil`.

## Migration status

The token layer, semantic theme, and `Text`/`Screen`/glass primitives exist and are governed, but component adoption
is early:

- **Fully migrated:** `AccountingScreen.tsx` (commit `af57d0f`, "pixel-preserving proof") — composes `<Screen>` and
  routes all text through `<Text>`; several `weight` overrides deliberately preserve existing pixels while drift
  decisions stay open. Its `StyleSheet` is now layout-only.
- **Not yet migrated:** ~13 components still import RN `Text` (`AuthEntryScreen`, `ConsumptionForm`,
  `ConsumptionItem`, `DiagramScreen`, `EditConsumptionModal`, `StatisticsView`, the sheets, etc.).
- **Color debt remaining:** raw `#FF3B30` in the legacy `SettingsModal.tsx`; inline chart palettes in
  `DiagramScreen.tsx`; a few `rgba(255,59,48,…)` tint/border values awaiting a token alpha helper.
- **Broadly adopted already:** `useTheme()` (semantic colors) is consumed by ~17 component files, so the color layer
  is well-used even where the `Text`/`Screen`/spacing primitives are not.

## Reusing the system

For reproducing this look in a design tool, prefer `theme/tokens.ts` + `docs/design-system/` (current, monochrome-
first) over the legacy `docs/DESIGN_SYSTEM.md` / `docs/design-tokens.json` (pre-refactor). The component-level
realization is in [09](09-ui-components.md).
