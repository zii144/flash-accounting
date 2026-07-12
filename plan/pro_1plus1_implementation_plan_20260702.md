# Pro 1+1 Seat Sharing — Implementation & Action Plan

Date: 2026-07-02
Spec: `plan/pro_1plus1_entitlement_plan_20260609.md` (product rules, data model, risks)
Scope: **Phase 1 only** — share the Pro entitlement, not the ledger. Guest gets Pro capability on their own data.

This document turns the spec into an executable plan: concrete decisions, file-level changes, milestones with acceptance gates, and test/rollout steps.

---

## 0. Current-state anchors (verified in code, 2026-07-02)

| Fact | Location |
|---|---|
| Pro is resolved purely from RevenueCat `customerInfo` | `contexts/ProContext.tsx` → `resolveStoragePlan()` |
| Cloud sync gate is `Boolean(user?.uid && isPro)` | `hooks/useConsumptionStorage.ts:346`, `components/SettingsScreen.tsx:62` |
| Manual push/pull also gated on `isPro` | `hooks/useConsumptionStorage.ts:825,834` |
| RevenueCat app user ID is already the Firebase `uid` | `syncRevenueCatCustomerProfile()` in `utils/revenuecat-service.ts` (called from `ProContext`) |
| Firebase client wraps app/auth/firestore only | `utils/firebase.ts` (`getFirebase()`) — no `firebase/functions` yet |
| No backend exists | no `functions/` directory |
| Free-limit enforcement reads `cloudEnabled` | `useConsumptionStorage.ts:580` — must keep working when gate changes |

The last row matters: `hasEffectivePro` must be a drop-in replacement for `isPro` at the sync gate without disturbing the Plus (`hasUnlimitedLocal`) path.

## 1. Locked decisions (recommendations where the spec left options open)

1. **Invite mechanism: 8-character invite code, manually entered.** No deep links, no email delivery in Phase 1. Works identically across iOS/Android/web, avoids universal-link setup, and matches the spec's `inviteCode` field. `inviteeEmail` stays optional metadata.
2. **`user_access/{uid}` is the client's single source of shared-seat truth**, maintained only by the backend (Admin SDK). The client attaches one `onSnapshot` listener to its own doc — this gives near-instant guest downgrade when the owner lapses (mitigates spec Risk 2) at the cost of one document read.
3. **Effective access formula** (per spec): `hasEffectivePro = hasOwnedRevenueCatPro || (userAccess.accessSource === "shared" && userAccess.sharedSeatState === "active")`. RevenueCat remains authoritative for *owned*; the backend is authoritative for *shared*. If `user_access` is missing/unreadable, degrade to owned-only (never block a paying owner on backend availability).
4. **Backend runtime: Firebase Cloud Functions (2nd gen, TypeScript) + Firestore**, same project as existing auth/Firestore. Prerequisite: project must be on the Blaze plan — confirm before Milestone 1 starts.
5. **Seat lifecycle policy** (from spec): grace period keeps the seat; expiration/refund/revocation revokes it. Reassignment cooldown 24 h; max 2 reassignments per rolling 30 days.
6. **Copy rule** (spec Risk 1): every surface says "shares Pro *features* with 1 partner — each of you keeps your own records." Never imply a shared ledger, and never imply Apple Family Sharing.

## 2. Architecture at a glance

```
RevenueCat webhook ──► syncRevenueCatWebhook (CF)
                              │ updates
                              ▼
                subscription_accounts/{ownerUid}     ◄── createShareInvite /
                  ├── invites/{inviteId}                  acceptShareInvite /
                  └── members/{memberUid}                 revokeSharedSeat (callable CFs)
                              │ projects to
                              ▼
                      user_access/{uid}  ──onSnapshot──►  ProContext (client)
                                                            │
                                              hasEffectivePro = owned ∥ shared
                                                            │
                                              cloud sync gate + Settings UI
```

Clients never write sharing documents; all writes go through callable functions and the webhook (enforced by Firestore rules).

## 3. Workstreams and tasks

### Workstream A — Backend foundation (new `functions/` package)

**A1. Scaffold `functions/`** — TypeScript, `firebase-admin`, `firebase-functions` v2, emulator config in `firebase.json`, deploy script in root `package.json` (`deploy:functions`). Keep it out of the app's Metro/tsconfig graph.

**A2. Data model + seat state machine.** Implement the spec's collections exactly (`subscription_accounts`, `members`, `invites`, `user_access`, `entitlement_audit_logs`). Encode seat transitions as a pure, unit-testable module:

```
shareState: empty → invited → occupied → empty (revoke/expire/refund)
invite:     pending → accepted | expired | cancelled
member:     active → revoked | expired
```

Every transition writes an `entitlement_audit_logs` entry (actor, cause, before/after).

**A3. Callable functions** (all require `context.auth`):
- `createShareInvite({inviteeEmail?}) → {inviteId, inviteCode, expiresAt}` — verifies caller owns an active/grace Pro (via RevenueCat REST API `GET /subscribers/{uid}` server-side, not client claims); rejects if an active guest exists and cooldown/reassignment caps are unmet. Invite TTL: 72 h.
- `acceptShareInvite({inviteCode})` — validates invite pending + unexpired, re-verifies owner Pro at accept time, rejects if guest already occupies another seat; creates member, flips invite to accepted, updates both `user_access` docs atomically (transaction).
- `revokeSharedSeat()` — owner-only; revokes member, resets `shareState`, stamps `lastSeatChangedAt` (cooldown anchor), downgrades guest's `user_access`.
- `cancelShareInvite()` — owner cancels a pending invite (needed for the UI; trivial).
- *(Skip `getMyEffectiveAccess` as an endpoint — the `user_access` snapshot listener replaces it. Keep a callable fallback only if listener reliability proves problematic in testing.)*

**A4. `syncRevenueCatWebhook` (HTTPS).** Verifies the RevenueCat `Authorization` header secret; handles `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `CANCELLATION`, `BILLING_ISSUE`, `EXPIRATION`, `REFUND`, `TRANSFER`. Maps events to `subscriptionStatus`, and on terminal states (expired/refunded/revoked) auto-revokes the guest seat. Idempotent by event ID. Configure the webhook in the RevenueCat dashboard (staging first).

**A5. Reconciliation job.** Scheduled function (every 6 h): for every `subscription_accounts` doc with an occupied seat, re-check owner entitlement against the RevenueCat REST API and correct drift (spec Risk 2 backstop for missed webhooks).

**A6. Firestore security rules.** Add: `user_access/{uid}` readable only by `uid`; `subscription_accounts/{ownerUid}` readable by owner (and its `members/{uid}` by that member); `invites` owner-read only; **no client writes** to any of these. Cover with emulator rules tests, including "client attempts to grant itself shared pro".

### Workstream B — Client integration

**B1. `utils/firebase.ts`** — extend `getFirebase()` with `functions` (`getFunctions` + `httpsCallable`), respecting the existing "unconfigured → null" degradation.

**B2. `utils/entitlement-sharing.ts` (new)** — typed wrappers for the four callables + a `subscribeUserAccess(uid, cb)` snapshot helper; error mapping into the existing `AppError` pattern (`SHARE_INVITE_EXPIRED`, `SHARE_SEAT_OCCUPIED`, `SHARE_COOLDOWN_ACTIVE`, `SHARE_OWNER_NOT_PRO`, …).

**B3. `contexts/ProContext.tsx`** — add per the spec:
- state: `userAccess` (from the snapshot listener, keyed to `user?.uid`; cleared on sign-out)
- derived: `hasEffectivePro`, `proAccessSource: "owned" | "shared" | "none"`, `sharedSeatInfo`
- actions: `createShareInvite`, `acceptShareInvite`, `revokeSharedSeat`, `cancelShareInvite`, `refreshEffectiveAccess`
- keep `isPro` (owned-only) exported for paywall/purchase surfaces; it changes meaning nowhere.

**B4. Gate swap** — change `cloudEnabled` to `Boolean(user?.uid && hasEffectivePro)` at `hooks/useConsumptionStorage.ts:346` and `components/SettingsScreen.tsx:62`, and the guards at `useConsumptionStorage.ts:825,834`. Verify the free-limit branch (`:580`) and `needsAccountForActivePro` logic in Settings still behave for: owned Pro, shared Pro, Plus-only, free.

**B5. Settings UI — new `components/SharedSeatSection.tsx`**, rendered inside the existing cloud section of `SettingsScreen`:
- *Owner view*: seat status (empty/invited/occupied), "Invite partner" → shows code + share sheet (`expo-sharing`), cancel pending invite, revoke guest (confirm dialog), cooldown notice.
- *Guest view*: "Enter invite code" flow; when active: "Pro shared by {ownerDisplayName}"; when revoked/expired: clear downgrade message + upgrade CTA.
- Render only when signed in and Firebase + RevenueCat configured; import-safe when not (house rule from the auth work).

**B6. i18n** — add all new strings to `contexts/LanguageContext.tsx` for en/zh/es/fr/de/ja. Draft zh + en first (marketing tone per spec copy rules), machine-assist the rest, review before release.

**B7. Paywall/marketing copy** — update Pro tier copy: "1 subscription, 2 people" with the explicit "separate records" disclaimer (spec Risk 1). Touches paywall config in RevenueCat dashboard + Settings copy.

### Workstream C — Ops, risk, and QA

**C1. Tests.**
- Backend: unit tests for the seat state machine + invite validation; emulator integration tests for each callable happy path and every rejection path; webhook event-to-state table test; rules tests (A6).
- Client: extend `tests/` with `entitlement-sharing.test.ts` (error mapping, access-resolution formula: owned×shared matrix incl. "guest who buys their own Pro stops occupying the seat" — spec resolution rule) and update `revenuecat.test.ts` if `resolveStoragePlan` grows.
- Manual two-device matrix (from spec test cases): owner purchase → invite → accept → guest syncs; owner cancel-but-active; owner expiration → guest auto-downgrade (measure latency); refund; revoke; reassign inside/outside cooldown; guest sign-out/in; airplane-mode accept retry.

**C2. Feature flag.** `EXPO_PUBLIC_SHARE_1PLUS1_ENABLED` gates all UI entry points; backend deploys ahead of client unflagged. Lets 1.0.5 ship with the flag off if store review timing demands.

**C3. Support tooling.** Minimal admin script (`scripts/admin/seat-inspect.ts`, Admin SDK, run locally) to look up an owner/guest state and force-revoke; a short `docs/SHARING_SUPPORT.md` runbook: how to read audit logs, common tickets (code expired, seat stuck, "why did I lose Pro").

**C4. Store compliance check.** Sharing unlocks your *own service* (cloud sync), not App Store content, so it's review-safe in principle — but re-read the paywall copy against App Review guidelines before submission (continuation of the existing "cloud service unlock" wording task in `docs/CURRENT_CAVEATS_AND_NEXT_PERIOD.md` §P1).

## 4. Milestones, sequencing, estimates

Prerequisite (½ d): Blaze plan enabled; RevenueCat webhook secret + REST API key provisioned; staging Firebase project or emulator strategy agreed.

| Milestone | Contents | Est. | Exit gate |
|---|---|---|---|
| **M1 — Entitlement infrastructure** | A1–A2, A4, A6, B1 | 4–5 d | Webhook events from RevenueCat sandbox update `subscription_accounts` + `user_access` correctly; rules tests green; client can read its own `user_access` |
| **M2 — Invite/accept/revoke flows** | A3, B2, B3, B5 (behind flag), B6 draft | 4–5 d | On emulator + dev client: owner invites, guest accepts, `ProContext` reports `shared` source; revoke downgrades guest in < 5 s |
| **M3 — Sync gate integration** | B4, C1 client tests, two-device matrix | 2–3 d | Guest's cloud sync works end-to-end on device; owner expiration auto-downgrades guest and their sync stops; all four plan states behave at the free-limit boundary |
| **M4 — Hardening & launch prep** | A5, C1 backend suite complete, C2–C4, B7, i18n review | 2–3 d | Reconciliation corrects a manufactured drift; audit log covers every transition; copy reviewed in zh + en; flag-on TestFlight build passes the manual matrix |

Total ≈ **13–16 working days** (~3 weeks solo). Critical path: M1 → M2 → M3; C3/C4/B7 parallelize inside M4.

## 5. Acceptance criteria (roll-up from spec, restated testably)

Product: owner sees the seat entry after purchase; invite→accept→Pro works; revoke works; owner lapse auto-revokes; guest UI always shows *who* shares and *that it's shared*.
Technical: final Pro decision is never RevenueCat-only on the client; webhook + reconciliation keep `user_access` correct within minutes; Firestore rules block all client-side seat writes; shared guest sync passes the existing sync test scenarios.

## 6. Out of scope (Phase 2, do not let it creep in)

Shared ledger/household model, split payments & settle-up, multi-seat family plans, invite notifications/inbox, real-time collaboration. Data model for these is sketched in the spec (`households/*`) and starts only after Phase 1 ships and 1+1 uptake is measured.
