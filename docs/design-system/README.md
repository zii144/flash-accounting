# Flash Accounting — Design System (Golden Standard)

> **This is the authority.** When building a new component, screen, or route, this
> directory is the source of truth for how it should look and behave. If code and these
> docs disagree, that's a bug — fix one of them.
>
> | Field | Value |
> |---|---|
> | Status | **In progress** — built topic by topic (see the map below) |
> | Source of truth | **Code** (`theme/tokens.ts` + `contexts/ThemeContext.tsx` + the primitives). These docs describe and govern it. |
> | Identity | Monochrome-first (黑白記帳) · glass-first · iOS-native · adaptive light/dark |
> | Owner | Zii — architecture & product |

The older `docs/DESIGN_SYSTEM.md`, `docs/design-tokens.json`, and `docs/design-system.html`
are the *previous* single-file spec. They are superseded by this directory and will be
regenerated from the code tokens once the token layer is complete. Until then, prefer
what's here.

---

## Why this exists

The app already had a strong, coherent look — but it lived as **magic numbers copied
across 19 components** plus a Markdown file that had already drifted from what ships.
A new screen couldn't *consume* the design system; it had to re-derive it by hand. That
is how design systems rot.

The golden standard fixes this by making **code the single source of truth** and giving
every visual decision exactly one home that new code imports. These docs are the human
contract on top of that code.

---

## Core principles

1. **Monochrome-first.** The UI is built from a neutral (black→white) ramp. The primary
   interaction language is **inversion** — active/selected states flip `foreground` ↔
   `background`. Hue is *reserved*, never decorative. → [01-color](01-color.md)
2. **Glass-first.** Primary surfaces are translucent, blurred glass layered over an iOS
   grouped background. Elevation is expressed by material + layering, not drop shadows.
3. **iOS-native.** Apple HIG conventions: grouped backgrounds, SF Symbols, the system
   font, native control sizing, continuous (squircle) corners everywhere.
4. **Adaptive, automatic.** Every color ships a light and a dark value, switched by the
   OS color scheme. There is **no manual theme toggle**.
5. **Tokens, not literals.** Components consume semantic tokens via `useTheme()` and
   (later) typed scale primitives — never a raw hex, size, or spacing number.

---

## Token architecture (two layers)

```
theme/tokens.ts          Layer 1 — PRIMITIVE   raw, mode-agnostic values
   │                                            (color ramp; soon spacing/radii/type/motion)
   ▼
contexts/ThemeContext.tsx  Layer 2 — SEMANTIC  the adaptive `Theme` object: roles → primitives,
   │                                            resolved per light/dark. THE runtime contract.
   ▼
components/*               CONSUMERS            read Layer 2 via `useTheme()`. Never Layer 1,
                                                never raw literals. (Exception: charts read the
                                                reserved `chart*` palettes from Layer 1 directly.)
```

**The one rule that keeps this alive:** a component may only reference `theme.*` (and the
scale primitives as they land). A raw `#hex`, a bare `fontSize: 28`, or a magic `padding:
20` in a component is design debt — it means a token is missing. Add the token; don't
inline the value.

---

## Topic map

Each topic is a *decision + codification + doc*, delivered in lockstep.

| # | Topic | Status | Doc |
|---|---|---|---|
| 1 | **Color & theming** | ✅ Done | [01-color](01-color.md) |
| 2 | **Typography** | ✅ Done | [02-typography](02-typography.md) |
| 3 | **Spacing & layout scaffold** | ✅ Done | [03-spacing-layout](03-spacing-layout.md) |
| 4 | Information layering & elevation | ⏳ Next | — |
| 5 | Material (liquid glass) | ⏳ | — |
| 6 | Components & contracts | ⏳ | — |
| 7 | Iconography | ⏳ | — |
| 8 | Motion | ⏳ | — |
| 9 | Accessibility & i18n | ⏳ | — |
| 10 | Governance & recipes (new screen/route/component) | ⏳ | — |

---

## Building something new (until the recipes topic lands)

- New route? Compose `<Screen title=… headerRight=…>` from `@/components/screen` — never
  hand-build a `SafeAreaView` + header.
- Wrap surfaces in `GlassContainer` / `GlassButton` / `GlassIconButton`; never hand-roll
  a blurred card.
- Text: `import { Text } from "@/components/text"` and use `<Text variant="…">` — never
  import `Text` from `react-native`, never set `fontSize`/`fontWeight` in a component.
- Spacing/corners: `spacing.*` and `radius.*` from `@/theme/tokens`; corners always with
  `borderCurve: "continuous"`.
- Colors: `const { theme } = useTheme()`, then `theme.background/surface/text/…`. For a
  delete/destructive affordance use `theme.destructive`.
- Icons: `SymbolIcon name="…"` only, from the `utils/app-icons.ts` registry.
- Corners: `borderRadius` + `borderCurve: "continuous"`, always.
- If you reach for a value that has no token, stop — that's the signal to define one here
  and in `theme/tokens.ts`, not to inline it.
