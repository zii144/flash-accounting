# 02 — Typography

> **Decision:** one type scale, consumed through a `<Text>` primitive. Size-role and
> weight are separate axes. Dynamic Type is supported, capped.
> **Code:** [`theme/tokens.ts`](../../theme/tokens.ts) (`typeScale`, `fontWeight`) · [`components/text.tsx`](../../components/text.tsx) (the primitive).

---

## The primitive

`<Text>` from `@/components/text` is the **only** sanctioned way to render text. It bakes
in size, tracking, weight, themed color, tabular figures, and a Dynamic Type cap, so no
screen hand-sets `fontSize` / `fontWeight` / `letterSpacing` / `color` on text again.

```tsx
import { Text } from "@/components/text";

<Text variant="title">{t("flashAccounting")}</Text>          // screen title
<Text variant="amount">{formatted}</Text>                    // tabular-nums auto-on
<Text variant="body" weight="regular">{body}</Text>          // 16pt regular
<Text variant="caption" color="textSecondary">{ts}</Text>    // secondary caption
```

**Props:** `variant` (size role, default `body`) · `weight` (override the role's default
weight) · `color` (theme role, default `text`) · `tabularNums` (default on for `amount`) ·
`uppercase` (default on for `micro`). All standard `Text` props pass through
(`numberOfLines`, `selectable`, `onPress`, …).

### Two axes: role and weight

The scale bundles a *default* weight into each role, but **weight is an independent
axis** — override it with `weight` rather than inventing a new variant. This is how a
16pt line can be regular body copy *or* semibold emphasis without two scale entries:

```tsx
<Text variant="body">…</Text>                    // 16 / semibold (default)
<Text variant="body" weight="regular">…</Text>   // 16 / regular
```

`weight` tokens → `regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 · `heavy` 800.

---

## The scale

Canonical values (system font — San Francisco on iOS; no bundled fonts). Tracking is
owned by the role: negative on large/display text, positive on small labels.

| `variant` | Size | Default weight | Tracking | Role |
|---|---|---|---|---|
| `display` | 30 | heavy (800) | −0.8 | Display / hero balance |
| `title` | 28 | heavy (800) | −0.5 | Screen title |
| `heading` | 24 | bold (700) | −0.4 | Section heading |
| `cardTitle` | 22 | bold (700) | −0.3 | Card title |
| `subtitle` | 20 | bold (700) | −0.2 | Subtitle |
| `bodyEmphasis` | 18 | semibold (600) | 0 | Emphasis body |
| `amount` | 17 | bold (700) | −0.3 | List amount *(tabular-nums)* |
| `body` | 16 | semibold (600) | 0 | Body (default) |
| `bodySecondary` | 15 | medium (500) | 0 | Secondary body |
| `label` | 14 | semibold (600) | +0.2 | Label |
| `caption` | 13 | medium (500) | +0.2 | Caption |
| `footnote` | 12 | semibold (600) | +0.4 | Footnote |
| `micro` | 11 | semibold (600) | +0.6 | Micro label (UPPERCASE) |

---

## Numbers

Money and counts use **tabular (monospaced) figures** so digits don't jitter as they
change. The `amount` variant turns this on automatically; force it elsewhere with
`tabularNums`. Never render a currency value in proportional figures.

---

## Dynamic Type (accessibility)

Text scales with the OS font-size setting, **capped at 1.4×** (`MAX_FONT_SCALE` in
`components/text.tsx`). The cap protects tuned layouts — the ledger uses fixed 88pt rows
and `getItemLayout`, which uncapped scaling would overflow. Raise the cap per-instance
with `maxFontSizeMultiplier` only where the container can genuinely grow.

> Open follow-up for Topic 9 (Accessibility): audit the fixed-height rows so the cap can
> be raised, and verify wrapping in the longest locales (German, Thai) at 1.4×.

---

## Usage contract

**Do**

- Render every string through `<Text variant="…">`.
- Keep `StyleSheet` entries layout-only (margins, flex, alignment). Font properties live
  in the variant.
- Use `weight` to vary emphasis; use `color` roles for color.

**Don't**

- ❌ Import `Text` from `react-native` in a screen. Import it from `@/components/text`.
- ❌ Set `fontSize` / `fontWeight` / `letterSpacing` in a component StyleSheet.
- ❌ Add a new scale entry for a weight variation — override `weight` instead.

---

## Drift ledger — canonical scale vs what ships

Some screens predate the scale and differ from canonical. Migrations so far preserve
**current pixels** via a `weight` override; the question is whether to *converge* to
canonical (a deliberate, visible restyle) — a decision for the owner, tracked here.

| Site | Ships as | Canonical role | Perceptible? | Status |
|---|---|---|---|---|
| AccountingScreen app title | 28 / **700** | `title` = 28 / **800** | Yes (heavier) | Preserved with `weight="bold"` — **decision pending** |
| AccountingScreen total line | 18 / **500** | nearest `bodyEmphasis` = 18 / 600 | Mild | Preserved with `weight="medium"` — **decision pending** |
| AccountingScreen empty title | 16 / **400** | `body` = 16 / 600 | Yes (lighter) | Preserved with `weight="regular"` (intentional light empty-state) |
| AccountingScreen empty/loading captions | 14 / 400 / 0 | `label` = 14 / 600 / +0.2 | No (≤0.2pt tracking) | Converged (`weight="regular"`) |

**Recommendation:** keep the intentional ones (light empty-state) as `weight` overrides;
decide the two "pending" rows (title weight, total weight) explicitly, then converge the
rest of the app screen by screen.

---

## Migration status

- **Done:** `AccountingScreen` (pixel-preserving proof).
- **Next:** `StatisticsView`, `DiagramScreen`, `SettingsScreen`, sheets — migrate as each
  is touched; the primitive is additive, so migration is incremental and safe.
