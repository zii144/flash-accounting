# 06 — "Smart" Features (the app's "AI skills")

## The honest headline

The app markets and implements several **"smart"** features — auto-labeling, name suggestions,
income/expense inference, and dictation. **None of them use an LLM, ML model, on-device neural
network, or cloud AI service.** `package.json` has zero AI/ML dependencies. Every "smart" feature
is a **deterministic on-device heuristic**: Unicode-normalized substring matching against
hand-authored, per-language keyword dictionaries, combined with a hand-tuned confidence/time/
history scoring formula. Speech-to-text is delegated to the **OS keyboard (iOS dictation)** and the
**browser Web Speech API** — not to any app-side model.

This is a legitimate and lightweight design — it's fully offline, private, and free to run — but it
should be documented precisely so nobody assumes there's a model to train, an API to key, or an
inference cost to budget.

| Feature | Mechanism | Languages with native terms | External AI/ML? |
|---|---|---|---|
| Category canonicalization / auto-labeling | Unicode-normalized substring match, longest-term-wins, against a glossary | 12 categories; native terms for en/zh/ja/es/fr/de, English + translated label elsewhere | **No** |
| Name suggestions (top-3 chips) | Deterministic confidence formula (semantic + time-of-day + history recency) | same glossary | **No** |
| Income/expense inference | Keyword lists + pattern type + history majority vote | English keyword lists | **No** |
| Dictation text cleanup | Strip the `￼` sentinel only | script-agnostic | **No** |
| Speech-to-text | Web Speech API (web, `en-US`) / iOS system-keyboard dictation (native) | OS-dependent | Uses OS/browser service, **no app-side model** |

> **Filename note:** there is **no `utils/smart-labeling.ts`** despite a
> `tests/smart-labeling.test.ts`. The "smart labeling" behavior is implemented across
> `utils/smart-consumption.ts` + `utils/glossary-merge.ts` + `utils/glossary-defaults.ts`.

## The core engine — `utils/smart-consumption.ts`

**Dictionaries**: `SemanticPattern = { label, type, terms[], activeHours? }`. `DEFAULT_SEMANTIC_PATTERNS`
derive from the 12 built-in glossary categories. Two hardcoded English word lists: `EXPENSE_WORDS`
(buy, bought, paid, spend, bill, fee, dinner, lunch, coffee, uber, taxi…) and `INCOME_WORDS` (salary,
paycheck, payroll, freelance, invoice, refund, reimburse, cashback, bonus, income…).

**Normalization** — `normalizeText`: lowercases, Unicode `NFKD`-normalizes, strips non-letter/number
chars via `\p{Letter}\p{Number}`, collapses whitespace. Being Unicode-aware, it works for CJK and
accented scripts.

**Matching** — `findPatternMatch`: substring containment (`normalized.includes(term)`) with a
**longest-term-wins** tiebreak.

**Public functions**:
- `canonicalizeConsumptionLabel(description, patterns, unlabeledLabel="Unlabeled")` — returns the
  longest matching term's label; else a Title-Cased truncation (48 chars) of the raw text; else
  `"Unlabeled"`. This maps `"捷運"` → `"交通"`, `"boba run"` → `"Bubble Tea"`. It is passed as the
  `canonicalizeLabel` into the diagram aggregators, so **it also buckets records for the pie/treemap
  charts**.
- `inferConsumptionType(input, history, patterns)` — priority: (1) `INCOME_WORDS` → income; (2)
  `EXPENSE_WORDS` → expense; (3) matched pattern's `type`; (4) **history majority vote** among past
  records with the same canonical label; (5) default `expense`.
- `getConsumptionSuggestions(input, history, now, patterns)` — up to 3 ranked chips. Confidence formula:
  - Pattern match base `0.78` (input contains term) / `0.72` (label prefix) / `0.58` (term contains
    input), plus a **+0.2 time-of-day boost** if the current hour is inside the pattern's `activeHours`,
    capped at `0.98`; `reason = "time"|"semantic"`.
  - History match `0.68`/`0.5` plus a recency term from circular hour-distance; `reason = "time"|"history"`.
  - Sorted by confidence desc, sliced to top 3.
- `getSmartDraftEnhancement(...)` — applies the top suggestion's label when confidence ≥ 0.72. (Exported
  but currently has no UI caller — type is chosen manually via the Expense/Income buttons.)

## Where the smart labels are consumed

1. **Suggestion chips** in the entry form (`components/ConsumptionForm.tsx`): `getSuggestions(description,
   history)` from `GlossaryContext` renders the top-3 labels as tappable chips.
2. **Diagram category grouping** (`components/DiagramScreen.tsx` → `utils/diagram-data.ts`):
   `canonicalizeLabel` buckets free-text records into categories for pie/treemap/bar/line charts.

So the same heuristic labeling powers both name suggestions and chart grouping — a single source of
category truth.

## The glossary — user-customizable, multilingual dictionary

The glossary is the data behind the engine. It is **not** in SQLite — it lives in AsyncStorage under
`@flash_accounting_glossary`. Full i18n aspects are in [07](07-internationalization.md).

- **Types** (`types/glossary.ts`): 12 `BuiltinGlossaryKey`s — dinner, lunch, breakfast, coffee, groceries,
  transport, shopping, subscription, rent, salary, freelance, refund. `GlossaryPreferences = { version,
  builtinOverrides, customEntries }`. Overrides can set `label`, `extraTerms`, `disabled`, `type`; custom
  entries are `{ id, label, type, terms[], activeHours? }`.
- **Defaults** (`utils/glossary-defaults.ts`): `BUILTIN_GLOSSARY_DEFINITIONS` — each key's base type,
  English terms, and optional `activeHours` (dinner 18–21h, lunch 11–14h, breakfast 6–11h, coffee 7–18h).
  First 9 are expense; salary/freelance/refund are income.
- **Localized terms** (`utils/glossary-locale-terms.ts`): `LOCALE_BUILTIN_TERMS` — native synonyms per key
  for **5 non-English languages** (zh, ja, es, fr, de). E.g. `zh.transport = ["計程車","捷運","公車","加油",
  "停車","高鐵","火車"]`. The other 10 UI languages get English terms + their translated label only.
- **Merge** (`utils/glossary-merge.ts`): `buildSemanticPatterns(preferences, resolveBuiltinLabel, language)`
  produces the runtime `SemanticPattern[]`. **Custom entries are prepended** so they win over built-ins;
  enabled built-ins union localized terms + `extraTerms` + the resolved label.
- **Storage & sanitization** (`utils/glossary-storage.ts`): defense-against-bloat caps — terms ≤64 chars,
  ≤24 terms/entry, labels ≤48 chars, ≤40 custom entries, `activeHours` two ints in [0,23].
- **Runtime glue** (`contexts/GlossaryContext.tsx`): builds patterns from preferences + `resolvedLanguage`,
  exposes `getSuggestions` and `canonicalizeLabel`, and drives the "Smart Label Glossary" editor UI where
  users can rename categories and add trigger words in any language.

## Dictation & speech

### iOS system-keyboard dictation (device)
The only dictation path that ships on device. The mic button on the iOS keyboard inserts text through the
normal `TextInput` `onChangeText`. iOS injects a Unicode **Object Replacement Character `￼`** into
controlled inputs; `utils/dictation-text.ts` `normalizeIosDictationText(next, previous)` strips **only**
that sentinel (regex `/￼/g`). It deliberately does **not** dedupe or collapse repeats — the `previous`
arg is intentionally ignored — so CJK IME composition (`速速`) and genuine typed duplicates (`appleapple`)
are preserved. Permissions are declared in `app.json` (`NSSpeechRecognitionUsageDescription`,
`NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`).

### Web Speech API (web only)
`hooks/useSpeechRecognition.ts` gates on `Platform.OS === "web"` and reads
`window.SpeechRecognition || window.webkitSpeechRecognition`. If present it configures `continuous=true`,
`interimResults=true`, `lang="en-US"` (**hardcoded English**). On native it sets `isAvailable=false`, so
the in-app mic button only renders on web. `components/ConsumptionForm.tsx` merges the live transcript into
the description inside a `requestAnimationFrame`, with an animated "listening dots" indicator.

There is currently **no in-app native iOS/Android speech-recognition module** — that's a roadmap item
([15](15-roadmap-and-caveats.md)).

## How to extend

- **Add a category**: add a `BuiltinGlossaryKey` + definition in `glossary-defaults.ts`, native terms in
  `glossary-locale-terms.ts`, and labels in `glossary-i18n.ts` (all 16 locales — the parity test enforces it).
- **Improve labeling quality**: it's all in `smart-consumption.ts` — tune the confidence weights, the
  time-boost, or add fuzzy matching. No retraining, no data pipeline.
- **Real natural-language logging** (e.g. "spent 68 on coffee") is a *planned* v3 item in the pricing plan;
  it does not exist yet.
