# Kindscore — Architecture spec

Stack (fixed): Next.js App Router + TypeScript + Tailwind + Framer Motion · Supabase (Auth, Postgres, RLS, Storage) · Stripe test mode (INR ₹499/mo, ₹4,999/yr) · Vercel · Vitest. No seeded RNG — simulate saves numbers + winners as a draft; publish flips status.

Conventions: **all money is `bigint` paise**; **all percentages are basis points** (`_bps smallint`, 10% = 1000). Timezone constant `Asia/Kolkata`.

## 1. Database schema

**Enums:** `app_role (member|admin)` · `plan_interval (month|year)` · `subscription_status (active|past_due|cancelled|lapsed)` · `draw_mode (random|algorithmic)` · `draw_status (draft|simulated|published)` · `review_status (awaiting_proof|submitted|approved|rejected)` · `payout_status (pending|paid)` · `contribution_source (subscription|donation)`. Match tier is `smallint check (match_count in (3,4,5))` — the math needs the integer.

| Table | Key columns | Constraints / indexes | Why |
|---|---|---|---|
| `profiles` | `id uuid PK → auth.users`, `email`, `full_name`, `role app_role default 'member'`, `charity_id → charities`, `charity_bps smallint check 1000..7000`, `stripe_customer_id text unique`, timestamps | Created by trigger on `auth.users` insert (reads `charity_id`/`charity_bps` from signup metadata) | Public mirror of auth user + role + charity choice (§08.1) |
| `subscriptions` | `id`, `user_id`, `stripe_subscription_id unique`, `stripe_price_id`, `plan_interval`, `status`, `current_period_start/end timestamptz`, `cancel_at_period_end bool`, `canceled_at`, `source text default 'stripe'` (`'seed'` for seeded rows) | Partial unique `(user_id) where status in ('active','past_due')`; index `(user_id, status)` | Local Stripe mirror; the gate for every request (§04) |
| `payments` | `id`, `user_id`, `subscription_id`, `stripe_invoice_id unique`, `amount_paise`, `charity_id` (snapshot), `charity_bps` (snapshot), `charity_paise`, `pool_paise`, `platform_paise`, `paid_at` | `check (charity_paise + pool_paise + platform_paise = amount_paise)`; index `(paid_at)` | Immutable per-payment 3-way split; source of reports |
| `charity_contributions` | `id`, `charity_id`, `user_id`, `source`, `payment_id`, `donation_id`, `amount_paise`, `created_at` | `check (num_nonnulls(payment_id, donation_id) = 1)`; index `(charity_id)` | Single ledger charity totals are summed from — never sum two tables |
| `donations` | `id`, `user_id`, `charity_id`, `amount_paise`, `stripe_checkout_session_id unique`, `paid bool`, `created_at` | | One-off donations "not tied to gameplay" (§08.1) |
| `scores` | `id`, `user_id`, `score smallint check 1..45`, `played_on date`, timestamps | `unique (user_id, played_on)`; index `(user_id, played_on desc)` | The user's numbers (§05). `date`, never `timestamptz` |
| `charities` | `id`, `slug unique`, `name`, `tagline`, `description`, `category text`, `city`, `logo_path`, `cover_path`, `website_url`, `featured_rank int null`, `is_active bool` | index `(category)`, `(featured_rank) where not null` | Directory + spotlight (§08.2). Soft-delete via `is_active` |
| `charity_media` | `id`, `charity_id`, `storage_path`, `alt`, `sort_order` | index `(charity_id, sort_order)` | Gallery |
| `charity_events` | `id`, `charity_id`, `title`, `description`, `starts_at timestamptz`, `location` | index `(charity_id, starts_at)` | "Upcoming events such as golf days" |
| `draws` | `id`, `draw_month date unique check (extract(day from draw_month) = 1)`, `mode`, `status`, `numbers smallint[] check (cardinality(numbers) = 5)` null until simulated, `active_subscriber_count int`, `pool_share_bps`, `pool_paise`, `rollover_in_paise`, `jackpot_pool_paise`, `four_pool_paise`, `three_pool_paise`, `rollover_out_paise`, `unclaimed_retained_paise`, `entries_hash text`, `simulated_at`, `published_at`, `published_by` | Partial unique `((true)) where status <> 'published'` → one open draw at a time | Monthly draw + full audit snapshot of pool inputs |
| `draw_entries` | `id`, `draw_id`, `user_id`, `scores smallint[]` (5), `match_count smallint` | `unique (draw_id, user_id)` | Snapshot of each eligible user's scores at simulate time — proves fairness even if scores change later |
| `draw_results` | `id`, `draw_id`, `user_id`, `entry_id`, `match_count check in (3,4,5)`, `prize_paise` | `unique (draw_id, user_id)`; index `(user_id)` | Immutable engine output per winner |
| `winner_verifications` | `id`, `result_id unique`, `user_id`, `proof_path`, `review_status default 'awaiting_proof'`, `reviewed_by`, `reviewed_at`, `review_note`, `payout_status default 'pending'`, `paid_at` | `check (payout_status = 'pending' or review_status = 'approved')` | Mutable workflow (§09); separate so `draw_results` never changes |
| `stripe_events` | `id text PK` (Stripe event id), `type`, `received_at`, `processed_at` | | Webhook idempotency |
| `audit_log` | `id`, `actor_id`, `action`, `target_table`, `target_id`, `diff jsonb`, `created_at` | index `(target_table, target_id)` | Admin edits to scores/subscriptions after a draw |

### Trigger vs application logic

| Rule | Where | Why |
|---|---|---|
| Create profile on signup | DB trigger (`security definer`) | Must happen even if client dies mid-signup |
| Rolling-5 eviction | DB trigger `after insert or update on scores` → delete rows not in top 5 by `played_on desc, created_at desc` | Invariant holds for admin edits and seeds too. Engine has a pure `selectRetainedScores()` twin for UI preview + tests |
| Backdated score older than all 5 kept | **Application: reject** with "older than your 5 kept scores" | Silent insert-then-evict would confuse users |
| `updated_at` | trigger | boilerplate |
| Payment / paid donation → ledger row | trigger | Supabase JS has no transactions; trigger guarantees atomicity |
| Draw math | pure TS | testable |
| Multi-table draw writes | Postgres RPCs `save_simulation(draw_id, payload jsonb)`, `publish_draw(draw_id)` | Only way to get a transaction from Supabase JS |
| Pool figure | app, snapshotted into `draws` | Pool = Σ over active subscribers of *monthly-equivalent* pool slice: monthly `499×30% = 14,970 p`; yearly `4,999×30%/12 = 12,497 p`. Literal §07 "based on active subscriber count"; yearly payers don't spike one month |

**Decision:** charity "up to 100%" + fixed 30% pool is arithmetically impossible → `charity_bps` capped at `10000 − POOL_SHARE_BPS` = 7000 (derived, not hardcoded).

## 2. RLS

```sql
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;
create function has_active_access(uid uuid) returns boolean ... $$
  select exists (select 1 from subscriptions
    where user_id = uid and status = 'active' and current_period_end > now())
$$;
```
`security definer` avoids recursive RLS on `profiles`. Use `(select is_admin())` in policies so Postgres evaluates once per statement. The `> now()` clause self-heals "lapsed" if a webhook is missed.

| Table | Member | Admin | Notes |
|---|---|---|---|
| `profiles` | select/update own | all | `revoke update (role, stripe_customer_id) on profiles from authenticated` |
| `subscriptions`, `payments`, `stripe_events` | select own | select all | **No insert/update for anyone** — service role (webhook) only |
| `scores` | CRUD own; insert requires `has_active_access(auth.uid())` | CRUD all | |
| `charities`, `charity_media`, `charity_events` | select where `is_active` (anon too) | all | |
| `donations` | insert own (`paid=false`), select own | all | `paid` flipped by webhook only |
| `charity_contributions` | select own | all | write via trigger only |
| `draws` | select where `status = 'published'` | all | Draft invisible to members |
| `draw_entries`, `draw_results` | select own where parent draw published | all | |
| `winner_verifications` | select own; update own **only** `proof_path`, only when `review_status = 'awaiting_proof'` | all | |
| Storage `proofs` (private, 5 MB, png/jpeg/webp) | insert/select where `(storage.foldername(name))[1] = auth.uid()::text` | select all | Path `{user_id}/{result_id}.{ext}` |
| Storage `charity-media` (public read, 2 MB) | select | insert/update/delete | |

**Service role safety:** one module `src/lib/supabase/admin.ts` with `import 'server-only'`, imported only by the webhook route and `scripts/seed.ts`. ESLint `no-restricted-imports` elsewhere. Webhook verifies Stripe signature *before* constructing the admin client.

## 3. Subscription lifecycle

**Checkout:** server action `startCheckout(interval)` → get-or-create Stripe customer (store `stripe_customer_id`) → Checkout Session `mode: 'subscription'`, `client_reference_id: user.id`, `metadata.user_id`, `subscription_data.metadata.user_id`, `billing_address_collection: 'required'` (Indian Stripe accounts require name + address on INR charges even in test mode).

| Webhook event | Handler |
|---|---|
| `checkout.session.completed` | retrieve subscription → upsert `subscriptions` by `stripe_subscription_id` |
| `invoice.paid` | insert `payments` (idempotent on `stripe_invoice_id`) with split; upsert sub `active` + period dates |
| `invoice.payment_failed` | `status = 'past_due'` |
| `customer.subscription.updated` | re-sync status / period / `cancel_at_period_end` / price from the object |
| `customer.subscription.deleted` | `status = cancel_at_period_end ? 'cancelled' : 'lapsed'` |

Always upsert from the **retrieved Stripe object**, never from event ordering. Insert `stripe_events.id` first; unique violation → return 200 immediately.

**Status mapping** (`engine/subscription/mapStripeStatus.ts`): `active|trialing → active`; `past_due → past_due`; `canceled → cancelled`; `unpaid|incomplete_expired|incomplete → lapsed`. Access = `active && period_end > now`. `cancel_at_period_end = true` stays `active` with UI "ends on {date}".

**Cheap real-time check (§04):** never call Stripe on read. Middleware refreshes auth cookie only. `(member)` layout calls `getAccessState()` wrapped in React `cache()` → one indexed query per request. Every mutating server action calls `requireActiveSubscriber()` — layouts don't protect actions. Success page (`?session_id=`) calls `syncSubscriptionFromStripe` once as a fallback when the webhook hasn't landed.

**Split** (`engine/charity/splitPayment.ts`): `charity = floor(amount × charity_bps / 10000)`, `pool = floor(amount × POOL_SHARE_BPS / 10000)`, `platform = amount − charity − pool`.

## 4. Draw engine (`src/engine/draw/`, pure TS)

| Function | Input | Output |
|---|---|---|
| `buildFrequencyMap(entries)` | `EligibleEntry[]` | `Map<number, count>` over each user's *distinct* scores |
| `smoothFrequency(freq)` | frequency map | `smoothed(n) = Σ KERNEL[k]·freq(n+k)`, k ∈ −2..2, `KERNEL = [¼, ½, 1, ½, ¼]`, neighbours outside 1–45 ignored. Removes single-number sampling gaps so the draw follows the shape of how golfers score (GAME.md §3 decision) |
| `generateNumbers(mode, freq, rng)` | `rng` injected (`crypto.randomInt` in prod, fixed in tests) | sorted 5-tuple, 1–45, distinct. Weight = `ALGORITHMIC_BASELINE_WEIGHT + smoothFrequency(freq)(n)` (algorithmic) or `1` (random). One weighted-without-replacement code path |
| `matchEntries(numbers, entries)` | | `{userId, scores, matchCount}[]`, `matchCount = |set(scores) ∩ set(numbers)|` |
| `computePool(activeSubs)` | `{interval}[]` | `Σ monthlyEquivalentPoolPaise(interval)` |
| `allocatePrizes(pool, rolloverIn, matched)` | | `four = floor(pool×3500/10000)`, `three = floor(pool×2500/10000)`, `jackpot = pool − four − three + rolloverIn` (jackpot absorbs rounding so tiers sum exactly). Per tier: `share = floor(tier/n)`, first `tier − share×n` winners (sorted by userId) get +1 paise. `rolloverOut = jackpot if no 5-match else 0`; `unclaimedRetained = four/three tiers with zero winners` |

**Simulate** (`DrawService.simulate(month, mode)`): users with active access + 5 scores → freq → numbers → match → pool → `rolloverIn` = last published draw's `rollover_out` → RPC `save_simulation` (deletes old entries/results, inserts new, sets numbers/pool snapshot/`entries_hash`/`status = 'simulated'`, one transaction, `select … for update` on the draw row).
**Publish** (`publish_draw`): `update draws set status='published', published_at=now() where id=$1 and status='simulated' returning *`; then insert `winner_verifications` per result. Zero rows + already published → return existing (idempotent). Nothing recomputed.
**Stale guard:** if any eligible user's scores change after simulate, `entries_hash` mismatches → admin sees "Scores changed since simulation — re-simulate", Publish disabled.
**Concurrency:** partial unique index (one open draw), row lock in RPC, re-simulate refused when `published`.

## 5. Folder structure

```
src/
  config/         constants.ts (SCORE_MIN/MAX, SCORE_WINDOW=5, POOL_SHARE_BPS=3000,
                  TIER_BPS={5:4000,4:3500,3:2500}, CHARITY_MIN_BPS=1000, CHARITY_MAX_BPS derived,
                  ALGORITHMIC_BASELINE_WEIGHT, SMOOTHING_KERNEL, PLANS, TIMEZONE, PROOF_MAX_BYTES, PROOF_MIME_TYPES)
                  env.ts (zod-parsed process.env, fails at boot)
  engine/         zero imports from next/supabase/stripe
    draw/  scores/  money/paise.ts  subscription/  charity/  verification/stateMachine.ts  errors.ts
  schemas/        zod: score, charity, event, draw, donation, profile (shared by form + action)
  repositories/
    interfaces/   ScoreRepository, DrawRepository, SubscriptionRepository, CharityRepository, ...
    supabase/     one impl per interface; createRepositories(client)
  services/       DrawService, ScoreService, SubscriptionService, WebhookHandler,
                  WinnerService, CharityService, ReportsService
  lib/            supabase/{server,browser,admin,middleware}.ts  stripe.ts
                  action-result.ts  http-error.ts  auth-guards.ts
  app/
    (marketing)/  page, how-it-works, charities/, charities/[slug], draws, pricing
    (auth)/       login, signup, auth/callback/route.ts
    (member)/app  layout (auth + access state) · dashboard, scores, draws, charity, winnings, subscription, settings
    (admin)/admin layout (is_admin) · users, draws, charities, winners, reports
    api/stripe/webhook/route.ts   api/cron/keepalive/route.ts
  components/     ui/ (primitives) motion/ marketing/ dashboard/ admin/
  types/          database.types.ts (generated)
supabase/migrations/  scripts/seed.ts  tests/ (mirrors engine/)
```
Server actions (colocated `actions.ts`) for every first-party mutation → `ActionResult<T>`. Route handlers only for third-party callers (Stripe webhook raw body + signature; Supabase auth callback; cron).

**Errors:** `AppError(code, status, userMessage)` → `ValidationError 400`, `AuthenticationError 401`, `SubscriptionRequiredError 403`, `ForbiddenError 403`, `NotFoundError 404`, `ConflictError 409` (duplicate date, already published), `RuleViolationError 422` (range, <5 scores, illegal transition), `ExternalServiceError 502`. Actions catch → `{ok:false, error}`; route handlers `toResponse(err)`; UI shows `userMessage` via `useActionState`; unknown → log + generic + `error.tsx`.

## 6. Auth & roles

- Supabase Auth email + password; **email confirmation disabled** in the new project (free-tier SMTP ≈ 3 emails/hour would brick evaluator signup) — documented.
- Signup: email, password, name, charity, percentage → `options.data`; trigger builds `profiles`.
- Admin: seed script creates auth user via admin API then sets `role = 'admin'`. No promotion UI. Role column locked by column-level revoke.
- Middleware: refresh session; `/app/**`, `/admin/**` unauthenticated → `/login?next=`. No DB in middleware.
- `(admin)/layout` checks `is_admin()`; `(member)/layout` loads access state. RLS is the real guard; layouts are UX.
- **Non-subscriber experience:** logged in, dashboard shell renders with locked cards (score panel blurred, "Subscribe to unlock"), jackpot ticker visible, profile/charity editable, donations allowed, score actions refused, excluded from draws. `past_due` → banner + Stripe Customer Portal. `cancelled`/`lapsed` → re-subscribe CTA; scores retained.

## 7. Pitfalls

| # | Pitfall | Avoidance |
|---|---|---|
| 1 | Stripe signature fails on Vercel | `await req.text()`, `constructEvent`, `export const runtime = 'nodejs'`; `stripe listen --forward-to` locally |
| 2 | Webhooks out of order / duplicated | Retrieve object from Stripe, upsert by Stripe id, `stripe_events` PK dedupe |
| 3 | Service role leaks to client | `server-only`, ESLint restricted import, never `NEXT_PUBLIC_` |
| 4 | Recursive `profiles` RLS | `is_admin()` security definer |
| 5 | Date shifts in IST | `played_on` is `date`; send `YYYY-MM-DD` from picker, never `toISOString()`; "today" in `Asia/Kolkata` |
| 6 | Float money | bigint paise + bps; jackpot absorbs rounding; check constraint on split sum |
| 7 | Backdated score self-evicts silently | Reject in service with message |
| 8 | Score edits between simulate and publish | Entries snapshot + `entries_hash` stale guard; `[decision]` |
| 9 | No transactions in Supabase JS | RPCs for simulate/publish; triggers for ledger |
| 10 | OneDrive path with apostrophe + spaces | Repo stays in OneDrive (user decision). Quote every path; exclude `node_modules` + `.next` from OneDrive sync (Settings → Sync → Choose folders); use `pnpm`; `WATCHPACK_POLLING=true` if the watcher fails |
| 11 | Supabase free tier pauses after 7 idle days | Vercel cron `0 3 * * *` → `/api/cron/keepalive` (one SELECT, `CRON_SECRET`) |
| 12 | `Math.random` for a lottery | `crypto.randomInt` |
