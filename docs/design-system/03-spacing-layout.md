# 03 — Spacing & Layout

> **Decision:** a closed spacing ladder + semantic spacing/radius roles, and a `<Screen>`
> scaffold that owns the route shell so every screen is consistent by construction.
> **Code:** [`theme/tokens.ts`](../../theme/tokens.ts) (`spacing`, `spaceScale`, `radius`) · [`components/screen.tsx`](../../components/screen.tsx).

---

## Spacing

Two ways in, **semantic-first**:

- **`spacing.*` roles** — reach for these. They name the intent behind the common values:

  | Role | pt | Use |
  |---|---|---|
  | `spacing.screenX` | 20 | Screen horizontal edges |
  | `spacing.card` | 16 | Padding inside a glass card / section |
  | `spacing.row` | 12 | Default gap between stacked rows/elements |
  | `spacing.tight` | 8 | Compact gap (chips, inline icon + label) |
  | `spacing.section` | 32 | Gap between major sections |

- **`spaceScale` ladder** — the closed set of allowed values when no role fits:
  `0 · 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 32` (pt, loosely 4-based with 2pt
  half-steps). **The set is closed** — a `padding: 13` or `gap: 22` is drift; snap to a rung.

`SpaceStep` (the union type) and `SpacingRole` are exported for helpers that want to
constrain their inputs.

## Radii

Corners are **semantic** and always paired with `borderCurve: "continuous"` — never a
sharp circular radius.

| Role | pt |
|---|---|
| `radius.listRow` | 12 |
| `radius.button` | 14 |
| `radius.card` | 16 |
| `radius.largeCard` | 24 |
| `radius.pill` | 999 |

Icon buttons are the one computed exception: `radius = size / 2` (fully round).

---

## The `<Screen>` scaffold

Every route was hand-building the same shell: `SafeAreaView edges={["top"]}` + background
+ `StatusBar` + a header row (title + a trailing `GlassIconButton`) + sometimes a subtitle
line. `<Screen>` owns all of it, so a new route is consistent for free.

```tsx
import { Screen } from "@/components/screen";

<Screen
  title={t("statistics")}
  headerRight={<GlassIconButton …/>}      // optional trailing action(s)
  headerSubtitle={<Text …>Total: …</Text>} // optional line under the title
>
  {/* body */}
</Screen>
```

**Props:** `title` · `headerRight` · `headerSubtitle` · `edges` (default `["top"]`) ·
`padded` (add `screenX` padding to the body; default off — most bodies manage their own
layout, e.g. a full-bleed `FlatList` with its own content padding) · `titleWeight` (weight
override while a title's drift decision is open) · `style`.

**What it standardizes (defined once, here — the canonical source):** safe-area frame,
`theme.background`, status-bar style from `theme.isDark`, header horizontal padding
(`screenX`), the title + trailing-action top row, and the title-to-subtitle rhythm. Omit
`title`/`headerRight`/`headerSubtitle` entirely for a header-less screen (e.g. a sheet body).

---

## Usage contract

**Do**

- Build new routes with `<Screen>`; pass the title and actions as props.
- Use `spacing.*` roles for padding/gaps; drop to a `spaceScale` rung only when no role fits.
- Use `radius.*` for corners, always with `borderCurve: "continuous"`.
- Prefer native `gap` on a flex container over margins between siblings.

**Don't**

- ❌ Re-implement `SafeAreaView` + a header in a new screen — compose `<Screen>`.
- ❌ Use an off-ladder spacing value; snap to the nearest rung (and question the design if
  none is close).
- ❌ Hardcode a corner radius that has a role (`12/14/16/24/999`).

---

## Migration status

- **Done:** `AccountingScreen` now composes `<Screen>` (pixel-preserving); its StyleSheet
  is layout-only and its shell code is gone.
- **Next:** `StatisticsView`, `DiagramScreen`, `SettingsScreen` have bespoke headers/shells
  and heavy inline spacing — migrate to `<Screen>` + `spacing`/`radius` as each is touched.
- **Note:** the sheet routes (`LanguageSheet`, `GlossarySheet`) use a header-less body +
  a floating heavy-glass bottom bar — that pattern will be blessed in the Components topic;
  they can still use `<Screen>` header-less for the safe-area frame.
