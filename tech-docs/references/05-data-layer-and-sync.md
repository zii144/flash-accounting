# 05 — Data Layer & Sync

Local-first: **SQLite** (`flash_accounting.db`, via `expo-sqlite`) is the source of truth on
device. **Firestore** is an optional cloud mirror, gated behind the Pro entitlement. AsyncStorage
holds legacy data (migrated once), glossary preferences, and language/palette settings.

## SQLite schema

**Connection** — `utils/db.ts`: `openDatabase()` is a singleton opening `flash_accounting.db`.
Thin helpers `run()`, `getAll<T>()`, `getFirst<T>()`, and `transaction(operations)` which prefers
`withExclusiveTransactionAsync` on native (proper locking) and `withTransactionAsync` on web.

**Schema** — `utils/db-schema.ts`, created in `initializeSchema()`.

### `consumptions` — the ledger table
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PRIMARY KEY NOT NULL | app-generated string id |
| `amount` | REAL NOT NULL | always positive magnitude; sign derived from `type` |
| `description` | TEXT NOT NULL | free text; drives category grouping |
| `type` | TEXT NOT NULL DEFAULT `'expense'` | `'expense'` \| `'income'` |
| `category` | TEXT | nullable; **not** used for chart grouping (description is) |
| `date` | TEXT NOT NULL | ISO string — the transaction date |
| `createdAt` | TEXT | ISO |
| `updatedAt` | TEXT | ISO — the **sync revision clock** |
| `deletedAt` | TEXT | ISO or NULL — soft-delete tombstone |

Indexes: `date DESC`, `amount DESC`, `category`, `deletedAt`.

### `db_metadata` — key/value store
`key TEXT PRIMARY KEY`, `value TEXT`. Holds the AsyncStorage-migration flag and per-user sync
metadata (`sync:pending_local_changes:{uid}`, `sync:last_synced_at:{uid}`,
`sync:last_error_at:{uid}`, `sync:last_error_message:{uid}`).

### `sync_queue` — offline write queue
| Column | Type |
|---|---|
| `id` | INTEGER PK AUTOINCREMENT |
| `uid` | TEXT NOT NULL |
| `consumptionId` | TEXT NOT NULL |
| `payload` | TEXT NOT NULL (JSON `Consumption`) |
| `createdAt` | TEXT NOT NULL |

Indexes: `(uid, createdAt)` and a **UNIQUE** `(uid, consumptionId)` — this backs the
upsert-on-conflict dedup so each record has at most one pending queue entry per user (coalesces
rapid edits).

### Migration strategy
- **No numbered versioning.** A `DB_VERSION` constant is commented out; there's no `PRAGMA
  user_version` and no migration runner.
- **Additive, idempotent DDL.** `CREATE TABLE IF NOT EXISTS`; column additions are blind
  `ALTER TABLE … ADD COLUMN` wrapped in `try/catch {}` swallowing "duplicate column". A one-time
  backfill sets `createdAt`/`updatedAt` from `date` via `COALESCE`.
- **AsyncStorage → SQLite migration** (`migrateFromAsyncStorage()`): guarded by a flag in
  `db_metadata`, bulk-inserts legacy records with `INSERT OR IGNORE`, clears the old key. Failures
  are logged, not thrown, so the app still boots and retries next launch.
- **Init orchestration**: `initializeDatabase()` memoizes a single init promise (schema →
  migration); on failure it nulls the promise to retry. Every query path first calls
  `ensureDatabaseInitialized()`.

## Core data model

`types/consumption.ts`: `ConsumptionType = 'expense' | 'income'`; `interface Consumption { id,
amount, description, type, category?, date, createdAt, updatedAt, deletedAt? }`.

- **Sign convention** (`utils/ledger.ts`): amounts stored as positive magnitudes; sign applied at
  read time — `getSignedAmount(entry)` = `+amount` (income) / `-amount` (expense);
  `calculateNetTotal(entries)` sums signed amounts.
- **Factory / normalization** (`utils/consumption-record.ts`): `createConsumptionRecord()` and the
  universal read-time `normalizeConsumptionRecord()` fill defaults (`type ?? "expense"`, timestamps,
  numeric `amount`). `markConsumptionDeleted(record, deletedAt)` sets `deletedAt` and bumps
  `updatedAt` (soft delete). `getConsumptionRevision()` = `updatedAt || createdAt || date` — the
  conflict-resolution clock.

## The sync engine

Split across three layers:

### 1. Firestore access — `utils/cloud/consumptions.ts`
- Path: `users/{uid}/consumptions/{id}`. Firebase lazily initialized from `EXPO_PUBLIC_FIREBASE_*`;
  throws `FIREBASE_NOT_CONFIGURED` if absent.
- `cloudGetSnapshot(uid)` reads **all** docs including tombstones; `cloudGetAll` filters to active;
  `cloudSave` is `setDoc(..., { merge: true })`; `cloudUpsertMany` writes in **chunks of 450**;
  `cloudClearAll` writes tombstones (never hard-deletes).
- ⚠️ No server-side query/pagination — cloud reads pull the whole user snapshot and slice/filter in
  memory, so they scale linearly with record count.

### 2. Merge & conflict resolution — `utils/sync.ts`
- `compareConsumptionRevisions(a, b)`: **last-write-wins by `updatedAt`** (ISO string compare).
  Tie-break: (1) revision string, (2) **the deleted record wins** (tombstone precedence), (3) `date`.
- `mergeConsumptionSnapshots(local, cloud)`: `Map` by id over `[...cloud, ...local]`, keeps whichever
  wins `compareConsumptionRevisions`; returns sorted by `updatedAt` desc — the bidirectional merge.
- `getActiveConsumptions(snapshot)`: drops tombstones, sorts by `date` desc — the UI shape.
- `buildCloudSyncPlan(local, cloud)`: the **push set** — local records absent in cloud or strictly
  newer, ordered oldest-first.

### 3. Orchestration & offline queue — `hooks/useConsumptionStorage.ts`
`cloudEnabled = Boolean(user?.uid && isPro)` — cloud sync runs only for authenticated Pro users.

- **Sync status** is a state machine derived from metadata: `syncing → pending → error → idle`.
- **Offline queue**: `queueSyncConsumption` uses `INSERT … ON CONFLICT(uid, consumptionId) DO UPDATE`
  (coalesce). `processPendingCloudSync(uid)` drains the queue via `cloudSave`; on error it clears
  **only already-processed ids** and rethrows (partial-progress-safe).
- **Full sync — `synchronizeCloudState(uid, options)`** (de-duped via an in-flight ref):
  - *Normal path*: fetch local + cloud snapshots in parallel → `mergeConsumptionSnapshots` →
    `replaceLocalSnapshot` (DELETE + re-insert of the merged set in one transaction) →
    `buildCloudSyncPlan` → enqueue each → `processPendingCloudSync`. This is push + pull reconciliation.
  - *Discard-local path* (`discardLocalPendingChanges: true`): overwrite local with cloud + wipe the
    queue — a "pull, force cloud wins" recovery.
  - On success, clears pending/error metadata and stamps `lastSyncedAt`; on error records it and rethrows.
- **Write operations** (each: validate → local upsert → optimistic UI update → if cloud, enqueue +
  mark pending + fire-and-forget background sync):
  - `saveConsumption`: rejects missing id/date and `amount <= 0`/NaN with `AppError`; enforces the free
    limit.
  - `updateConsumption`: requires an existing, non-deleted record; preserves `createdAt`, bumps `updatedAt`.
  - `deleteConsumption`: cloud → soft delete + tombstone enqueue; local-only → hard `DELETE`.
  - `clearAll`: cloud → tombstone every active record + enqueue; local → `DELETE FROM consumptions`.
  - `importConsumptions`: validate/normalize each, enforce free limit against `totalCount + count`,
    bulk-insert in a transaction, enqueue all if cloud.
  - `syncLocalToCloud` / `pullCloudToLocal`: manual triggers (Settings); require `uid && isPro` or throw
    `CLOUD_SYNC_NOT_AVAILABLE`. Pull uses the discard-local path.
- **Init / mode switching**: re-initializes when the "mode key" (`cloud:{uid}` vs `local`) changes —
  i.e. login/logout or Pro-status change.

**Conflict model summary**: last-write-wins on `updatedAt`; tombstones beat live records on tie; soft
deletes propagate as tombstones; offline edits buffered in `sync_queue` and flushed opportunistically
with partial-progress-safe recovery. Known gaps (see [15](15-roadmap-and-caveats.md)): no real-time
Firestore listener, no retry/backoff across app restarts, no user-facing conflict history.

## Validation — `utils/validation.ts`

Constants: `MAX_AMOUNT = 999,999,999.99`, `MIN_AMOUNT = 0.01`, `MAX_DESCRIPTION_LENGTH = 500`.

- `validateAmount`: strips commas, `parseFloat`; errors on NaN, `<= 0` (unless `allowZero`), `< 0`,
  `> MAX_AMOUNT`, and (string input) **> 2 decimal places**.
- `validateDescription`: optional; errors if > 500 chars or all-whitespace-but-nonempty.
- `validateType`: must be `expense`/`income`.
- `validateConsumption` / `validateConsumptionObject` compose the above (the object variant also
  requires `id` and a parseable `date`).
- Sanitizers: `sanitizeDescription` (trim + slice 500), `sanitizeDescriptionLive` (slice only, for live
  typing), `sanitizeAmount` (strips non-digit/dot, collapses dots, caps 2 decimals).

> Note: the storage hook applies a lighter guard (`amount <= 0 || NaN`) at write time; the 2-decimal
> and MAX_AMOUNT caps are enforced at the **input-UI layer**, not at DB write. Display formatting caps
> decimals at 2 (`utils/formatting.ts`).

## CSV import / export

- **Export** — `utils/export.ts` `buildConsumptionsCsv()`: header `Date,Type,Amount,Description,Category`;
  rows use `date.toISOString()`, `type`, `amount.toFixed(2)`, description, category; every cell RFC-4180
  quoted (inner quotes doubled). (A `locale` arg is accepted but ignored.)
- **Import** — `utils/csv-import.ts` `parseConsumptionsCsv()`: a custom RFC-4180 tokenizer handling quoted
  fields, escaped `""`, and `\n`/`\r`/`\r\n`. Header aliases (`date`/`time`→date, plus type/amount/
  description/category); **required columns: date, type, amount**. Per-cell parsers with 1-based row
  numbers in error messages; each row → `createConsumptionRecord` with a generated id. The parsed array
  is handed to `importConsumptions`.

## Statistics / diagram aggregation

Two layers:

- **SQL stats** — `hooks/useConsumptionStats.ts`: `buildTimeFilterClause` builds parameterized WHERE
  for `today`/`week`(−7d)/`month`(1st)/`year`(Jan 1) or an inclusive `customRange` (expanded to full
  local days via `date-utils`); always `deletedAt IS NULL`. `getStats` computes totals/counts/`netTotal`/
  `logDay` in one query. `getGroupedByDay`/`getGroupedByMonth` group in SQL by local-time key
  (`DATE(date,'localtime')` / `strftime('%Y-%m', …)`), then bucket rows into `GroupedConsumption { date,
  consumptions[], total }` where `total` is the **signed net**, paginated by slicing.
- **Chart shaping** — `utils/diagram-data.ts` (pure, in-memory over already-filtered records):
  - `buildCategoryBreakdown`: **pie/treemap** data — filters to `expense`, groups by the **canonical
    label of `description`** (glossary canonicalizer), computes `{label, amount, count, percentage}`,
    sorted amount desc.
  - `buildCategoryDetail`: drill-down list for one slice.
  - `buildTrendSeries`: **line/bar over time** — keyed by month (all/year) else day; accumulates
    expense/income/net per bucket; **capped to the last 14 buckets**.
  - `buildDiagramSummary`: headline tiles — expense/income/net totals, top category, average expense
    per active day.

Because grouping keys off the glossary-canonicalized description (not the stored `category` column),
the same heuristic that suggests names also drives chart categories — see [06](06-smart-features.md).

## Seed / demo data

- **Runtime** (`utils/seed-data/`): `generateSeedRecords(locale, options)` uses a deterministic
  **mulberry32 PRNG** (seeded `20260530 + locale.charCodeAt(0)`) to build recurring monthly records
  (rent/salary/subscriptions) + weighted-random daily records (~150 over ~90 days). Localized for
  `SUPPORTED_SEED_LOCALES = [en, zh, es, fr, de, ja]`. `seedDemoExpenses` bulk-inserts. Exposed via the
  `__DEV__` Settings section and `npm run seed:expenses*`.
- **Offline CLI** (`scripts/seed/`): writes JSON batches to `scripts/seed/output/` (dev-only, not part of
  the app runtime).

## Incidental bugs flagged during mapping

- `saveConsumption` increments `totalCount` **unconditionally** even when overwriting an existing id —
  a save that overwrites a record can over-count against the free limit.
- Cloud reads always pull the full user snapshot (no server-side pagination) — linear scaling concern.
