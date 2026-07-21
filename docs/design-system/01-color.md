# 01 — Color & Theming

> **Decision:** monochrome-first, reserved semantic.
> **Code:** [`theme/tokens.ts`](../../theme/tokens.ts) (primitives) · [`contexts/ThemeContext.tsx`](../../contexts/ThemeContext.tsx) (semantic `Theme`).

---

## The decision, and why

Flash Accounting is *黑白記帳 — Black White Accounting*. The name is the design
constraint. So the color system is deliberately narrow:

- **The UI is monochrome.** Every surface, text, border, and control resolves to the
  neutral (black→white) ramp. Nothing in the chrome is colored for decoration.
- **Emphasis is inversion, not hue.** An active tab, a selected filter pill, a primary
  button — these express themselves by swapping `foreground` and `background` (black on
  white ↔ white on black), which is why the app reads as crisp and calm in both modes.
- **Hue is reserved for exactly two jobs:**
  1. **Destructive actions** — the single hue allowed in the chrome (`theme.destructive`).
  2. **The opt-in accent chart palette** — color as *data*, and only when the user turns
     the mono palette off in Diagram. Income green / expense red exist **only inside this
     palette**; they are not app-wide roles.

We considered promoting income/expense to real theme roles (tinted amounts everywhere).
We rejected it: it dilutes the black-and-white identity that the product name promises.
If that changes later, it's a deliberate identity decision, re-opened here — not a
one-off `theme.income` sprinkled into a component.

---

## The model

### Layer 1 — neutral ramp (the monochrome spine)

Defined in `theme/tokens.ts` as `neutral`, ordered light → dark. These are Apple's system
grays plus the two custom dividers the app ships. Components never read these directly;
they exist so the semantic layer (and charts) have one vocabulary.

`white · gray50 · gray100 · gray200 · gray250 · gray300 · gray350 · gray400 · gray500 · gray600 · gray700 · gray750 · gray800 · gray900 · gray950 · black`

### Layer 2 — semantic roles (what components consume)

`useTheme().theme` returns these, already resolved for the active color scheme:

| Role | Light | Dark | Use |
|---|---|---|---|
| `background` | `gray50` `#F2F2F7` | `black` `#000000` | App / screen background (iOS grouped) |
| `surface` | `white` `#FFFFFF` | `gray900` `#1C1C1E` | Cards, sheets, elevated containers |
| `foreground` | `black` `#000000` | `white` `#FFFFFF` | High-emphasis fills; **inverse of background** — the active/selected state |
| `text` | `black` `#000000` | `white` `#FFFFFF` | Primary text |
| `textSecondary` | `gray500` `#636366` | `gray350` `#98989D` | Secondary / caption text |
| `border` | `gray200` `#D1D1D6` | `gray750` `#333333` | Dividers, hairline control borders |
| `inputBackground` | `white` `#FFFFFF` | `gray950` `#1A1A1A` | Text fields and inputs |
| `destructive` | `#FF3B30` | `#FF453A` | Delete / destructive actions — **the one reserved hue** |
| `fadeGradient` | — | — | 4-stop list-bottom fade, keyed to `background` |

> **`foreground` is the workhorse.** "Make this look selected/primary" = `backgroundColor:
> theme.foreground` + `color: theme.background`. That single inversion is the app's accent
> system.

### Reserved — chart palettes (charts only)

`theme/tokens.ts` also exports `chartPalettes` (`monoLight`, `monoDark`, `accentLight`,
`accentDark`). These are the *only* colored values in the system, and only `DiagramScreen`
may read them — via the palette selector, gated by the user's mono/accent toggle. The mono
palette is the default; accent is opt-in.

---

## Usage contract

**Do**

- `const { theme } = useTheme();` then `theme.background`, `theme.text`, `theme.destructive`, …
- Express "primary/selected" by inverting to `theme.foreground` / `theme.background`.
- Keep the static `StyleSheet.create` color-free (or a neutral placeholder) and apply the
  themed color inline: `style={[styles.label, { color: theme.text }]}`.

**Don't**

- ❌ Hardcode a hex (`color: "#FF3B30"`) — use the role (`theme.destructive`).
- ❌ Introduce a colored accent for emphasis — invert instead.
- ❌ Read `neutral.*` or `chart*` from a component (charts excepted). If you need a new
  meaning, add a **role** to `Theme`, don't reach into Layer 1.

**Adding a role.** New meaning that needs its own light/dark pair → add a primitive to
`theme/tokens.ts` if the value is new, add the field to the `Theme` interface, set it in
both `lightTheme` and `darkTheme`, and document the row above. That is the whole flow.

---

## Accessibility

- Monochrome maximizes contrast by construction: `text`/`background` is pure black/white
  (21:1). `textSecondary` on `background` clears WCAG AA for body text in both modes.
- Glass surfaces reduce effective contrast — never place `textSecondary` on `clear`/`light`
  glass for essential text; use `text`, or a heavier glass intensity (see the Material topic).
- `destructive` is never the *only* signal for a destructive action — it always pairs with
  a trash icon and/or an explicit label.

---

## Changelog / migration notes

- **New:** `theme/tokens.ts` primitive layer; `theme.destructive` semantic role.
- **Fix:** dark-mode destructive was `#FF3B30` (identical to light) — a latent legibility
  bug. It is now Apple systemRed dark `#FF453A`. Light is unchanged.
- **Migrated to `theme.destructive`:** `EditConsumptionModal`, `SettingsScreen`.
- **Remaining color debt (tracked, not yet done):**
  - `DiagramScreen` still defines the four chart palettes inline — migrate to
    `chartPalettes` in the Charts topic.
  - `ConsumptionItem` swipe-to-delete uses raw `rgba(255,59,48,…)` tints, and
    `EditConsumptionModal` uses an `rgba(255,59,48,…)` destructive border — these need a
    token *tint* helper (deferred to a later topic that adds alpha/tinting).
  - `SettingsModal` (legacy, superseded by `SettingsScreen`) still hardcodes `#FF3B30`;
    fold in when that component is removed or refactored.
