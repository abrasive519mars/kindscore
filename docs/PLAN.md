# Kindscore — Phase Plan (Digital Heroes Level 1 PRD)

## Context

Greenfield build of the Digital Heroes trainee-selection assignment: a subscription web app where golfers log their last 5 Stableford scores, enter a monthly lottery-style draw funded by subscriptions, and direct part of their fee to a charity. Product name **Kindscore**. The bar set by the user: clearly better than every public candidate repo, memorable to an evaluator.

Already written (in `OneDrive/Desktop/Project Revamps/DigitalHeroes/`): `CLAUDE.md` (standards + explain-every-file rule), `docs/PRD.md` (verbatim), `docs/GAME.md` (game explained, `[decision]` tags), `docs/DELIVERABLES.md`, `docs/specs/ARCHITECTURE.md` (schema, RLS, Stripe lifecycle, draw engine, folders, pitfalls). Three brainstorms are complete; the design and QA specs are in Appendix A/B below and get written to `docs/specs/` as the first step.

## Decisions locked with the user

| Topic | Decision |
|---|---|
| Stack | Next.js App Router + TS + Tailwind + Framer Motion · Supabase (Auth/Postgres/RLS/Storage) · Stripe test mode · Vercel · Vitest |
| Pricing | ₹499/mo, ₹4,999/yr (INR) |
| Draw | 5 distinct numbers 1–45; user's 5 scores compared; 5/4/3 matches → 40/35/25% of pool; jackpot-only rollover; equal split in tier; integer paise |
| Modes | Random (uniform) · Algorithmic (count each user's distinct scores → smooth with kernel [¼,½,1,½,¼] over ±2 → weight = 1 + smoothed). **No seeding**: simulate saves numbers+winners as draft; publish flips status; re-simulate overwrites |
| Eligibility | Active subscription + exactly 5 scores. Repeated score counts once |
| Pool share | **30%** of each subscription (PRD says "fixed portion", no number — our decision, one constant) |
| Charity | 10% min, **up to 70%** (= 100 − pool share, derived). At 70% platform takes nothing |
| Pool sizing | Σ monthly-equivalent slice per active subscriber (monthly 14,970 p; yearly 12,497 p). ~300 seeded members → ~₹45k pool so demo prizes look real |
| Look | **Direction B — Editorial Impact** (chosen 2026-09-21 after research; see `docs/specs/UX_RESEARCH.md`, `docs/specs/DESIGN.md`). Ivory + ink + one saffron accent (= the charity slice), Newsreader + Inter, documentary portrait leads the hero, the five numerals are the only decoration, no green, no golf imagery. Appendix A below is the superseded Direction A brainstorm — use DESIGN.md, not Appendix A |
| Code location | **Stays in OneDrive** (user decision). Mitigations: quote all paths; exclude `node_modules` and `.next` from OneDrive sync via Settings → Sync → Choose folders; `pnpm` not npm; if the watcher fails, `WATCHPACK_POLLING=true` |
| Deliverables | Live URL + zip (source, Submission PDF, schema.png) + notes blurb. No demo video |
| Workflow | After every file: concise architectural explanation. Standards per `CLAUDE.md` |

## Phases

Each phase ends with its Definition of Done (Appendix B §9) and a ≤5-sentence summary to the user. Phases 1 and 2 are independent; 5 needs 3; 6 needs 4+5; 7 needs 6; 8, 9 need only 3.

### Phase 0 — Foundations ✅ done 2026-09-21
- [x] Write `docs/specs/QA.md` from Appendix B; `docs/specs/DESIGN.md` is finalised in Phase 0.5
- [x] Update `docs/GAME.md`: pool 30%, charity cap 70%, backdated-score rejection, entries snapshot + stale guard, 4/3 unclaimed retained
- [x] `git init` in `DigitalHeroes/`; `.gitignore` (node_modules, .next, .env*, !.env.example)
- [x] `pnpm create next-app` (TS, Tailwind, App Router, src/, ESLint) into `kindscore/` subfolder? **No — scaffold at repo root** so docs and code ship together
- [x] Add deps: `@supabase/ssr @supabase/supabase-js stripe zod framer-motion lucide-react`; dev: `vitest @vitest/coverage-v8 supabase (CLI) stripe (CLI via scoop/winget) prettier`
- [x] `src/config/constants.ts`, `src/config/env.ts` (zod-parsed), `.env.example`
- [x] Tailwind theme tokens from `docs/specs/DESIGN.md` §2 (palette, Newsreader + Inter via `next/font`, radii, rules, durations, easings); `data-theme` dark mode; no texture
- [x] Update `CLAUDE.md` with real commands (`pnpm dev/build/lint/typecheck/test/test:int/seed`, single test `pnpm vitest run tests/engine/draw/allocatePrizes.test.ts`)
- Verify: ✅ `pnpm build` passes, `pnpm lint`/`typecheck` clean, `pnpm test` runs (0 tests), production page screenshotted in brand tokens (dark palette via OS preference)

### Phase 0.5 — UI/UX research ✅ done 2026-09-21
- [x] Three research passes → `docs/specs/UX_RESEARCH.md` (§12 line-by-line mapping)
- [x] Direction B chosen → `docs/specs/DESIGN.md`
- [x] Curate 7 charity cover photos + 2 gallery each (Unsplash/Pexels, Indian context, dignity framing) → `public/seed/manifest.json` + `scripts/fetch-seed-photos.ts` (`pnpm seed:photos`) → 21 WebPs (3.2 MB), credits in `docs/CREDITS.md`

### Phase 1 — Engine layer (pure TS + tests) ✅ done 2026-09-21

`src/engine/` may import only from `src/config` and itself. An ESLint `no-restricted-imports` rule for `next`, `@supabase/*`, `stripe`, `react` enforces it. Functions < 20 lines, guard clauses, no magic numbers (all from `src/config/constants.ts`).

Design choices for this phase:
- **Money is `number` (integer paise), not `bigint`** in TypeScript. Max safe integer ≈ ₹90 trillion; bigint would complicate JSON, Supabase and React. A `Paise` branded type + `assertPaise()` guard integers. The DB column stays `bigint`.
- **Randomness is injected.** `generateNumbers(mode, freq, rng)` takes an `rng: () => number` in [0,1). Production passes `secureRng` (built on `globalThis.crypto.getRandomValues`, available in Node 20+ and browsers — not a framework import). Tests pass a fixed sequence. No seed is persisted (user decision).
- **One weighted-sampling code path.** Random mode = all weights 1; algorithmic = `BASELINE + smoothedFrequency` where `smoothed(n) = 0.25·f(n−2) + 0.5·f(n−1) + f(n) + 0.5·f(n+1) + 0.25·f(n+2)` (kernel in `DRAW.SMOOTHING_KERNEL`; clipped at 1 and 45). The draw follows the *shape* of how golfers score, not one month's sampling noise (user decision 2026-09-21). Sampling without replacement: draw r in [0, total), walk the cumulative weights, remove the pick, repeat 5×.
- **Matching is set-based.** `countMatches(scores, drawn)` = |set(scores) ∩ set(drawn)|. Eligibility = exactly 5 stored scores.
- **Prize allocation** returns a full audit object: `{ tierPools, prizes[], rolloverOutPaise, unclaimedRetainedPaise }`. Jackpot absorbs rounding so tiers sum exactly to pool + rollover-in. Equal split gives the first k winners (sorted by userId) +1 paisa so totals are exact.
- **Verification is a state machine** `transition(state, event)` → new state or `RuleViolationError`. States `{ review: awaiting_proof|submitted|approved|rejected, payout: pending|paid, resubmissions }`. Events `submit_proof | approve | reject | mark_paid`. One resubmit after rejection.
- **Dates are `YYYY-MM-DD` strings** in the engine; `todayInTimezone(now, LOCALE.TIMEZONE)` via `Intl.DateTimeFormat`. No Date objects cross the engine boundary.

Files (write → test → explain):
- [x] `engine/errors.ts` — `AppError(code, status, userMessage)` + `ValidationError 400`, `AuthenticationError 401`, `ForbiddenError 403`, `SubscriptionRequiredError 403`, `NotFoundError 404`, `ConflictError 409`, `RuleViolationError 422`, `ExternalServiceError 502`, `isAppError()`
- [x] `engine/money/paise.ts` — `Paise`, `Bps` types; `assertPaise`; `applyBps(amount, bps)` (floor); `splitEqualPaise(total, n)` → shares summing exactly; `formatInr(paise)` → `₹1,80,000` via `Intl.NumberFormat(LOCALE.NUMBER_LOCALE)`
- [x] `engine/charity/splitPayment.ts` — `validateCharityBps` (min ≤ x ≤ max, step); `splitPayment(amountPaise, charityBps)` → `{ charityPaise, poolPaise, platformPaise }`, pool first, platform = remainder, sum invariant
- [x] `engine/scores/validateScore.ts` — integer within `SCORE.MIN..MAX` → `ValidationError` otherwise
- [x] `engine/time/dates.ts` — `todayInTimezone`, `isValidIsoDate`, `isFutureDate`, `compareIsoDates`
- [x] `engine/scores/latestFive.ts` — `ScoreEntry { id, score, playedOn, createdAt }`; `selectRetainedScores(entries)` → `{ retained, evicted }` by `playedOn desc, createdAt desc`, take `SCORE.WINDOW_SIZE`; `findEntryOnDate`; `isBackdatedBeyondWindow(playedOn, entries)`; `previewAddScore(entries, candidate)` → `{ retained, evicted }` or throws `ConflictError` (duplicate date) / `RuleViolationError` (backdated)
- [x] `engine/draw/rng.ts` — `Rng` type, `secureRng`, `sequenceRng(values)` for tests
- [x] `engine/draw/eligibility.ts` — `isEligibleTicket(scores)` (exactly `WINDOW_SIZE`), `EligibleEntry { userId, scores }`
- [x] `engine/draw/frequency.ts` — `buildFrequencyMap(entries)` counting each user's *distinct* scores; `smoothFrequency(freq)` applying `DRAW.SMOOTHING_KERNEL` with edge clipping
- [x] `engine/draw/generateNumbers.ts` — `buildWeights(mode, freq)`, `sampleWithoutReplacement(weights, count, rng)`, `generateNumbers(mode, freq, rng)` → sorted 5-tuple
- [x] `engine/draw/match.ts` — `countMatches`, `matchEntries(numbers, entries)` → `{ userId, scores, matchCount }[]`, `winningTierFor(matchCount)` → 5|4|3|null
- [x] `engine/prizes/pool.ts` — `monthlyEquivalentPoolPaise(interval)`, `computePoolPaise(subscriptions)`
- [x] `engine/prizes/allocate.ts` — `splitTierPools(poolPaise, rolloverInPaise)`, `allocatePrizes({ poolPaise, rolloverInPaise, matched })`
- [x] `engine/subscription/status.ts` — `mapStripeStatus(stripeStatus)`, `hasActiveAccess({ status, currentPeriodEnd }, now)`
- [x] `engine/verification/stateMachine.ts` — `VerificationState`, `VerificationEvent`, `initialVerificationState()`, `transition(state, event, at)`
- [x] `engine/index.ts` — public surface re-exports
- [x] `eslint.config.mjs` — restricted-imports rule scoped to `src/engine/**`
- [x] `tests/unit/engine/**` mirroring each file; QA §1 cases incl. property test ×1000 on `generateNumbers` (both modes), rollover chain Jun→Sep, `splitEqualPaise(3_750_000, 7)` exactness, IST midnight, dupes-count-once, zero eligible; smoothing: a lone spike spreads to ±2 neighbours with the kernel ratios and clips at 1/45
- Verify: ✅ 150 tests green in 0.8 s; coverage 100% statements / branches / functions / lines on `src/engine`; import guard proven with a probe file; lint, typecheck, build clean

### Phase 2 — Database ✅ done 2026-09-21 (plan: `docs/plans/phase-2-database.md`)
- [x] `supabase init`; migrations `0001_enums_tables.sql`, `0002_triggers.sql` (profile-on-signup, rolling-5 eviction, updated_at, payment→ledger), `0003_rls.sql` (`is_admin`, `has_active_access`, all policies, column revokes), `0004_rpc.sql` (`save_simulation`, `publish_draw`), `0005_views.sql` (reports), `0006_storage.sql` (buckets + policies)
- [x] `supabase db push` to the **new** Supabase project (user creates it; Mumbai region); auth: disable email confirmation, set redirect URLs
- [x] `supabase gen types` → `src/types/database.types.ts`
- [x] Minimal seed: admin + 7 charities (Appendix B §3 names) + images to Storage
- [x] RLS smoke script: anon / member / admin reads against each table
- Verify: policies behave; `schema.dbml` exported (for schema.png later)

### Phase 3 — Auth + shell
- [ ] `lib/supabase/{server,browser,admin,middleware}.ts`; `middleware.ts` (cookie refresh, route guards)
- [ ] `(auth)/signup` 4-step Stepper: account → charity + SplitSlider → plan → pay; `(auth)/login`; `auth/callback`
- [ ] `(member)/app/layout.tsx` with `getAccessState()` (React `cache`), locked-card shell for non-subscribers; `(admin)/admin/layout.tsx` with `is_admin`
- [ ] `lib/action-result.ts`, `lib/http-error.ts`, `lib/auth-guards.ts` (`requireUser`, `requireActiveSubscriber`, `requireAdmin`)
- [ ] UI primitives (DESIGN.md §6): Button, Card, Rule, Figure, ScoreRow, Split, Stepper, Badge, Chip, FormField, Modal/Sheet, InlineConfirmation, Toast, Skeleton, EmptyState, Nav/BottomNav/AdminSidebar
- Verify: signup → dashboard shell; non-admin `/admin` → 403 ticket

### Phase 4 — Scores
- [ ] `repositories/interfaces/ScoreRepository.ts` + supabase impl; `services/ScoreService.ts`
- [ ] `(member)/app/scores` — ScoreRow + inline form (DESIGN.md §4.4): new figure slides in, oldest fades, inline edit, duplicate-date shows existing entry inline, hollow slots "enter N more"
- [ ] Server actions: add/edit/delete with Zod + `requireActiveSubscriber`; `unique_violation` → `ConflictError`
- Verify on deployed DB: 6th score evicts oldest by date; same date → 409; backdated beyond window → rejected; boundaries 1/45

### Phase 5 — Stripe + subscription
- [ ] Stripe test mode: products/prices INR; `lib/stripe.ts`; `startCheckout(interval)` action (`billing_address_collection: required`)
- [ ] `api/stripe/webhook/route.ts` (nodejs runtime, raw body, `stripe_events` dedupe) → `services/WebhookHandler.ts` → `SubscriptionRepository`, `PaymentRepository`
- [ ] Success page fallback `syncSubscriptionFromStripe(session_id)`; Customer Portal link; cancel flow
- [ ] `(member)/app/subscription` page; StatusBanner states; lapsed redirect
- [ ] `api/cron/keepalive` + `vercel.json` cron
- Verify: 4242 card → active; `stripe trigger invoice.payment_failed` → past_due; replayed event → single row

### Phase 6 — Draw (admin + member)
- [ ] `DrawRepository`, `services/DrawService.ts` (simulate → RPC; publish → RPC; stale guard)
- [ ] `(admin)/admin/draws` — month picker, ModeToggle + Histogram45, Simulate → draft panel + Stepper, WinnersTable, Publish confirm restating consequences, rollover chip
- [ ] `(member)/app/draws`, `/app/draws/[id]` — Draw Reveal (DESIGN.md §4.1: roll-in + match fill first view, result-first on return), WinnersSummary, outcome line
- [ ] JackpotOdometer component (DESIGN.md §4.2) on dashboard + admin + landing
- [ ] `(marketing)/draws` public history
- Verify: two simulates overwrite; publish twice → idempotent; scores edited after simulate → Publish disabled; Σ prizes = tiers = pool + rollover

### Phase 7 — Winner verification
- [ ] `WinnerRepository`, `services/WinnerService.ts` (state machine from engine)
- [ ] `(member)/app/winnings`, `/app/winnings/[id]/proof` — FileDrop (5 MB, png/jpg/webp, client WebP re-encode), status timeline
- [ ] `(admin)/admin/winners` — filter, ProofViewer (signed URL), Approve / Reject (reason) / Mark paid
- Verify: cross-user proof read blocked by RLS; illegal transitions → 422

### Phase 8 — Charities + donations
- [ ] `CharityRepository`, `CharityService`
- [ ] `(marketing)/charities` (search, filter chips, grid), `/charities/[slug]` (gallery, story, events, Choose / Donate once)
- [ ] `(member)/app/charity` — current charity, SplitSlider (10–70%), change charity, DonateOnce (Stripe Checkout one-time → `donations.paid` via webhook)
- [ ] `(admin)/admin/charities` CRUD, ImageUploader, EventsEditor, featured toggle, soft-delete
- Verify: charity change affects next payment only; totals from ledger

### Phase 9 — Admin users + reports
- [ ] `(admin)/admin/users` DataTable + `/users/[id]` (profile, admin-editable ScoreTicket, SubscriptionControls, audit list)
- [ ] `(admin)/admin/reports` — Stat tiles (users, active subs, pool, charity total), charity totals table, draw statistics per tier per month, CSV export
- Verify: report totals = SQL sums over ledger

### Phase 10 — Landing + polish
- [ ] `(marketing)/page.tsx` per DESIGN.md §3 storyboard: impact-first Hero (portrait + outcome line), ProofStrip, HowItWorks with named golfer, Charity impact + Split + cards, PracticeDraw + Histogram45, Jackpot ladder, Pricing, ClosingCTA with demo-account link
- [ ] `/how-it-works`, `/pricing`; `not-found` + `error` torn-ticket boundaries
- [ ] Micro-interaction pass (DESIGN.md §7), reduced-motion hook, focus rings, aria-live, mobile BottomNav, 360/390/768/1280/1920 check
- [ ] Performance: `LazyMotion`, font subsetting, ISR 60s on public pages, LCP ≤ 2s
- Verify: Lighthouse ≥ 90 perf/a11y on `/`; no horizontal scroll at 360px

### Phase 11 — Seed, deploy, submit
- [ ] `scripts/seed.ts`: admin, priya/raj/anita personas, ~300 filler members with bell-curve scores, seeded subscriptions (`source='seed'`), 4 months of `payments`, Jun/Jul/Aug draws **generated by the real engine** (jackpot unclaimed → rollover chain), member12 proof submitted, member17 paid, Sep left unsimulated
- [ ] New Vercel account: import repo, env vars, cron; new Supabase project already linked; Stripe webhook → Vercel URL
- [ ] Post-deploy smoke (Appendix B §4.4) on the live URL, desktop + 390px
- [ ] `README.md` (Appendix B §6), `docs/SUBMISSION_NOTES.md` (≤2048 chars blurb), `docs/submission/Kindscore-Submission.html` → PDF via headless Edge, `schema.png` from dbdiagram
- [ ] `scripts/package.ps1`: zip = `git archive` + PDF + schema.png; assert < 50 MB and no `.env`
- [ ] Run the PDF's 2-minute test script end-to-end on the live URL. Done.

## Verification (end-to-end)

Run PRD §16.1 as the acceptance suite on the deployed URL with seeded credentials: signup → subscribe monthly with 4242 → enter 5 scores (+ a 6th to see eviction, + a duplicate date to see rejection) → admin simulate Sep (both modes) → publish → member sees Draw Reveal → winner uploads proof → admin approves → marks paid → dashboard shows total won and Paid → lapse a subscription and confirm restricted access → mobile pass. Unit suite: `pnpm test`; integration: `pnpm test:int` against the seeded project.

---

## Appendix A — Design spec (from UI/UX brainstorm; to be written to `docs/specs/DESIGN.md`)

Calibration: both competitor repos = dark navy + emerald + gold + glassmorphism; the live demo = light generic SaaS with emoji. Kindscore is the opposite on every axis.

### A1. Brand system — "The Fair"
Motif **The Punch**: five circular slots; a match is a hole punched through the ticket (circle cuts out, red shows through). Logomark `○ ○ ● ● ●` (encodes "match 3, 4 or 5"). **Ticket stub card**: notches at 1/3 height + dashed perforation. **The Split**: one bar → charity red / pool blue / platform grey. **The Stamp**: −6° rotated bordered label (`PUBLISHED`, `3-MATCH`, `PAID`, `DRAFT`).

| Token | Light | Dark |
|---|---|---|
| bg | `#F6F1E8` | `#121110` |
| surface | `#FFFFFF` | `#1C1A18` |
| surface-2 | `#EFE8DC` | `#262321` |
| ink | `#16130F` | `#F3EEE6` |
| ink-muted | `#6B655C` | `#A39C91` |
| line | `#D9D0C2` | `#35302B` |
| primary (Raffle Red) | `#E24B2A` | `#FF6E52` |
| primary-ink | `#FFFFFF` | `#1B0906` |
| accent (Stamp Blue) | `#1E3AA8` | `#8AA0FF` |
| success | `#1E7F4F` | `#4CC38A` |
| warn | `#9A6B12` | `#F2B544` |
| danger | `#8E1B1B` | `#FF8A80` |

Red **is** the charity slice. No green anywhere. Dark mode: no shadows, 1px borders, no texture, red −10% saturation.
Type: **Fraunces** (display, `wght 600–800`, `SOFT 50, WONK 1` on H1, −0.02em above 40px) · **Instrument Sans** (body 15/1.55, `tabular-nums` on all numbers, labels 13px 600 uppercase +0.06em).
Radius sm 6 / md 12 / lg 20. Shadows light: s1 `0 1px 2px rgb(22 19 15/.06)`, s2 `0 8px 24px -12px rgb(22 19 15/.25)`, s3 `0 24px 64px -24px rgb(22 19 15/.4)`. Durations fast 120 / base 200 / move 320 / reveal 600 / story 900 ms. Easings enter `cubic-bezier(.22,1,.36,1)`, move `(.65,0,.35,1)`, exit `(.4,0,1,1)`; pop spring `{420,30}`, layout spring `{180,24}`. Stagger 40ms cap 8. Light-mode 3% SVG noise on bg.

### A2. Landing storyboard
1. **Hero** — H1 "Your golf scores are your lottery numbers." Sub: "Log your last five Stableford scores. Once a month we draw five numbers from 1 to 45. Match three, four or all five and you share the pool — and at least 10% of every rupee you pay goes to a charity you choose." CTAs `Subscribe · ₹499/month` + `Watch a draw`. Live strip: "Jackpot this month ₹X — rolls over until won · ₹Y given to charities so far". Right: teaching ticket auto-loop (scores tumble in, drawn numbers drop, matches punch, `3-MATCH` stamp slams), 9s loop, pause on hover, final frame under reduced motion.
2. **How it works** — "Three steps. One round a month." Three torn stubs (subscribe+charity / log 5 scores with live mini-ticket showing 6th evicting oldest / match the draw). Clip-path tear-in, 600ms, 120ms stagger.
3. **The draw** — "Watch a draw." Editable 5 slots + `Pull the draw`; result "You matched 3 of 5 · you'd share ₹… with this month's other 3-match winners". Toggle Random / "Weighted by what golfers actually score" re-renders a 1–45 histogram (flat vs bell).
4. **Charity impact** — "The fair way." Slider 10→70% over the Split bar; featured charity spotlight (the only big photo); running total "₹… given by … members".
5. **Jackpot** — "It grows until someone takes it." Odometer + 3-month rollover ladder from real draws.
6. **Pricing** — two stubs Monthly ₹499 / Yearly ₹4,999 (`2 MONTHS FREE` stamp), each with its Split. "Cancel any time. Lapsed members keep their history but sit out the draw."
7. **CTA band** — "Play your round. Win the draw. Fund a cause. **The fair way.**" + "Test drive with a demo account".
Nav: Charities · How it works · Draws · Log in · Subscribe (red pill, sticks bottom-centre on mobile once hero scrolls off).

### A3. Signature moments
- **Draw Reveal** (`/app/draws/[id]`, mini on landing): ticket shows user's 5 scores; drum row of 5 dashed circles; balls drop from −40px spring {420,30} every 450ms in drawn order; on landing, matching slot punches (clip-path circle→0, 6° wobble, scale 1→1.12→1), non-matches dim 70%; 800ms hold; Stamp slams (`3-MATCH · ₹2,500` / `JACKPOT` / "No match — jackpot rolls to ₹…"); jackpot: perforation tears 8px + 60 red/blue confetti rects once 1.2s. Winners counts count up. Skip button; reduced motion → final frame + "Play the reveal".
- **Jackpot Odometer**: fixed-width digit strips, roll 0→value 900ms staggered right-to-left; live changes roll only changed digits (Supabase realtime); Indian grouping.
- **Score Ticket** (`/app/scores`): one ticket, 5 slots newest-left; add = slot-shaped inline form (stepper 1–45, date default today, used dates disabled); new ball drops slot 1, others slide right, 6th slides off + toast "Replaced your 19 Aug score (31)"; tap ball → rotateY flip to edit; delete shrinks; duplicate date shakes 2×4px with link to that ball; <5 → dashed slots "Enter 2 more to be in October's draw".
- **The Split**: slider 10–70 step 5; red grows, blue fixed 30%, grey shrinks to 0 at 70% → stamp `KINDSCORE TAKES NOTHING`; paise-exact values count live. Used in signup step 2, `/app/charity`, landing §4.
- **Admin Simulate → Publish**: result as full ticket with diagonal `DRAFT · SIMULATION` watermark 8% + warn border; Re-simulate replays drum fast (150ms/ball); Publish confirm modal restates counts/rupees → watermark fades, `PUBLISHED {date}` stamp, table row warn→success.

### A4. Page inventory (route → components; every page has ticket-shaped skeletons, dashed EmptyTicket with one action, ErrorTicket)
Public: `/` (above) · `/how-it-works` · `/charities` (SearchField, FilterChips cause/city/has-event, CharityCard grid) · `/charities/[slug]` (gallery, story, EventList, ImpactStat, Choose / Donate once) · `/draws` (DrawResultCard list; empty = countdown to first draw) · `/pricing` · `/login` · `/signup` (4-step Stepper).
Member `/app`: dashboard (StatusBanner, compact ScoreTicket, JackpotOdometer, NextDrawCountdown, CharityStat + mini Split, WinningsStat, LatestDrawResult) · `/scores` · `/draws`, `/draws/[id]` · `/charity` · `/winnings`, `/winnings/[id]/proof` (FileDrop, ProgressRing, status timeline) · `/subscription` (PlanCard, portal link, cancel modal; lapsed = red dashed ticket) · `/settings`.
Admin `/admin`: overview stats · `/users`, `/users/[id]` · `/draws`, `/draws/[id]` · `/charities`, `/charities/new|[id]` (ImageUploader, EventsEditor) · `/winners` (ProofViewer modal, Approve/Reject/Mark paid) · `/reports` (tiles, charity table + bars, per-tier stats, CSV).

### A5. Components
Button (primary/ink/ghost/danger-outline; loading dots; whileTap .97) · TicketCard (default/stub/highlighted/draft/lapsed) · NumberBall (xs–lg; empty/filled/matched/dimmed/drawn; drop/punch/flip) · Stamp (tone; slam-in) · Odometer · SplitBar + SplitSlider · Stat · ProgressRing · DataTable (sortable, sticky, drawer, mobile restack to cards) · FormField (text/number-stepper/date/select/file-drop/slider; shake on error) · Stepper · Modal/Drawer (bottom sheet on mobile) · Toast (stack 3, 5s, swipe-down) · Banner · Skeleton · EmptyTicket · Nav/BottomNav/AdminSidebar (`layoutId` indicator) · Histogram45 · CharityCard/Spotlight.

### A6. Micro-interactions
Hover: card −2px + s1→s2; primary btn bg −6%. Press scale .97 spring. Focus 2px accent ring offset 2 on `:focus-visible`. Page transition fade + 8px rise (200 out / 320 in). List add scale .9→1 + siblings layout spring; remove fade+scale .9. Validate on blur; on submit scroll to first invalid, shake 240ms, message fades in with icon. Toast slide 16px from bottom-right (bottom-centre mobile), hover pauses. Modal backdrop ink 40%, panel .96→1. Scroll reveals once at 20% visibility, 16px rise, 40ms stagger. Motion budget: one signature animation per viewport.

### A7. Mobile
Public: logo + Subscribe pill + hamburger; pill fixed bottom-centre after hero. Members: BottomNav (Home · Scores · Draws · Charity · Winnings), avatar sheet for Subscription/Settings. Admin: top bar + drawer. Hero ticket above headline, H1 36px. Draw reveal: drum top, ticket bottom, each ball *travels* to its matching slot (450ms) before punching; `navigator.vibrate(10)`. Score ticket 3+2 grid; add form = bottom sheet. Tables → TicketCards. Tap targets ≥44px, 16px gutters, `100dvh`, safe-area insets.

### A8. A11y + perf
`useMotionPref()` hook; reduced motion = final frames, no confetti. Contrast: ink/bg 15.8:1, primary-ink/primary 4.6:1 (≥16px 600), dark red 7.2:1; danger never colour-only. Skip link, focus trap/return, `aria-current`, `aria-live=polite` for results/toasts, odometer `aria-label`. Labels visible, `aria-describedby` errors. LCP ≤ 2s (hero is DOM/SVG, no image); `next/font` 2 families subset; `LazyMotion` + `domAnimation`; landing JS ≤ 120KB gz. Charity images via Storage + `next/image` remote pattern + blur placeholder; uploads re-encoded to WebP client-side. ISR 60s public pages; member/admin client-fetch with dimension-matched skeletons (CLS < .05). `data-theme` on html, no flash.

### A9. Anti-patterns (never)
Dark navy + emerald + gold + glass · emoji icons · hero + 3 feature cards · gradient blobs/mesh/glow · gradient text · golf stock imagery, plaid, green · fake testimonials (show real DB numbers) · pill badges everywhere · equal-intensity motion everywhere · grey-box skeletons / "No data" text · horizontal-scroll tables · uppercase Inter + bento grid · looping confetti · USD.

One-line pitch: *"The site where your golf scores are lottery numbers on a paper ticket, and matches punch holes in it."*

---

## Appendix B — QA / deployment / submission spec (to be written to `docs/specs/QA.md`)

### B1. Test matrix (§16.1 → cases; U = Vitest unit, I = integration vs seeded Supabase, M = manual on live URL)
- **Signup/login** (I, M): happy → `/subscribe`; duplicate email; wrong password; logout; unauth `/app` → `/login?next=`; admin cannot be created via public signup.
- **Subscription** (I with Stripe fixture payloads, M): monthly → active/plan/period ≈ +1mo; yearly +1yr; abandoned checkout → restricted; cancel → `cancel_at_period_end`, access until period end; `invoice.payment_failed` → past_due → restricted next request; **replay same `event.id` → exactly one row, 200**; bad signature → 400; unknown customer → 200 + log.
- **Scores** (U, I, M): 6th evicts oldest **by `played_on`**; backdated beyond window → rejected with message; edit keeps date; delete → 4 → ineligible; same date → 409 "You already logged a round on 12 Sep — edit it instead" + DB unique asserted; **IST midnight**: 00:30 IST 13 Sep must store 13 Sep (send `YYYY-MM-DD`, column `date`); future date rejected; 0/46/1.5/"abc"/"" rejected, 1 and 45 accepted; newest-first order.
- **Draw** (U bulk, I, M): `generateNumbers` 5 distinct in 1–45 (property ×1000); weighted never excludes baseline; `[33,33,28,36,29]` vs `[33,12,29,36,41]` = 3; 4-score user absent from entries; ≤2 → no tier; `splitPool(15_000_000)` → 5,250,000 / 3,750,000 / jackpot 6,000,000; `splitPool(1001)` sums exactly (jackpot absorbs); `splitEqual(3_750_000, 7)` → sum exact, first k winners +1 paise; rollover chain Jun→Jul→Aug→Sep; jackpot won by 2 → equal split of full amount; **zero eligible** → succeeds, jackpot rolls, 4/3 retained; simulate writes draft + entries + results; re-simulate replaces; publish flips + idempotent; one published per month.
- **Charity** (U, I, M): `splitPayment(49900, 1000)` → 4,990 / 14,970 / 29,940; 7000 → 34,930 / 14,970 / 0; 900 and 7100 rejected; change mid-period affects next payment only; donation ≥ ₹10 recorded + in totals; search/filter; delete-in-use → soft-delete.
- **Verification** (U, I, M): transitions `awaiting_proof→submitted→approved→paid`, `submitted→rejected→submitted` (one resubmit); illegal: `awaiting_proof→approved`, `rejected→paid`, `approved→rejected`, `paid→*`; >5 MB → 413; pdf/gif/exe rejected; member A cannot read B's proof; total won = approved+paid only.
- **Dashboard** (M): every §10 module non-empty for priya; "enter 5 scores" for raj; lapsed banner for anita; renewal = `current_period_end`.
- **Admin** (I, M): non-admin → 403; admin score edit uses same validation; admin lapses a sub → user redirected within one request; charity CRUD + upload; report totals = SQL sums.
- **Data accuracy** (I): Σ winners per tier = tier; Σ tiers = pool + rollover_in; reports pool = Σ `payments.pool_paise`; charity totals = ledger.
- **Responsive** (M): 360×800, 390×844, 768, 1280, 1920; no horizontal scroll; one-handed score entry; admin tables scroll within container.
- **Error handling**: every row of B2 exercised once.

### B2. Error & edge catalogue (behaviour / copy)
Auth: session expired mid-form → toast "Signed out — please log in again", form state kept in sessionStorage. Checkout abandoned → `/subscribe?canceled=1` "No charge was made." User returns before webhook → success page syncs from `session_id`; fallback copy "Payment received — activating, refresh in a moment." Webhook replay/out-of-order → `stripe_events` PK + apply only if `event.created` ≥ stored. Lapsed mid-session → server gate → `/subscribe?reason=lapsed` banner "Your subscription lapsed on 1 Sep. Renew to keep your scores in the draw." (scores retained). Cancelled-not-ended → "Active until 30 Sep · won't renew · Resume". Duplicate date → inline with link. Range/future/non-integer → field errors, server 422. Edit while draft exists → draft **stale**, Publish disabled "Scores changed since simulation — re-simulate before publishing". Admin edits after publish → allowed, snapshot immutable, audit row. Simulate zero eligible → "0 eligible entrants. Jackpot ₹X rolls to next month; 4- and 3-match tiers unpaid (₹Y retained)." Publish twice / two tabs → `update … where status='simulated'` 0 rows → 409 "Already published"; button disables. Publish without draft → hidden; API 400 "Simulate first". Month already published → "September's draw is already published". Weighted with no scores → uniform fallback + note. Delete charity in use → soft-delete "Hidden from directory; 12 subscribers still contribute — reassign them first to remove". Image upload fails → keep form, "Charity saved without image — retry upload". Proof >5 MB / wrong type → "Max 5 MB, PNG/JPG/WebP only". Non-winner hits upload → 403 "Only winners of a published draw can upload proof". Approve without proof / Paid before approve → hidden; API `IllegalTransition` toast. Reject → reason ≤200 chars, winner sees it + "Upload again" once. Non-admin → 403 page, no leak. Unhandled → `error.tsx` per group with request id.

### B3. Seed spec
Subscriptions **seeded directly** (`source='seed'`, `stripe_subscription_id='seed_sub_…'`), admin UI shows "seeded" chip; the evaluator's own signup is the real Stripe proof.
Accounts (`@kindscore.test`, password `Kindscore!2026`): `admin` · `priya` (active yearly renews 15 Mar 2027, charity 15%, scores 28/33/31/36/29, 3-match winner Aug **awaiting proof**) · `raj` (active monthly renews 5 Oct, 3 scores) · `anita` (lapsed 1 Sep, 5 scores, one paid ₹ win in Jun) · `member001–300` (active, 5 scores each, bell-curve around 30, mixed charities/plans). `member012` proof **submitted** (pending review); `member017` jackpot winner Aug **paid** — *or* no 5-match in any month so the rollover ladder climbs (choose at seed time; prefer the rollover ladder for the landing page, and make member017 a 4-match paid winner).
Charities (fictional, 7): Sahaj Shiksha Foundation (rural girls' education, Telangana) · Neer Jal Trust (village water) · Hara Bhara Initiative (urban tree cover) · Roshni Netra Care (cataract camps) · Ashray Paws Rescue (street animals) · Sanjeevani Rural Health Mission (mobile clinics) · Udaan Girls' Sports Collective (**featured**). Each: 2–3 paragraphs, cover image in `public/seed/` uploaded to Storage, 1–2 events e.g. "Charity Golf Day · Hyderabad Golf Association · 14 Nov 2026".
Draw history: Jun (random), Jul (algorithmic), Aug (random) published, **generated by running the real engine**; Sep not simulated. `payments` rows Jun–Sep per member so reports are non-zero.

### B4. Deployment runbook
1. **Supabase** (new project, `ap-south-1`): copy URL / anon / service role / DB password; `supabase login` → `link` → `db push`; buckets `proofs` (private, 5 MB, png/jpeg/webp) + `charity-media` (public, 2 MB) with policies; Auth: **disable Confirm email**, Site URL = Vercel URL, redirect URLs (prod + localhost `/auth/callback`), password min 8; `pnpm seed` (service role, `auth.admin.createUser` with `email_confirm: true`, idempotent).
2. **Stripe** (test): products Monthly ₹499 / Yearly ₹4,999 INR; Checkout `mode: subscription`, `billing_address_collection: required`; webhook `https://<app>/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`; local `stripe listen --forward-to localhost:3000/api/stripe/webhook`; cards `4242 4242 4242 4242`, India `4000 0035 6000 0008`, decline `4000 0000 0000 0002`, auth `4000 0025 0000 3155`; note possible RBI e-mandate screen in Checkout.
3. **Vercel** (new account, GitHub import): Next.js, Node 20. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `SEED_PASSWORD`. `vercel.json` cron `0 3 * * *` → `/api/cron/keepalive`. `maxDuration = 60` on simulate.
4. **Smoke**: landing → signup → 4242 → Active → webhook 200 → 5 scores → priya dashboard → admin simulate Sep → publish → priya reveal → proof → approve → paid → 390px pass → robots/OG.

### B5. Submission PDF (8 pages)
Cover (pitch, URL + QR, repo, date) · 2-minute test script with credential table, 12 steps ↔ §16.1 · Architecture diagram + "where the rules live" · Data model (`schema.png` + per-table rationale) · **Decisions table** (every `[decision]`: gap · options · chosen · why) · Screenshot gallery ×2 · Test evidence (Vitest counts, §16.1 ticked, known limits) · What we'd build next (real payouts via Razorpay X, notifications, weighting dashboard, audit UI).
Tooling: `docs/submission/Kindscore-Submission.html` with `@page A4` print CSS → `msedge.exe --headless --print-to-pdf=... --no-pdf-header-footer file:///...`. Schema: `schema.dbml` → dbdiagram.io PNG (Supabase Studio visualizer as fallback).

### B6. README outline
Title + pitch + live URL + credentials · 2-minute test script · How it works (link `docs/GAME.md`) · Architecture (folder map, request flow, **§ → file table**) · Local setup (`.env.example` table: var, where from, public/secret; `pnpm i`, `supabase db push`, `pnpm seed`, `stripe listen`, `pnpm dev`) · Deployment · Scripts · Testing (layers, §16.1 mapping) · Decisions table · Known limitations & next steps.

### B7. Notes-field blurb (≈1,150 chars; placeholders filled at submit)
"**Kindscore — a charity lottery for golfers.** Subscribers (₹499/mo or ₹4,999/yr) fund a charity they choose (10–70%) and a monthly prize pool (30%); their last 5 Stableford scores are their lottery numbers. Each month the admin simulates then publishes a draw of 5 numbers (random or score-weighted); 5/4/3 matches split 40/35/25% of the pool, unclaimed jackpots roll over, winners upload proof and are paid.
Live: `<url>` · Repo: `<repo>`
**Start with Kindscore-Submission.pdf (in the zip)** — page 2 is a 2-minute test script covering every §16.1 item.
Admin: `admin@kindscore.test` / `Kindscore!2026` · Member with a win awaiting proof: `priya@kindscore.test` · 3 scores / ineligible: `raj@kindscore.test` · Lapsed: `anita@kindscore.test` (same password) · Stripe test card `4242 4242 4242 4242`, any future expiry/CVC.
Stack: Next.js App Router + TypeScript, Supabase (Auth, Postgres+RLS, Storage), Stripe test mode, Vercel, Vitest. New Vercel account + new Supabase project as required. Seeded with 3 months of published draws incl. a jackpot rollover chain; September is left unpublished so you can run the draw yourself. All PRD ambiguities and how we resolved them are in the PDF's decisions table."

### B8. Risk register
1 Supabase SMTP rate limit blocks signup → disable confirmation. 2 Free project pauses after 7 idle days → cron keep-alive + check morning of submission. 3 OneDrive + apostrophe path → quote paths, exclude `node_modules`/`.next` from sync, polling watcher fallback. 4 Stripe India INR quirks → address required, test on live URL early, document card. 5 Webhook misconfig → success-page fallback + webhook log in smoke. 6 Over-engineering vs deadline → scope = §16.1, rest in "next". 7 Vercel timeout on simulate → single RPC, O(n) matching, `maxDuration`. 8 Money drift → paise integers + Σ-invariant tests. 9 RLS leak/block → integration tests as two users. 10 Zip >50 MB / contains `.env` → `package.ps1` asserts.

### B9. Definition of done (per phase)
`pnpm build` zero TS errors · `pnpm lint` clean · `pnpm test` (+ `test:int` where relevant) green with new rules tested · phase's §16.1 line verified on the **deployed** URL at desktop + 390px · B2 rows for the module exercised · README section + any new `[decision]` in GAME.md · `.env.example` updated · ≤5-sentence summary to the owner. Extras: Auth/Sub — replay test; Scores — IST midnight test; Draw — Σ-invariants + publish-twice 409; Verification — cross-user RLS test; Submission — zip <50 MB, PDF script run live, notes ≤2048 chars.
