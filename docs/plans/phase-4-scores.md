# Phase 4 — Scores

**Goal:** a subscribed member can log, edit and delete their Stableford rounds, and the five-score rule (PRD §05) holds at every layer — engine preview, service, database trigger — with the UI making the rule *felt*: a sixth round visibly bumps the oldest.
**Grades:** §16.1 "Score entry — 5-score rolling logic" · §16 "Data handling — accuracy of score logic" · §12 micro-interactions.
**Done when:** add/edit/delete work in the browser · the sixth round evicts the oldest *by date played* · duplicate date is refused inline with the existing round shown · older-than-window is refused · range/future/date validation inline · non-subscriber cannot add (guard + RLS) · unit tests for the service with a fake repository · Playwright walkthrough with screenshots at desktop and 390px · lint/typecheck/build clean.

---

## 0. Who does what

All me. No new accounts, keys or dashboard steps. Local Supabase.

## 1. The three layers, and what each one does

```
ScoreForm (client)  ──form action──▶  addScore (server action)
                                        │  requireActiveSubscriber()          guard
                                        │  scoreInputSchema.parse()           shape
                                        │  ScoreService.add()
                                        │     ├─ repo.listForUser()            read current five
                                        │     ├─ engine.previewAddScore()      RULES: duplicate → 409, too old → 422, who gets evicted
                                        │     └─ repo.insert()                 write
                                        │           └─ trigger enforce_score_window   ENFORCEMENT (can't be bypassed)
                                        ▼
                                  ActionResult<{ retained, evicted }>  ──▶  UI animates the eviction
```

The engine decides *and explains* (it names the evicted round so the UI can say "replaced your 19 Aug score"). The trigger guarantees. The service is the only place that knows both exist.

## 2. Repository pattern — first use

`src/repositories/interfaces/ScoreRepository.ts` is a TypeScript interface; `src/repositories/supabase/SupabaseScoreRepository.ts` implements it with the server client (RLS applies — a member's repo can only see their own rows). `ScoreService` takes the interface in its constructor. Tests give it an in-memory fake and prove the orchestration without a database. This is the dependency-inversion rule from `CLAUDE.md`, applied for the first time; every later service follows the shape.

```ts
interface ScoreRepository {
  listForUser(userId): Promise<ScoreEntry[]>          // newest first
  insert(userId, { score, playedOn }): Promise<ScoreEntry>
  update(userId, id, { score, playedOn }): Promise<ScoreEntry>
  delete(userId, id): Promise<void>
}
```

`ScoreEntry` is the engine's type — the repository translates DB rows (`played_on`, `created_at`) into it, so nothing above the repository sees snake_case.

## 3. Files, in build order

### 3.1 `src/schemas/score.ts`
`scoreInputSchema`: `score` coerced int 1–45 (messages from `SCORE`), `playedOn` ISO date via `isIsoDate`, **not in the future** (today computed in `LOCALE.TIMEZONE`). `scoreIdSchema`: uuid. Shared by form and actions.

### 3.2 `src/repositories/interfaces/ScoreRepository.ts` + `src/repositories/supabase/SupabaseScoreRepository.ts`
As above. Maps Postgres `unique_violation` (23505) on `one_score_per_date` to `ConflictError` as a second line of defence (the service checks first, but two tabs can race).

### 3.3 `src/services/ScoreService.ts`
| Method | Does |
|---|---|
| `list(userId)` | repo → `selectRetainedScores` (defensive: trims to five even if the DB somehow has more) |
| `add(userId, input)` | list → `previewAddScore` (throws 409/422) → insert → returns `{ entry, evicted }` |
| `update(userId, id, input)` | list → must own `id` (404) → if date changed, `findEntryOnDate` on the *others* (409) → repo.update |
| `remove(userId, id)` | must own (404) → repo.delete |

Pure orchestration; ≤ 20 lines each. `evicted` comes from the engine preview, not from re-reading the DB — so the UI can name it even though the trigger has already deleted it.

### 3.4 `src/app/(member)/app/scores/actions.ts`
`addScore`, `updateScore`, `deleteScore` — each: `requireActiveSubscriber()` → parse → service → `revalidatePath("/app")` + `("/app/scores")` → `ActionResult`. The `evicted` entry is returned in `data` so the client can show the message.

### 3.5 `src/app/(member)/app/scores/page.tsx` + components
- Page (server): `requireUser` via layout; if not `hasAccess` → `LockedCard` with the same copy as the dashboard. Else loads the five via the service and renders `ScoreManager`.
- `ScoreManager` (client): owns the list state for animation; renders `ScoreRow` (existing) on top, then the editable list `ScoreList`, then `ScoreForm`.
- `ScoreForm`: number input (`inputmode=numeric`, 1–45, stepper buttons ±1 for thumb use), date input (default today in IST, max today), `useActionState(addScore)`. On success: inline confirmation *"Saved. Replaced your 19 Aug round (31)."* when something was evicted, else *"Saved."*. On `CONFLICT`: the message plus an **Edit that round** link that focuses the existing entry. On `RULE_VIOLATION`: the message.
- `ScoreList`: each round as a row — date, score, Edit, Delete. Edit swaps the row for an inline form (`updateScore`); Delete confirms with a second click ("Delete?") then `deleteScore`. Motion (DESIGN.md §4.4): new row slides in at top (200ms), removed row fades (150ms) — `motion`'s `AnimatePresence` with `layout`; reduced-motion → instant.
- Hollow-slot state: fewer than five → `EmptyState` "Enter N more rounds to be in the next draw".

### 3.6 Dashboard hook-up
`(member)/app/page.tsx` already renders `ScoreRow`; switch its query to `ScoreService.list` so both pages share one path.

## 4. Tests

| Kind | File | Proves |
|---|---|---|
| unit | `tests/unit/schemas/score.test.ts` | 1/45 ok; 0/46/1.5/"abc" fail; bad date fails; tomorrow (IST) fails; today ok |
| unit | `tests/unit/services/ScoreService.test.ts` (fake repo) | add → insert called, `evicted` names the oldest by date; duplicate date → `ConflictError` and **no insert**; too old → `RuleViolationError` and no insert; update to a date another round holds → 409; update/delete of a foreign id → 404; list trims to five |
| integration | `tests/integration/scores.test.ts` (existing, 6) | already proves the trigger + RLS + constraints |
| walkthrough | `scripts/walkthrough-phase4.ts` | subscribe a fresh member (seeded row) → add 5 → add 6th → oldest gone + message names it → duplicate date → inline conflict → edit a round → delete a round → 390px screenshots |

## 5. Order of work
1. ✅ schema → repository → service → unit tests (fake repo)
2. ✅ actions → page → components → walkthrough
3. ✅ dashboard hook-up, gates, commit `Phase 4: scores`

## 8. Outcome (2026-09-21)
Done. 200 unit tests, build clean, `scripts/walkthrough-phase4.ts` green with screenshots in `docs/screenshots/phase-4/`.
Two things the walkthrough caught that the unit tests couldn't: (1) handing a saved entry to the parent from a `useEffect` keyed on the parent's callback re-fired on every parent render and duplicated the entry — the callbacks now run inside the `useActionState` action, once per submit; (2) the five numerals at `text-5xl` overflowed a 390px card — `ScoreRow` now steps down to `text-4xl` below `sm`.

## 6. Explicitly not in this phase
Draw participation (6). Admin editing another member's scores (9 — same service with `requireAdmin`). Stripe (5): the walkthrough grants a subscription with the service role, as the seed will.

## 7. Decisions made here
- **[decision] Editing to a taken date is refused** like adding one — the service checks the other kept rounds before the update, and the DB unique index backs it.
- **[decision] Deleting a round is allowed and immediate** (§05 "an existing entry may only be edited or deleted"). Dropping to four makes the member ineligible for the next draw; the page says so.
- **[decision] Future dates are refused** — a round can't be played tomorrow. "Today" is India's today.
