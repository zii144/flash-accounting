# 08 — Design System

The design language is **iOS-native, glass-first**: Apple Human Interface conventions, translucent
"liquid glass" surfaces layered over an iOS grouped background, continuous (squircle) corners, SF Symbols
iconography, the system San Francisco font, and full light/dark adaptivity switched by the OS color scheme.

The source of truth is the code (`contexts/ThemeContext.tsx` + the glass primitives). It is mirrored in three
artifacts: `docs/design-tokens.json` (W3C design-tokens schema, machine-readable), `docs/DESIGN_SYSTEM.md`
(human doc), and `docs/design-system.html` (interactive showcase). The marketing site's `website/src/styles.css`
also mirrors these tokens.

## Principles

- **iOS-native** — grouped backgrounds, SF Symbols, system font, native control sizing.
- **Glass-first** — primary surfaces are translucent and blurred, layered over content.
- **Continuous corners** — all rounded shapes use `borderCurve: "continuous"`, never sharp circular radii.
- **Adaptive** — every color ships a light and dark value; there is **no manual theme toggle**.

## Color tokens

### Theme roles (light / dark)
| Role | Light | Dark | Use |
|---|---|---|---|
| background | `#F2F2F7` | `#000000` | App / screen background |
| surface | `#FFFFFF` | `#1C1C1E` | Cards, sheets, elevated containers |
| foreground | `#000000` | `#FFFFFF` | High-emphasis fills (inverse of background) |
| text | `#000000` | `#FFFFFF` | Primary text |
| textSecondary | `#636366` | `#98989D` | Secondary / caption text |
| border | `#D1D1D6` | `#333333` | Dividers, control borders |
| inputBackground | `#FFFFFF` | `#1A1A1A` | Text fields and inputs |

### Accent & status (light / dark)
| Role | Light | Dark | Use |
|---|---|---|---|
| accent | `#0A84FF` | `#64D2FF` | Primary action / interactive accent |
| income | `#30D158` | `#32D74B` | Positive amounts, income |
| expense | `#FF453A` | `#FF6961` | Negative amounts, expense |
| destructive | `#FF3B30` | `#FF3B30` | Delete / destructive actions (same both modes; sometimes hardcoded in components) |

### Chart palettes (ordered)
- **Accent (light)**: `#0A84FF #30D158 #FF9F0A #FF453A #5E5CE6 #64D2FF #FFD60A #BF5AF2 #34C759 #FF375F #8E8E93 #AC8E68`
- **Accent (dark)**: `#64D2FF #32D74B #FFB340 #FF6961 #7D7AFF #5DE6FF #FFE066 #D28CFF #5EE38A #FF6482 #AEAEB2 #C7A97D`
- **Grayscale**: `#E5E5EA #D1D1D6 #AEAEB2 #8E8E93 #636366 #48484A #3A3A3C #2C2C2E #1C1C1E`
- **Mono pie palettes** (DiagramScreen, 10 each): light `#000000`→`#F2F2F7`, dark `#FFFFFF`→`#1C1C1E`. The
  **mono palette is the default** ("black & white") — accent is opt-in via a Switch.

## Typography

System font (San Francisco on iOS), **no bundled custom fonts**. Weights: 400 regular, 500 medium, 600
semibold, 700 bold, 800 heavy. Scale (size / weight / tracking / role):

| Size | Weight | Tracking | Role |
|---|---|---|---|
| 30 | 800 | −0.8 | Display / hero balance |
| 28 | 800 | −0.5 | Screen title |
| 24 | 700 | −0.4 | Section heading |
| 22 | 700 | −0.3 | Card title |
| 20 | 700 | −0.2 | Subtitle |
| 18 | 600 | 0 | Emphasis body |
| 17 | 700 | −0.3 | List amount |
| 16 | 600 | 0 | Body (default) |
| 15 | 500 | 0 | Secondary body |
| 14 | 600 | +0.2 | Label |
| 13 | 500 | +0.2 | Caption |
| 12 | 600 | +0.4 | Footnote |
| 11 | 600 | +0.6 | Micro label (uppercase) |

Rule: negative tracking on large/display text (to −0.8), positive on small uppercase labels (to +0.6). Numeric
displays use `fontVariant: ["tabular-nums"]`.

## Spacing, radii

- **Spacing** (pt, loosely 2-based): `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 32`. Common `gap: 12`/`8`; screen edges
  `paddingHorizontal: 20`; cards `16`; `paddingVertical: 14/12`.
- **Corner radius** (`borderCurve: continuous`): scale `3, 4, 6, 8, 9, 12, 14, 16, 18, 20, 24, 26, 999`. Roles:
  list row 12, button 14, card/glass default 16, large card 24, icon button = size÷2, pill/tag 999.

## Material — liquid glass

The core surface primitive (`GlassContainer`) uses the native iOS glass effect (`expo-glass-effect`) when
available and otherwise falls back to `expo-blur` `BlurView` + a translucent underlay. Hairline border; in light
mode a soft fallback shadow `0 1px 3px rgba(0,0,0,0.06)`. Border color `rgba(0,0,0,0.08)` light /
`rgba(255,255,255,0.12)` dark.

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
  amount 17/700 tracking −0.3 colored by income/expense.
- **Tag (income/expense)** — pill (radius 999), paddingH 14 / paddingV 6, 13/600; status color on an 18%-tinted
  version of itself.

## Iconography

SF Symbols on iOS (Android equivalents mapped from `@expo/material-symbols`), via the `SymbolIcon` primitive,
default size 24. Registry `utils/app-icons.ts` maps ~45 semantic names to `{sf, android}` pairs (e.g. `accounting
→ dollarsign.circle`, `statistics → chart.bar`, `sparkles → sparkles`). Representative set: `dollarsign.circle`,
`chart.bar`, `gearshape`, `xmark`, `chevron.left/right`, `arrow.up/down`, `cloud`, `arrow.clockwise`, `sparkles`,
`cart`, `mic`, `calendar`, `trash`, `pencil`.

## Reusing the system

`docs/DESIGN_SYSTEM.md` documents a workflow for reproducing this look in Claude Design: upload it +
`docs/design-tokens.json` as the project's design system and prompt for new screens that match the glass surfaces,
color roles, type scale, and component specs. The component-level realization is in [09](09-ui-components.md).
