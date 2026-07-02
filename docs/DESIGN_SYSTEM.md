# Flash Accounting — Design System

A reference for reproducing the Flash Accounting visual language in new designs (e.g. in Claude Design). Every value is extracted from the app's codebase. The aesthetic is **iOS-native, glass-first**: Apple Human Interface conventions, translucent "liquid glass" surfaces, continuous (squircle) corners, and the system San Francisco font.

> **How to use in Claude Design:** Upload this file (and `design-tokens.json`) as the project's design system, then prompt: *"Design new screens for Flash Accounting using this design system — match its glass surfaces, color roles, type scale, and component specs."*

## Design principles

- **iOS-native** — grouped backgrounds, SF Symbols, system font, native control sizing.
- **Glass-first** — primary surfaces are translucent and blurred, layered over content.
- **Continuous corners** — all rounded shapes use continuous curvature, never sharp circular radii.
- **Adaptive** — every color ships a light and dark value, switched by the system color scheme.

## Color

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
| destructive | `#FF3B30` | `#FF3B30` | Delete / destructive actions |

### Chart palettes (ordered)

- **Accent (light):** `#0A84FF` `#30D158` `#FF9F0A` `#FF453A` `#5E5CE6` `#64D2FF` `#FFD60A` `#BF5AF2` `#34C759` `#FF375F` `#8E8E93` `#AC8E68`
- **Accent (dark):** `#64D2FF` `#32D74B` `#FFB340` `#FF6961` `#7D7AFF` `#5DE6FF` `#FFE066` `#D28CFF` `#5EE38A` `#FF6482` `#AEAEB2` `#C7A97D`
- **Grayscale:** `#E5E5EA` `#D1D1D6` `#AEAEB2` `#8E8E93` `#636366` `#48484A` `#3A3A3C` `#2C2C2E` `#1C1C1E`

## Typography

System font (San Francisco on iOS) — no custom fonts are bundled. Weights in use: 400 Regular, 500 Medium, 600 Semibold, 700 Bold, 800 Heavy.

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

**Tracking rule:** negative letter-spacing on large/display text (down to −0.8); positive on small uppercase labels (up to +0.6).

## Spacing

Loosely 2-based scale (pt): `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 32`. Most common: `gap: 12` and `gap: 8`; `paddingHorizontal: 20` (screen edges) and `16`; `paddingVertical: 14 / 12`.

## Corner radius

All rounded shapes use **continuous** curvature. Scale (pt): `3, 4, 6, 8, 9, 12, 14, 16, 18, 20, 24, 26, 999`.

| Role | Radius |
|---|---|
| List row | 12 |
| Button | 14 |
| Card / glass (default) | 16 |
| Large card | 24 |
| Icon button | size ÷ 2 (fully rounded) |
| Pill / tag | 999 |

## Material — Liquid glass

The core surface primitive (`GlassContainer`) uses the native iOS glass effect when available and otherwise falls back to a blur plus a translucent underlay. It has a hairline border and, in light mode, a soft fallback shadow.

- **Border:** `rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.12)` dark (hairline width)
- **Light fallback shadow:** `0 1px 3px rgba(0,0,0,0.06)`

| Intensity | Blur | Underlay (light) | Underlay (dark) |
|---|---|---|---|
| clear | 35 | `rgba(255,255,255,0.58)` | `rgba(28,28,30,0.58)` |
| light | 45 | `rgba(255,255,255,0.74)` | `rgba(28,28,30,0.72)` |
| medium | 70 | `rgba(255,255,255,0.88)` | `rgba(28,28,30,0.84)` |
| heavy | 90 | `rgba(255,255,255,0.96)` | `rgba(28,28,30,0.94)` |

## Components

**GlassButton** — height 52, radius 14, paddingHorizontal 16, icon gap 6, medium glass intensity. Pressed opacity 0.82, disabled opacity 0.45.

**GlassIconButton** — default 40×40, fully rounded (radius = size ÷ 2), medium glass. Pressed opacity 0.72.

**List row** — `surface` background, radius 12, paddingH 16 / paddingV 14. Title 16/600, subtitle 12 in `textSecondary`, amount 17/700 tracking −0.3 colored by income/expense.

**Tag (income / expense)** — pill (radius 999), paddingH 14 / paddingV 6, 13/600 text. The status color sits on an 18%-tinted version of itself as the background.

## Iconography

SF Symbols on iOS (Android equivalents mapped) via `SymbolIcon`, default size 24. Representative set: `dollarsign.circle`, `chart.bar`, `gearshape`, `xmark`, `chevron.left/right`, `arrow.up/down`, `cloud`, `arrow.clockwise`, `sparkles`, `cart`, `mic`, `calendar`, `trash`, `pencil`.

---

*Generated 2026-06-30 from `contexts/ThemeContext.tsx`, `components/GlassContainer.tsx`, `components/glass-button.tsx`, `components/glass-icon-button.tsx`, `components/DiagramScreen.tsx`, `utils/app-icons.ts`, and screen styles. See `design-system.html` for an interactive version and `design-tokens.json` for machine-readable tokens.*
