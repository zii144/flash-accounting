# Product Roadmap — Black White Accounting (黑白記帳)

Last updated: 2026-07-02
Current release: iOS v1.0.4 (build 11), Expo SDK 56 / React Native 0.85

This roadmap consolidates `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md`, `plan/pricing_plan_20260527.md`, `plan/pro_1plus1_entitlement_plan_20260609.md`, and a full codebase health check (2026-07-02). It supersedes the sprint plan in the caveats doc, which predates the June auth/CSV/release work.

---

## Where the product stands today

**Shipped and stable**

- Local-first income/expense logging on SQLite with soft deletes, migrations, and a free-tier record limit (currently 50 local records)
- Statistics and diagram screens (time filters, sorting, daily grouping, net totals, pie charts)
- CSV export and CSV import
- 6 languages (en, zh-Hant, es, fr, de, ja) with device-locale detection and customizable glossary terms
- Dark/light theme, error boundary, structured logging, Sentry wiring
- Auth gate before tabs; Apple sign-in plus Google sign-in via native OAuth redirect (code + PKCE)
- RevenueCat tiers: Basic (free) / Plus ($14.99 lifetime, unlimited local) / Pro ($5.99 mo · $59 yr, cloud sync)
- Firestore cloud sync for signed-in Pro users: per-record sync queue, tombstone deletes, last-write-wins merge, manual push/pull recovery
- iOS 1.0.4 live via local Xcode release flow (`RELEASE_IOS.md`); CI runs lint + typecheck + 52 unit tests

**Known gaps (from health check)**

- Cloud sync has no retry/backoff across app restarts and no real-time Firestore listener — multi-device UX is manual-refresh
- Facebook sign-in still gated; no end-to-end tests for native auth/IAP/sync flows
- Pro 1+1 seat sharing is fully specified but not implemented (needs a backend authorization layer)
- Android build exists but has not shipped; voice input exists only on web
- Dependencies drift: Expo SDK 57 is out; 14 packages behind SDK 56 patch levels; npm audit reports 30 vulns (1 critical, 8 high — all in transitive dev/CLI tooling, none shipped in the app bundle)
- No analytics/product instrumentation, so pricing and funnel decisions are currently unmeasured

---

## Guiding strategy

The pricing plan defines the engine: **Basic builds the habit → Plus monetizes the anti-subscription/privacy segment at high margin → Pro drives MRR through multi-device safety and couple/household collaboration.** Every roadmap phase below either hardens that ladder or adds the next rung (shared ledger).

---

## Phase 1 — Trust the cloud (next ~2–3 weeks)

Goal: a Pro subscriber should never lose a change or wonder whether sync worked. This is the prerequisite for selling 1+1 and shared ledgers.

| Priority | Item | Definition of done |
|---|---|---|
| P0 | Sync retry/backoff across restarts | Queued writes resume automatically after network failure or app relaunch; transient failure never silently drops a change |
| P0 | Foreground/real-time refresh | Cross-device edits appear on app foreground (snapshot listener or resume-triggered pull) |
| P0 | Sync status UX | Last-synced time, pending badge, and recoverable error states in Settings |
| P1 | Two-device validation + tests | Documented two-device behavior; automated coverage for queue processing, merge, tombstones, push/pull recovery |
| P1 | IAP end-to-end verification | Purchase / cancel / restore / signed-in↔out transitions verified on device against live App Store products |

## Phase 2 — Pro 1+1 seat sharing (Phase 1 of the entitlement plan)

Goal: one Pro subscription grants a second person Pro capability — the promotional hook for the couple/household segment — without touching the data model yet.

- Backend authorization layer: owner + one assignable guest seat (Cloud Functions or equivalent; RevenueCat stays the purchase source of truth, the app adds its own sharing grant)
- Invite / accept / revoke flows in Settings; guest gets cloud sync on **their own** data
- Entitlement resolution becomes `isPro = ownRevenueCatPro || activeGuestSeat`
- Abuse guards: one active guest, seat transfer cooldown, seat drops when the owner's subscription lapses
- Explicit non-goal (per plan doc): shared ledger data stays out of this phase

## Phase 3 — Shared ledger (Phase 2 of the entitlement plan)

Goal: deliver the collaboration value Pro is priced on — the couples/family use case from the pricing plan.

- Shared ledger data model in Firestore (shared space distinct from personal `users/{uid}` data), with personal vs. shared views
- Membership, permissions, and leave/transfer flows
- Split-payment / who-paid tracking and settle-up summaries (代墊與拆帳)
- Conflict handling beyond last-write-wins where two members edit the same shared record

## Phase 4 — Reach and platform expansion

- **Android launch**: the Gradle project and EAS profiles exist; needs device QA (auth, IAP, dictation permissions), Play Store products in RevenueCat, and store listing
- **Native voice input** on iOS/Android (currently web-only Web Speech API), if voice remains a product bet
- **Facebook sign-in** re-enabled behind runtime availability checks, or explicitly dropped to simplify the auth matrix
- **Plus tier completion**: ship Face ID / Touch ID lock promised in the pricing plan for Plus

## Continuous engineering track (runs alongside every phase)

- **Expo SDK 57 upgrade** — currently one major behind; do it before Phase 2 lands to avoid upgrading mid-feature. Interim: `npx expo install --check` to clear the 14 outdated SDK-56 packages, `npm audit fix` for the non-breaking transitive fixes
- **Analytics baseline** — activation, retention, paywall funnel, Plus-vs-Pro conversion; without it the pricing ladder can't be tuned
- **Test depth** — extend beyond utilities into storage hooks, entitlement mapping, and sync integration paths; keep the production-readiness repo-safety tests
- **Release automation** — the iOS flow is well-documented but manual; consider scripting version bump + env verification, and stand up the Android equivalent
- **Docs hygiene** — `CURRENT_CAVEATS_AND_NEXT_PERIOD.md` (dated 2026-04-27) is stale on several points (free limit now 50, Google sign-in live, CI exists); fold status updates into this roadmap going forward

---

## Explicit non-goals for now

Carried over from the caveats doc and still sound:

- Large UI redesigns (the June design-system work in `docs/DESIGN_SYSTEM.md` covers tokenization; no visual overhaul)
- Category system expansion
- Web-first feature work that doesn't advance native readiness
- Advanced onboarding experiments before analytics exist to measure them

## Success criteria by end of Phase 2

- Zero known paths where a Pro user's change is silently lost
- Sync state is always visible and recoverable in-app
- 1+1 seat sharing live and purchasable; guest activation measured
- Expo SDK current; npm audit clean of high/critical items
- Analytics answering: activation rate, D7 retention, paywall view→purchase conversion per tier
