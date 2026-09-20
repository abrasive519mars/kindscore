# Phase 1 — The engine

**Goal:** every rule of the game as pure TypeScript, proven correct by tests, before any database or screen exists.
**Grades:** PRD §16 "Data handling — accuracy of score logic, draw engine, and prize calculations."
**Done when:** `pnpm test` green · `pnpm test:coverage` ≥ 100% lines/functions, 95% branches on `src/engine` · `pnpm lint` enforces the import guard · every file explained to the owner.

---

## 1. Boundaries

`src/engine/` may import **only** from `src/config/` and from itself. Never `next`, `react`, `@supabase/*`, `stripe`, `node:*`. Enforced by ESLint `no-restricted-imports` scoped to `src/engine/**`.

Consequences:

- No `async`. No I/O. No `Date.now()` inside a rule — time is passed in.
- No `Math.random()` inside a rule — randomness is passed in.
- Every function is a pure mapping: same inputs → same output. That is what makes the tests trustworthy.

## 2. Conventions

| Thing       | Representation                                 | Why                                                                                             |
| ----------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Money       | `number`, integer paise (`Paise` branded type) | Exact arithmetic; `bigint` would complicate JSON/React; ₹90 trillion headroom                   |
| Percentages | `number`, basis points (`Bps`), 10 000 = 100%  | Integer math, no float drift                                                                    |
| Dates       | `"YYYY-MM-DD"` strings (`IsoDate`)             | "One score per date" is a calendar date in `Asia/Kolkata`; no `Date` objects cross the boundary |
| Timestamps  | ISO-8601 strings                               | Same reason; comparisons are string comparisons                                                 |
| Randomness  | `Rng = () => number` in [0, 1)                 | Injected; `secureRng` in production, `sequenceRng([...])` in tests                              |
| Errors      | `AppError` subclasses from `engine/errors.ts`  | Carry `code`, HTTP `status`, `userMessage` for the layers above                                 |
| Constants   | `src/config/constants.ts` only                 | No number appears twice                                                                         |

Functions ≤ 20 lines, early-return guards, intention-revealing names, comments only where the logic is non-obvious.

## 3. Files, in build order

Each file: write → test → explain. Later files depend on earlier ones.

### 3.1 `engine/errors.ts` ✅

`AppError(code, status, userMessage)` and eight subclasses (400 Validation · 401 Authentication · 403 Forbidden / SubscriptionRequired · 404 NotFound · 409 Conflict · 422 RuleViolation · 502 ExternalService). `isAppError()` guard.

### 3.2 `engine/money/paise.ts` ✅

| Function                             | Contract                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `assertPaise(value)`                 | throws `ValidationError` unless a non-negative safe integer                                                                                |
| `applyBps(amountPaise, bps)`         | `floor(amount × bps / 10 000)`                                                                                                             |
| `splitEqualPaise(totalPaise, count)` | `count` shares; `floor(total/count)` each; the first `total mod count` shares get +1 paisa; **sum is exactly `total`**; `count = 0` → `[]` |
| `formatInr(paise)`                   | `"₹1,80,000"` via `Intl.NumberFormat("en-IN")`, no decimals when whole rupees, `"₹2,500.50"` otherwise                                     |

### 3.3 `engine/charity/splitPayment.ts`

| Function                                | Contract                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateCharityBps(bps)`               | `CHARITY_MIN_BPS ≤ bps ≤ CHARITY_MAX_BPS` and a multiple of `CHARITY_STEP_BPS`, else `ValidationError`                                                                                                    |
| `splitPayment(amountPaise, charityBps)` | `pool = applyBps(amount, POOL_SHARE_BPS)`; `charity = applyBps(amount, charityBps)`; `platform = amount − pool − charity`. **Invariant:** the three sum to `amount`; platform ≥ 0 (guaranteed by the cap) |

Worked example: `splitPayment(49_900, 1_000)` → charity 4 990 · pool 14 970 · platform 29 940. At 7 000 bps → platform 0.

### 3.4 `engine/scores/validateScore.ts`

`validateScore(input: unknown): number` — integer, `SCORE.MIN ≤ n ≤ SCORE.MAX`; rejects `0`, `46`, `1.5`, `"abc"`, `""`, `null`. Accepts `1` and `45`.

### 3.5 `engine/time/dates.ts`

Generic calendar-date helpers; used by scores (played-on), draws (draw month) and subscriptions (period end).

| Function                         | Contract                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `isIsoDate(value)`               | `/^\d{4}-\d{2}-\d{2}$/` **and** a real calendar date (rejects `2026-02-30`)                                       |
| `todayInTimezone(now: Date, tz)` | `"YYYY-MM-DD"` via `Intl.DateTimeFormat(…, { timeZone })`. 2026-09-12T19:00Z with `Asia/Kolkata` → `"2026-09-13"` |
| `compareIsoDates(a, b)`          | −1 / 0 / 1; string comparison is valid for this format                                                            |
| `isFutureDate(date, today)`      | `date > today`                                                                                                    |

### 3.6 `engine/scores/latestFive.ts`

PRD §05 "only the latest 5 scores are retained; a new score replaces the oldest" as functions.

```ts
interface ScoreEntry { id: string; score: number; playedOn: IsoDate; createdAt: string }
```

| Function                                     | Contract                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sortNewestFirst(entries)`                   | by `playedOn` desc, then `createdAt` desc (stable tiebreak)                                                                                                                                                                          |
| `selectRetainedScores(entries)`              | `{ retained: first WINDOW_SIZE, evicted: the rest }`                                                                                                                                                                                 |
| `findEntryOnDate(entries, playedOn)`         | the entry or `undefined`                                                                                                                                                                                                             |
| `isBackdatedBeyondWindow(playedOn, entries)` | true iff `entries.length ≥ WINDOW_SIZE` and `playedOn` < every retained `playedOn`                                                                                                                                                   |
| `previewAddScore(entries, candidate)`        | duplicate date → `ConflictError("You already logged a round on {date} — edit it instead")`; backdated → `RuleViolationError("That round is older than your five kept rounds")`; else `selectRetainedScores([...entries, candidate])` |

The DB trigger in Phase 2 implements the same eviction; this is its testable twin and powers the UI preview ("this will replace your 19 Aug score").

### 3.7 `engine/draw/rng.ts`

`Rng` type · `secureRng()` from `globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2**32` · `sequenceRng(values)` returns values in order and throws when exhausted (a test that consumes more randomness than expected fails loudly).

### 3.8 `engine/draw/eligibility.ts`

```ts
interface EligibleEntry { userId: string; scores: readonly number[] }
```

`isEligibleTicket(scores)` — exactly `SCORE.WINDOW_SIZE` scores. (Active subscription is checked by the service layer; the engine only knows about scores.)

### 3.9 `engine/draw/frequency.ts`

| Function | Contract |
|---|---|
| `buildFrequencyMap(entries)` | for each entry, count each **distinct** score once (a user with `33, 33, …` adds 1 to 33, not 2) → `ReadonlyMap<number, number>` |
| `smoothFrequency(freq)` | `smoothed(n) = Σ_k KERNEL[k] · freq(n+k)` for k in −2..2 with `DRAW.SMOOTHING_KERNEL = [0.25, 0.5, 1, 0.5, 0.25]`; neighbours outside 1..45 are ignored. **[decision]** With a few hundred users the raw tally is noisy (31 might have 9 holders while 30 and 32 have 40); smoothing makes the draw follow the *shape* of how golfers score |

### 3.10 `engine/draw/generateNumbers.ts`

| Function                                        | Contract                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `buildWeights(mode, freq)` | array indexed 1..45: random → `1` each; algorithmic → `ALGORITHMIC_BASELINE_WEIGHT + smoothFrequency(freq)(n)`. **[decision]** The baseline keeps every number possible; the PRD never says a never-scored number is impossible |
| `pickWeightedIndex(weights, r)`                 | `r ∈ [0,1)` × total weight, walk cumulative sums; pure                                                             |
| `sampleWithoutReplacement(weights, count, rng)` | pick, zero that weight, repeat `count` times                                                                       |
| `generateNumbers(mode, freq, rng)`              | `sampleWithoutReplacement(buildWeights(...), NUMBERS_DRAWN, rng)` sorted ascending; **always 5 distinct in 1..45** |

Empty frequency map in algorithmic mode degrades to uniform (baseline only) — the "no scores yet" fallback from QA §2. Pipeline: **count → smooth → floor → weighted draw without replacement**; random mode is the same pipeline with every weight 1.

### 3.11 `engine/draw/match.ts`

| Function                       | Contract                                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| `countMatches(scores, drawn)`  | `                                                                    |
| `winningTierFor(matchCount)`   | `5 → 5`, `4 → 4`, `3 → 3`, else `null` (from `WINNING_MATCH_COUNTS`) |
| `matchEntries(drawn, entries)` | `{ userId, scores, matchCount, tier }[]` for every entry             |

### 3.12 `engine/prizes/pool.ts`

| Function                                          | Contract                                                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `monthlyEquivalentPoolPaise(interval)`            | month → `applyBps(PLANS.month.pricePaise, POOL_SHARE_BPS)` = 14 970; year → `floor(applyBps(PLANS.year.pricePaise, POOL_SHARE_BPS) / 12)` = 12 497 |
| `computePoolPaise(subscriptions: { interval }[])` | Σ over active subscribers                                                                                                                          |

### 3.13 `engine/prizes/allocate.ts`

| Function                                                  | Contract                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `splitTierPools(poolPaise, rolloverInPaise)`              | `four = applyBps(pool, 3500)`; `three = applyBps(pool, 2500)`; `jackpot = pool − four − three + rolloverIn` (jackpot absorbs rounding). **Invariant:** `jackpot + four + three = pool + rolloverIn`                                                                                                                                    |
| `allocatePrizes({ poolPaise, rolloverInPaise, matched })` | group winners by tier; per tier `splitEqualPaise(tierPool, winners.length)` assigned in `userId` order; `rolloverOutPaise = jackpot` if no 5-match else 0; `unclaimedRetainedPaise` = 4- and 3-tier pools with zero winners; returns `{ tierPools, prizes: { userId, tier, prizePaise }[], rolloverOutPaise, unclaimedRetainedPaise }` |

**Invariant tested:** Σ prizes + rolloverOut + unclaimedRetained = pool + rolloverIn, always.

### 3.14 `engine/subscription/status.ts`

| Function                                             | Contract                                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mapStripeStatus(stripeStatus)`                      | `active`, `trialing` → `active` · `past_due` → `past_due` · `canceled` → `cancelled` · `unpaid`, `incomplete`, `incomplete_expired`, `paused` → `lapsed` · unknown → `lapsed` |
| `hasActiveAccess({ status, currentPeriodEnd }, now)` | `status === "active" && currentPeriodEnd > now` — the `> now` half self-heals a missed webhook                                                                                |

### 3.15 `engine/verification/stateMachine.ts`

```ts
interface VerificationState { review: ReviewStatus; payout: PayoutStatus; resubmissions: number }
type VerificationEvent = "submit_proof" | "approve" | "reject" | "mark_paid"
```

| From               | Event        | To                   | Guard                                                               |
| ------------------ | ------------ | -------------------- | ------------------------------------------------------------------- |
| awaiting_proof     | submit_proof | submitted            | —                                                                   |
| rejected           | submit_proof | submitted            | `resubmissions < 1`; increments                                     |
| submitted          | approve      | approved             | —                                                                   |
| submitted          | reject       | rejected             | —                                                                   |
| approved · pending | mark_paid    | approved · paid      | —                                                                   |
| anything else      | —            | `RuleViolationError` | e.g. `paid → *`, `awaiting_proof → approve`, `rejected → mark_paid` |

`transition(state, event)` returns a **new** state (never mutates). `initialVerificationState()`.

### 3.16 `engine/index.ts`

Re-exports the public surface so services import from `@/engine`, not from file paths.

### 3.17 `eslint.config.mjs`

Add a block for `src/engine/**/*.ts`: `no-restricted-imports` with patterns `next*`, `react*`, `@supabase/*`, `stripe`, `node:*`. Verified by adding a deliberate bad import, seeing lint fail, removing it.

## 4. Tests — `tests/unit/engine/`

Mirrors the source tree. Cases lifted from `docs/specs/QA.md` §1:

| File                                | Must cover                                                                                                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money/paise.test.ts`               | `splitEqualPaise(3_750_000, 7)` sums exactly, first 2 get +1 (wait: 3 750 000 mod 7 = 3 750 000 − 535 714×7 = 2 → first 2); `splitEqualPaise(10, 0)` → `[]`; `formatInr(18_000_000)` → `"₹1,80,000"`; `assertPaise(1.5)` throws                                |
| `charity/splitPayment.test.ts`      | 49 900 @ 1 000 → 4 990 / 14 970 / 29 940; @ 7 000 → platform 0; 900 and 7 100 rejected; 1 050 (not a step) rejected; sum invariant over a sweep of amounts × bps                                                                                               |
| `scores/validateScore.test.ts`      | 1 and 45 accepted; 0, 46, 1.5, "abc", "", null rejected                                                                                                                                                                                                        |
| `time/dates.test.ts`              | IST midnight: `2026-09-12T19:00:00Z` → `"2026-09-13"`; `2026-09-12T18:00:00Z` → `"2026-09-12"`; `2026-02-30` invalid; future detection                                                                                                                         |
| `scores/latestFive.test.ts`             | 6th evicts oldest by `playedOn` not insert order; duplicate date → `ConflictError`; backdated beyond window → `RuleViolationError`; backdated within window accepted and evicts the correct one; 4 entries + new → nothing evicted                             |
| `draw/generateNumbers.test.ts`      | property ×1 000 both modes with `secureRng`: 5 distinct, all in 1..45, sorted; with `sequenceRng` produce a known tuple; algorithmic with empty map ≡ uniform weights; heavily weighted number is drawn first for `r = 0.5`                                    |
| `draw/match.test.ts`                | `[33,33,28,36,29]` vs `[33,12,29,36,41]` → 3; 0/1/2 → `null` tier; 5 → jackpot                                                                                                                                                                                 |
| `draw/frequency.test.ts` | duplicates within a user count once; a lone spike spreads to ±2 neighbours in kernel ratios (¼, ½, 1, ½, ¼); clips at 1 and 45; empty map → all zeros |
| `prizes/allocate.test.ts`           | 15 000 000 → 5 250 000 / 3 750 000 / 6 000 000; 1 001 sums exactly; zero eligible → jackpot rolls, 4/3 retained; jackpot won by 2 → equal split of full amount incl. rollover; **rollover chain** Jun→Jul→Aug→Sep exactly as GAME.md §6 table; invariant sweep |
| `prizes/pool.test.ts`               | 14 970 / 12 497; 300 mixed subs sums correctly                                                                                                                                                                                                                 |
| `subscription/status.test.ts`       | every Stripe status; period-end boundary                                                                                                                                                                                                                       |
| `verification/stateMachine.test.ts` | every legal path; every illegal transition throws; second resubmit throws; immutability (input state unchanged)                                                                                                                                                |

## 5. Order of work

1. money → charity (smallest, everything else uses `applyBps`)
2. time (dates) → scores (validate, latestFive)
3. draw (rng, eligibility, frequency, generate, match)
4. prizes (pool, allocate)
5. subscription, verification
6. index + lint guard
7. coverage run; fill gaps; commit `Phase 1: engine`

## 6. Explicitly not in this phase

No Supabase, no Stripe, no React, no services, no repositories. The DB trigger that mirrors `selectRetainedScores` is Phase 2. The service that calls `generateNumbers` with `secureRng` and saves the result is Phase 6.
