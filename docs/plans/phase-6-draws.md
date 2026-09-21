# Phase 6 — The draw (admin simulate → publish, member reveal, public history)

**Goal:** the admin runs a month's draw in two clicks with full sight of the result before anyone else sees it; every member then sees the five numbers against their own five scores, and what — if anything — they won; visitors see the history and the growing jackpot.
**PRD:** §06 (monthly draw, two modes, simulate before publish, three tiers), §07 (pool from active subscribers, 40/35/25, equal split, jackpot-only rollover), §10 (participation summary), §11.02 (draw management), §16.1 steps 5–7.
**Done when:** `DrawService.simulate` + `publish` are proven against local Postgres (entries snapshot, Σ invariants, stale guard, idempotent publish); the walkthrough creates 60 members, simulates in both modes, trips the stale guard, publishes, and a member watches the reveal; build/lint/tests green; committed as `Phase 6: draws`.

## 0. What already exists (nothing here is re-done)

| Layer              | Already built                                                                                                                                                                                      | Phase 6 adds                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine (Phase 1)   | `generateNumbers`, `buildFrequencyMap`, `smoothFrequency`, `matchEntries`, `allocatePrizes`, `computePoolPaise`, `secureRng`                                                                       | `entriesFingerprint`, `computePoolPaiseFromCounts`, `nextDrawMonth` — three small pure functions                                                                                                                                                                      |
| Database (Phase 2) | `draws`, `draw_entries`, `draw_results`, RPCs `save_simulation` / `publish_draw` / `next_rollover_in`, RLS (drafts admin-only; members see own entry/result after publish), `draw_statistics` view | one migration: `draw_statistics` readable by everyone for published draws (today its `security_invoker` makes tier counts collapse to "own rows" for members/anon); `active_subscriber_counts()` so the projected jackpot can be shown without exposing subscriptions |
| Shell (Phase 3)    | `/app/draws` and `/admin/draws` nav links, `ScoreRow` with `matched`                                                                                                                               | the pages behind them                                                                                                                                                                                                                                                 |

## 1. Shape of the code

```
admin action ─▶ DrawService.simulate(drawId, mode)
                  ├─ DrawRepository.listCandidates()          active members + their kept scores (one query each)
                  ├─ engine: selectEligibleEntries · computePoolPaise · buildFrequencyMap · generateNumbers(secureRng)
                  │          matchEntries · allocatePrizes · entriesFingerprint
                  └─ DrawRepository.saveSimulation(...)        → RPC save_simulation (one transaction)
admin action ─▶ DrawService.publish(drawId)
                  ├─ recompute entriesFingerprint from live candidates; ≠ stored → RuleViolationError (stale)
                  └─ DrawRepository.publish(id)                → RPC publish_draw (idempotent)
```

`DrawService` never touches Supabase; `DrawRepository` never computes a number. The RPCs persist and guard, exactly as Phase 2 designed them. Randomness is injected (`Rng`) so the service test is deterministic and the action passes `secureRng`.

**Who may see what (unchanged RLS, now actually used):** drafts and every entry/result while unpublished — admin only. After publish — a member sees the draw, _their own_ entry and result, and the per-tier winner **counts** (never other members' names). Visitors see published draws and counts. Nothing in this phase weakens a policy.

## 2. Files, in build order

### 2.1 Engine additions (pure, 100% covered)

- `engine/draw/fingerprint.ts` — `entriesFingerprint(entries)`: canonical string `userId:s1,s2,s3,s4,s5|…` (entries sorted by userId, scores as kept) → FNV-1a 64-bit hex. A change detector, not a security hash — no crypto dependency, synchronous, identical in Node and browser.
- `engine/prizes/pool.ts` — `computePoolPaiseFromCounts({ month, year })`: same maths as `computePoolPaise`, from counts. Needed because members and visitors may know _how many_ subscribers there are, never _who_.
- `engine/time/dates.ts` — `nextDrawMonth(lastPublishedMonth | null, today)`: the month after the last published draw, or today's month (IST) when none.

### 2.2 `supabase/migrations/20260921001000_draw_visibility.sql`

- `create or replace view draw_statistics` **without** `security_invoker` (runs as owner) and still `where status = 'published'` — aggregate counts of published draws are public information by design (§06 "results visible to all users").
- `active_subscriber_counts()` — `security definer`, returns `(plan_interval, count)` for `status = 'active' and current_period_end > now()`. Two integers, no PII.
- `pnpm db:reset · db:types · db:push`.

### 2.3 `repositories/interfaces/DrawRepository.ts` + `SupabaseDrawRepository`

```ts
interface DrawCandidate { userId: string; interval: PlanInterval; scores: number[] }   // kept scores, any count
interface DrawRecord { id; drawMonth: IsoDate; mode; status; numbers | null; pool fields…; entriesHash; simulatedAt; publishedAt }
interface DrawSummary /* row of draw_statistics */ { drawId; drawMonth; mode; numbers; activeSubscriberCount; poolPaise; rolloverInPaise; jackpotPoolPaise; rolloverOutPaise; publishedAt; winners: { 5: n; 4: n; 3: n }; prizesPaise }
interface MemberDrawOutcome { draw: DrawSummary; entry: { scores; matchCount } | null; prizePaise: number | null }

listCandidates(now): DrawCandidate[]                      admin: subscriptions(active, in period) ⨝ scores
findOpen(): DrawRecord | null · findById(id) · create(month): DrawRecord   (23505 → ConflictError "already has a draw")
nextRolloverIn(): Paise                                    RPC
saveSimulation(input): DrawRecord                          RPC save_simulation; P0001 → RuleViolation, 42501 → Forbidden
publish(id): DrawRecord                                    RPC publish_draw; same mapping
listResults(drawId): { userId; fullName; email; scores; matchCount; prizePaise }[]     admin, for the winners table
listSummaries(): DrawSummary[] · findSummary(drawId)       draw_statistics, newest first
listMemberOutcomes(userId): MemberDrawOutcome[]            published draws ⨝ own entry ⨝ own result
activeSubscriberCounts(): { month; year }                  RPC
```

### 2.4 `services/DrawService.ts`

- `openNextDraw(today)` → `findOpen()` ?? `create(nextDrawMonth(lastPublished, today))`.
- `simulate(drawId, mode, rng = secureRng)` → candidates → eligible → pool (`computePoolPaise` from the _same_ candidate list, so the pool and the entries describe the same moment) → `nextRolloverIn` → numbers → matched → `allocatePrizes` → fingerprint → `saveSimulation`. Returns `SimulationReport { draw, eligibleCount, ineligibleCount, numbers, weights (for the histogram), tierPools, winners by tier, rolloverOut, unclaimedRetained }`.
- `checkFreshness(draw)` → `{ stale: boolean }` by recomputing the fingerprint from live candidates.
- `publish(drawId)` → refuse when draft (`RuleViolationError "Simulate first"`), refuse when stale (`"Scores changed since simulation — re-simulate before publishing"`), else `publish`.
- `describeWeights(candidates, mode)` → the 45 weights for `Histogram45` (random → flat 1s; algorithmic → `1 + smoothed`).
- `projectedJackpot()` → `splitTierPools(computePoolPaiseFromCounts(counts), nextRolloverIn)[5]` — what the dashboard, admin overview and landing show as "this month's jackpot".

### 2.5 Admin — `(admin)/admin/draws/{page,actions}.tsx`, `draws/[id]/{page,SimulatePanel,PublishPanel}.tsx`, `components/draw/{Histogram45,WinnersTable,DrawNumbers}.tsx`

- `/admin/draws`: open-draw card (month, status badge, "Continue") or "Open {Month}'s draw" button; published history table (month, mode, numbers, winners 5/4/3, prizes, rollover out).
- `/admin/draws/[id]` (open draw): mode toggle (radio, both modes explained in one line each) + `Histogram45` (bars = how many eligible members hold each number; overlay = the weight curve for the chosen mode) → **Simulate** → the draft panel: five numbers large, "Simulated 21 Sep 18:02 · {mode}", pool breakdown (active subscribers × slice = pool; + rollover in = jackpot 40 / four 35 / three 25), eligible / ineligible counts, `WinnersTable` grouped by tier (name, email, five scores with matches in saffron, prize), rollover-out chip, unclaimed-retained line. **Re-simulate** replays. A stale draft shows a warn banner and Publish is disabled. **Publish** is two-step in place: first click reveals "Publishing makes these five numbers final for {n} members and commits {₹} in prizes. This cannot be undone." + Confirm. After publish: "Published" badge, panel goes read-only.
- Published draw page (same route): read-only report.
- Actions (`requireAdmin` → `runAction`): `openDraw`, `simulateDraw(drawId, mode)`, `publishDraw(drawId)`; `revalidatePath("/admin/draws")`, `("/app")`, `("/draws")`.

### 2.6 Member — `(member)/app/draws/{page}.tsx`, `draws/[id]/{page,DrawReveal}.tsx`, `components/draw/JackpotOdometer.tsx`

- `/app/draws`: "Next draw: {Month}" card — you're in (five scores + active) / "Enter N more rounds" / "Subscribe to be in it"; then the list of published draws with the member's outcome per draw (numbers with own matches highlighted, "3 matches · ₹2,500" / "No match" / "Not entered").
- `/app/draws/[id]` — **Draw Reveal** (DESIGN.md §4.1): server renders numbers, the member's scores, matched set, tier counts, prize. Client `DrawReveal`: first view rolls the five tiles in (`scale .96→1 + opacity`, 240ms, 80ms stagger), 400ms later matching numerals fill saffron and non-matches soften, then the outcome line resolves; jackpot → one confetti burst. `sessionStorage["draw-seen:<id>"]` → result-first on return with "Watch the draw" to replay. Reduced motion → final frame + "Play the reveal". Not entered → the draw with "You weren't in this one" and why.
- `JackpotOdometer`: fixed-width digit strips, rolls 0→value on first paint (900ms, right-to-left stagger), `en-IN` grouping, `aria-label`. Realtime updates are **out of scope** (Phase 10 polish if time allows).
- Dashboard: "Jackpot" figure becomes the odometer of `projectedJackpot()`; the Draws module shows the latest outcome + next-draw eligibility; "Draws entered" count.

### 2.7 Public — `(marketing)/draws/page.tsx`

Published history as `DrawCard`s (month, five numbers, winners 5/4/3, prizes paid out, jackpot, "rolled over ₹X" chip); empty → "First draw {Month}". ISR 60s.

## 3. Tests

- **Unit** `engine/draw/fingerprint`, `pool.fromCounts`, `dates.nextDrawMonth`; `services/DrawService.test.ts` with a fake repository and `sequenceRng`: eligible filtering (4-score member absent, counted as ineligible); pool = Σ slices of _all_ active candidates (ineligible members still fund the pool — they paid); numbers are the engine's; Σ prizes per tier = tier pool when there are winners; `rolloverOut` = jackpot when no 5-match; zero eligible → simulate succeeds, everything rolls/retains; fingerprint stored; `checkFreshness` false → true after one score changes; `publish` refuses draft / stale / passes fresh; `projectedJackpot` = 40% of counts-pool + rollover.
- **Integration** `tests/integration/drawService.test.ts` — 6 members (5 with five scores, 1 with four), admin client: `openNextDraw` → `simulate` → entries = 5, results ⊆ entries, draw row fields = report; member edits a score → `checkFreshness.stale` → `publish` throws RuleViolation → re-simulate → publish → member client sees own entry/result and `draw_statistics` counts; anon sees `draw_statistics`; second publish idempotent; `active_subscriber_counts()` matches.
- **Walkthrough** `scripts/walkthrough-phase6.ts` — 60 members, active (seeded subscriptions), five scores each drawn from a 10-number cluster (so algorithmic mode produces winners: with all tickets inside the cluster, P(≥3 matches) ≈ 50%). Admin: open draw → histogram → simulate random → screenshot → algorithmic → re-simulate → winners table → service role edits one member's score → stale banner + disabled Publish → re-simulate → Publish (two-step) → published report. Member (a winner): dashboard odometer → `/app/draws` → reveal (screenshot mid-animation and final). Public `/draws`. 390px.

## 4. Order of work

1. engine additions + tests → migration → types → repository → service + tests
2. integration test → admin pages + actions → member pages + reveal → public page → dashboard hook-up
3. walkthrough → docs (`GAME.md` decisions, `PLAN.md`, `ARCHITECTURE.md` view note) → commit `Phase 6: draws`

## 5. Explicitly not in this phase

Winner proof upload / review / payout (Phase 7 — `publish_draw` already opens the verification rows). Admin editing members' scores (Phase 9). Landing-page jackpot section and `PracticeDraw` (Phase 10 — they reuse `JackpotOdometer`, `Histogram45`, `DrawNumbers`). Realtime odometer. Seeded three-month history (Phase 11 — generated by calling `DrawService.simulate/publish` with the real engine).

## 6. Decisions made here

- **[decision] Who funds the pool vs who can win.** Every _active_ subscriber funds the month's pool (they paid); only those with exactly five scores are _in_ the draw. The admin panel shows both numbers.
- **[decision] Tier winner counts are public; winners' identities are not.** Members see "you share ₹37,500 with 14 members"; only the admin sees who.
- **[decision] The draw month is the month after the last published draw** (or the current month for the very first), so months can't be skipped or duplicated by accident; the admin can't pick an arbitrary month.
- **[decision] Staleness is checked twice** — when the admin opens the draft (banner, disabled button) and again inside `publish` — so two tabs or a slow click can never publish a result that no longer matches members' scores.
- **[decision] The projected jackpot shown before publish** = 40% of the pool the current active subscribers would fund + the carried rollover. It is a live estimate and is labelled as such; the published draw's figure is the truth.

## 7. Outcome (2026-09-21)

Done. 271 unit / 66 integration tests, build clean, walkthrough green.
Changes from the plan while building: (1) the admin list page opens the next draw with a plain form action (returns void, errors come back as `?error=`), everything else uses `useActionState`; (2) `DrawReveal` decides "first view" with `useSyncExternalStore` over sessionStorage rather than an effect that sets state — the React 19 lint rule, and it also means the server renders the final frame and the client corrects itself on hydration; (3) the reveal's numerals step down a size below `sm` (390px overflowed at `text-5xl`).
