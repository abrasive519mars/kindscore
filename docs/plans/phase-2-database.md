# Phase 2 — The database

**Goal:** the schema, triggers, row-level security, transactional RPCs, storage buckets and reports views that every later phase writes to — developed and tested locally against a real Postgres, then pushed once to the new Supabase project.
**Grades:** PRD §16 "System design — quality of architecture decisions and data modelling" · §15 "Database — backend connected with proper schema".
**Done when:** `supabase db reset` applies every migration cleanly on local · `pnpm test:int` proves RLS, the rolling-five trigger, the ledger trigger and both RPCs · `pnpm db:types` generates `src/types/database.types.ts` · `supabase db push` succeeds against the cloud project · every file explained.

---

## 0. Who does what

| Step | Who | When |
|---|---|---|
| Start **Docker Desktop** (whale icon in the tray, wait until it says "running") | **You** | Before I run `supabase start` — I'll tell you when |
| Everything local: migrations, tests, types | Me | Throughout |
| Create the **new Supabase account + project** (§0.1 below) | **You** | Any time during the phase; needed only for the final push |
| Paste the three keys into `.env.local` (§0.2) | **You** | After creating the project |
| `supabase link` + `db push` + dashboard settings check (§0.3) | Me (settings check needs your dashboard login — I'll list what to verify) | End of phase |

### 0.1 Create the Supabase project — your steps

PRD §15.1 requires a **new** Supabase project, not a personal/existing one. A fresh account is safest.

1. Go to https://supabase.com → **Start your project** → sign up with a **new** email (or a fresh GitHub account). Free tier is fine.
2. **New project** →
   - Name: `kindscore`
   - Database password: generate a strong one and **save it in a password manager** — you need it for `supabase link`, and Supabase will not show it again.
   - Region: **Mumbai (ap-south-1)** — closest to the audience and to you.
   - Plan: Free.
3. Wait ~2 minutes for provisioning.
4. Copy three values from **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY` — this key bypasses all security; it never leaves the server and never goes in git.
5. Note the **project ref** — the 20-character id in the dashboard URL (`https://supabase.com/dashboard/project/<ref>`). I need it for `supabase link`.

### 0.2 Put the keys in `.env.local` — your step

Replace the placeholder lines (keep everything else):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
SUPABASE_SERVICE_ROLE_KEY=eyJ…
```

`.env.local` is git-ignored. Tell me the project ref in chat (it's not secret); do **not** paste the service-role key into chat.

### 0.3 Dashboard settings — I'll verify these with you at the end

Migrations can't change Auth settings, so these are dashboard clicks (I'll walk you through them; each is one toggle):

| Where | Setting | Value | Why |
|---|---|---|---|
| Authentication → Providers → Email | **Confirm email** | **OFF** | Supabase's built-in SMTP allows ~3 emails/hour; an evaluator signing up would never get the link |
| Authentication → URL Configuration | Site URL | `http://localhost:3000` now; the Vercel URL in Phase 11 | Where auth redirects land |
| Authentication → URL Configuration | Redirect URLs | `http://localhost:3000/auth/callback`, later `https://<app>.vercel.app/auth/callback` | Allow-list |
| Authentication → Providers → Email | Minimum password length | 8 | Sensible default |

Storage buckets and their policies are created by migration, not by hand.

---

## 1. Environment strategy

```
local (Docker)                          cloud (Supabase project)
──────────────                          ────────────────────────
supabase start      → Postgres 15, Auth, Storage, Studio on localhost
supabase db reset   → drops everything, re-applies every migration + seed.sql
pnpm test:int       → integration tests against local, as anon / member / admin
                                        supabase link --project-ref <ref>
                                        supabase db push  → applies the same migration files
```

Migrations are the **only** source of schema truth. Nothing is created by clicking in the dashboard (except the Auth toggles above, which are not schema).

Ports (from `supabase/config.toml` defaults): API `54321`, DB `54322`, Studio `54323`. Local anon/service-role keys are printed by `supabase start` and are the same on every machine — safe to commit in `.env.test`.

## 2. Conventions

| Thing | SQL | Why |
|---|---|---|
| Money | `bigint`, paise | matches `engine/money` |
| Percentages | `smallint`, basis points | matches `Bps` |
| Calendar dates | `date` | "one score per date" is a calendar day; never `timestamptz` |
| Timestamps | `timestamptz`, default `now()` | |
| IDs | `uuid default gen_random_uuid()` | |
| Enums | Postgres `enum` types | the type system enforces the vocabulary |
| Naming | `snake_case`, singular enum names, plural table names | Postgres norm |
| Security | RLS **enabled on every table**; policies use `(select is_admin())` | deny by default; the subselect is evaluated once per statement |

## 3. Migrations, in order

Timestamp-prefixed so the CLI applies them in sequence. Each file is idempotent-safe to re-run via `db reset` (which drops first).

### 3.1 `20260921000100_enums.sql`

```
app_role             member | admin
plan_interval        month | year
subscription_status  active | past_due | cancelled | lapsed
draw_mode            random | algorithmic
draw_status          draft | simulated | published
review_status        awaiting_proof | submitted | approved | rejected
payout_status        pending | paid
contribution_source  subscription | donation
```

Mirror of the engine's string unions — one vocabulary, both sides.

### 3.2 `20260921000200_tables.sql`

Every table from `ARCHITECTURE.md` §1, with these details made explicit:

| Table | Notable constraints |
|---|---|
| `profiles` | `id uuid pk references auth.users on delete cascade` · `role app_role not null default 'member'` · `charity_bps smallint not null check (charity_bps between 1000 and 7000)` · `stripe_customer_id text unique` |
| `charities` | `slug text unique` · `outcome_line text` (the "₹50 a month = …" sentence) · `featured_rank int` · `is_active bool default true` · `cover_path text` |
| `charity_media` | `(charity_id, sort_order)` index |
| `charity_events` | `starts_at timestamptz` |
| `subscriptions` | `stripe_subscription_id text unique` · `source text not null default 'stripe'` · **partial unique** `create unique index one_live_subscription on subscriptions (user_id) where status in ('active','past_due')` |
| `payments` | `stripe_invoice_id text unique` · `check (charity_paise + pool_paise + platform_paise = amount_paise)` · charity_id + charity_bps snapshotted |
| `donations` | `stripe_checkout_session_id text unique` · `paid bool default false` |
| `charity_contributions` | `check (num_nonnulls(payment_id, donation_id) = 1)` — exactly one source |
| `scores` | `score smallint check (score between 1 and 45)` · `played_on date` · **`unique (user_id, played_on)`** · index `(user_id, played_on desc)` |
| `draws` | `draw_month date unique check (extract(day from draw_month) = 1)` · `numbers smallint[] check (numbers is null or cardinality(numbers) = 5)` · money columns `bigint not null default 0` · `entries_hash text` · **partial unique** `create unique index one_open_draw on draws ((true)) where status <> 'published'` |
| `draw_entries` | `scores smallint[] not null check (cardinality(scores) = 5)` · `unique (draw_id, user_id)` |
| `draw_results` | `match_count smallint check (match_count in (3,4,5))` · `prize_paise bigint` · `unique (draw_id, user_id)` |
| `winner_verifications` | `result_id uuid unique references draw_results` · `resubmissions smallint default 0` · `check (payout_status = 'pending' or review_status = 'approved')` |
| `stripe_events` | `id text primary key` (Stripe's `evt_…`) |
| `audit_log` | `diff jsonb` |

Foreign keys: `on delete cascade` from `auth.users` → `profiles` → everything user-owned; `on delete restrict` from `charities` (soft-delete instead).

### 3.3 `20260921000300_functions.sql`

| Function | Purpose |
|---|---|
| `is_admin() returns boolean` — `security definer`, `stable` | `exists (select 1 from profiles where id = auth.uid() and role = 'admin')` without recursing into `profiles`' own RLS |
| `has_active_access(uid uuid) returns boolean` | `exists (subscriptions where user_id = uid and status = 'active' and current_period_end > now())` — the SQL twin of `engine/subscription/hasActiveAccess` |
| `set_updated_at()` trigger fn | boilerplate |
| `handle_new_user()` trigger fn | on `auth.users` insert → insert `profiles` from `raw_user_meta_data` (`full_name`, `charity_id`, `charity_bps` default 1000) |
| `enforce_score_window()` trigger fn | after insert/update on `scores`: `delete from scores where user_id = new.user_id and id not in (select id … order by played_on desc, created_at desc limit 5)` — the SQL twin of `engine/scores/selectRetainedScores` |
| `record_charity_contribution()` trigger fn | after insert on `payments` → one ledger row (`source = 'subscription'`); after update of `paid` on `donations` when it flips true → one ledger row (`source = 'donation'`) |
| `next_rollover_in() returns bigint` | `rollover_out_paise` of the latest published draw, else 0 |

### 3.4 `20260921000400_triggers.sql`

Wires 3.3 to tables: `on_auth_user_created` (auth.users) · `scores_enforce_window` (scores, after insert or update) · `set_updated_at` on `profiles`, `charities`, `charity_events`, `subscriptions`, `draws`, `winner_verifications` · `payments_to_ledger` · `donations_to_ledger`.

### 3.5 `20260921000500_rls.sql`

`alter table … enable row level security` × 15, then the policy matrix from `ARCHITECTURE.md` §2. Highlights:

- `profiles`: member select/update own; **`revoke update (role, stripe_customer_id) on profiles from authenticated`**.
- `subscriptions`, `payments`, `stripe_events`: select own / admin all; **no insert/update policy for anyone** — service role only.
- `scores`: member CRUD own where `has_active_access(auth.uid())` on insert.
- `draws`: member select where `status = 'published'`; admin all.
- `draw_entries`, `draw_results`: member select own **and** parent draw published.
- `winner_verifications`: member select own; member update own **only when** `review_status = 'awaiting_proof' or 'rejected'` and only `proof_path` (column revoke on the rest).
- `charities` + media + events: anon select where `is_active`; admin all.
- `audit_log`: admin only.

### 3.6 `20260921000600_rpc.sql`

```sql
save_simulation(
  p_draw_id uuid, p_mode draw_mode, p_numbers smallint[],
  p_active_subscriber_count int, p_pool_paise bigint, p_rollover_in_paise bigint,
  p_jackpot_pool_paise bigint, p_four_pool_paise bigint, p_three_pool_paise bigint,
  p_rollover_out_paise bigint, p_unclaimed_retained_paise bigint,
  p_entries_hash text,
  p_entries jsonb,   -- [{user_id, scores, match_count}]
  p_results jsonb    -- [{user_id, match_count, prize_paise}]
) returns draws
```
`security definer`, admin-only (`if not is_admin() then raise`). Locks the draw row `for update`; refuses if `status = 'published'`; deletes prior entries/results; inserts new; sets all snapshot columns + `status = 'simulated'`, `simulated_at = now()`. One transaction.

```sql
publish_draw(p_draw_id uuid) returns draws
```
Admin-only. `update draws set status='published', published_at=now(), published_by=auth.uid() where id = p_draw_id and status = 'simulated' returning *`. If zero rows: already published → return the row unchanged (idempotent); still draft → raise `Simulate first`. Then `insert into winner_verifications (result_id, user_id) select id, user_id from draw_results where draw_id = p_draw_id on conflict do nothing`.

The engine computes every number; the RPCs only persist atomically. Nothing is recalculated in SQL.

### 3.7 `20260921000700_views.sql`

`charity_totals` (charity_id, name, total_paise, contributor_count) · `reports_summary` (single row: total_users, active_subscribers, pool_this_month_paise, charity_total_paise, prizes_paid_paise) · `draw_statistics` (per published draw: month, mode, winners per tier, pool, rollover). Views are `security invoker` so RLS still applies; admin pages read them.

### 3.8 `20260921000800_storage.sql`

Buckets via `insert into storage.buckets`: `proofs` (private, 5 MB, `{image/png,image/jpeg,image/webp}`), `charity-media` (public, 2 MB). Policies on `storage.objects`: proofs — insert/select where `bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text`; admin select all; charity-media — public select, admin write.

### 3.9 `supabase/seed.sql`

The 7 charities (slug, name, tagline, description, category, city, outcome line, `cover_path = seed/<slug>/cover.webp`, featured Udaan) and their events. Deterministic UUIDs so tests and later seeds can reference them. No users — creating auth users needs the admin API, which is `scripts/seed.ts` in Phase 11.

## 4. Generated types

`pnpm db:types` → `supabase gen types typescript --local > src/types/database.types.ts`. Committed. Regenerated after every migration. Gives `Database["public"]["Tables"]["scores"]["Row"]` etc. to the repositories in Phase 3+.

## 5. Integration tests — `tests/integration/`

| File | Proves |
|---|---|
| `setup.ts` | loads `.env.test` (local URLs/keys), exposes `adminClient` (service role), `anonClient`, `createUser(role)` (admin API), `clientAs(user)` (signs in, returns an RLS-bound client), truncation between suites |
| `rls.test.ts` | anon: reads charities, **cannot** read scores/subscriptions/profiles · member: reads own scores only, another member's return empty, `update profiles set role='admin'` fails, draft draw invisible · admin: reads everything |
| `scores.test.ts` | 6th insert → exactly 5 rows, the oldest `played_on` gone regardless of insert order · duplicate `(user_id, played_on)` → unique violation · `46` → check violation · insert without active subscription → RLS denies |
| `ledger.test.ts` | one payment insert → exactly one `charity_contributions` row with the right amount/charity · a payment whose parts don't sum → check violation · donation `paid` flip → ledger row, flipping twice does not duplicate |
| `draws.test.ts` | `save_simulation` twice replaces entries/results · `publish_draw` flips status and creates one verification per result · second publish returns the same row, no new verifications · publish on draft raises · second open draw violates `one_open_draw` · member cannot call either RPC |

Run: `supabase start` → `supabase db reset` → `pnpm test:int`.

## 6. Order of work

1. `supabase init` → `config.toml` (email confirmations off locally too, for parity)
2. **You start Docker Desktop** → `supabase start`
3. Migrations 3.1 → 3.8, applying with `db reset` after each and fixing errors immediately
4. `seed.sql`
5. `pnpm db:types`
6. Integration test harness + the four suites
7. Commit `Phase 2: database`
8. **You create the cloud project + keys** (§0.1, §0.2) — any time before this step
9. `supabase link` → `supabase db push` → you toggle the Auth settings (§0.3) → I smoke-test with the cloud anon key
10. Export `schema.dbml` for the submission diagram (Phase 11 uses it)

## 7. Explicitly not in this phase

No Next.js Supabase clients (Phase 3). No Stripe (Phase 5). No users or images seeded (Phase 11 — needs the Auth admin API and Storage uploads). No UI.
