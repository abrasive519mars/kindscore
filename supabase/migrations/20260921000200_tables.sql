-- Kindscore · migration 2 of 8 · tables
-- Conventions: money = bigint paise · percentages = smallint basis points · calendar dates = date.
-- Every table gets row-level security in migration 5; until then nothing is readable by clients.

-- ── People ────────────────────────────────────────────────────────────────────

-- Public mirror of auth.users plus the member's role and charity choice (§08.1).
-- Rows are created by the handle_new_user trigger, never by clients.
create table profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null,
  full_name          text not null default '',
  role               app_role not null default 'member',
  charity_id         uuid,                                   -- fk added after charities exists
  charity_bps        smallint not null default 1000
                     check (charity_bps between 1000 and 7000 and charity_bps % 500 = 0),
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Charities (§08) ───────────────────────────────────────────────────────────

create table charities (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  tagline       text not null default '',
  description   text not null default '',
  category      text not null,
  city          text not null default '',
  -- "₹50 a month = 5 school days for one girl" — the human unit shown wherever money is (DESIGN.md §2.4)
  outcome_line  text not null default '',
  cover_path    text,
  website_url   text,
  featured_rank int,
  is_active     boolean not null default true,     -- soft delete; charities with contributors are never hard-deleted
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index charities_category_idx on charities (category);
create index charities_featured_idx on charities (featured_rank) where featured_rank is not null;

alter table profiles
  add constraint profiles_charity_fk foreign key (charity_id) references charities (id) on delete restrict;

create table charity_media (
  id           uuid primary key default gen_random_uuid(),
  charity_id   uuid not null references charities (id) on delete cascade,
  storage_path text not null,
  alt          text not null default '',
  sort_order   smallint not null default 0
);
create index charity_media_order_idx on charity_media (charity_id, sort_order);

create table charity_events (
  id          uuid primary key default gen_random_uuid(),
  charity_id  uuid not null references charities (id) on delete cascade,
  title       text not null,
  description text not null default '',
  starts_at   timestamptz not null,
  location    text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index charity_events_upcoming_idx on charity_events (charity_id, starts_at);

-- ── Subscriptions & money (§04, §07, §08) ─────────────────────────────────────

-- Local mirror of the Stripe subscription; the gate for every authenticated request.
-- source = 'seed' marks demo rows that have no Stripe object behind them.
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id        text not null,
  plan_interval          plan_interval not null,
  status                 subscription_status not null,
  current_period_start   timestamptz not null,
  current_period_end     timestamptz not null,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  source                 text not null default 'stripe',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_user_status_idx on subscriptions (user_id, status);
-- A member has at most one live subscription; historical cancelled/lapsed rows are kept.
create unique index one_live_subscription on subscriptions (user_id)
  where status in ('active', 'past_due');

-- One row per successful Stripe invoice: the immutable three-way split (engine/charity/splitPayment).
create table payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles (id) on delete cascade,
  subscription_id   uuid references subscriptions (id) on delete set null,
  stripe_invoice_id text not null unique,
  amount_paise      bigint not null check (amount_paise >= 0),
  charity_id        uuid not null references charities (id) on delete restrict,   -- snapshot at payment time
  charity_bps       smallint not null,                                            -- snapshot at payment time
  charity_paise     bigint not null check (charity_paise >= 0),
  pool_paise        bigint not null check (pool_paise >= 0),
  platform_paise    bigint not null check (platform_paise >= 0),
  paid_at           timestamptz not null default now(),
  constraint payments_split_sums check (charity_paise + pool_paise + platform_paise = amount_paise)
);
create index payments_paid_at_idx on payments (paid_at);
create index payments_user_idx on payments (user_id);

-- One-off gifts "not tied to gameplay" (§08.1). paid flips true from the Stripe webhook only.
create table donations (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references profiles (id) on delete cascade,
  charity_id                 uuid not null references charities (id) on delete restrict,
  amount_paise               bigint not null check (amount_paise > 0),
  stripe_checkout_session_id text unique,
  paid                       boolean not null default false,
  created_at                 timestamptz not null default now()
);

-- The single ledger every charity total is summed from. Written only by triggers.
create table charity_contributions (
  id           uuid primary key default gen_random_uuid(),
  charity_id   uuid not null references charities (id) on delete restrict,
  user_id      uuid not null references profiles (id) on delete cascade,
  source       contribution_source not null,
  payment_id   uuid unique references payments (id) on delete cascade,
  donation_id  uuid unique references donations (id) on delete cascade,
  amount_paise bigint not null check (amount_paise >= 0),
  created_at   timestamptz not null default now(),
  constraint contribution_has_one_source check (num_nonnulls(payment_id, donation_id) = 1)
);
create index charity_contributions_charity_idx on charity_contributions (charity_id);

-- ── Scores (§05) ──────────────────────────────────────────────────────────────

-- A member's Stableford rounds. The enforce_score_window trigger keeps only the latest five by played_on.
create table scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  score      smallint not null check (score between 1 and 45),
  played_on  date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_score_per_date unique (user_id, played_on)
);
create index scores_user_recent_idx on scores (user_id, played_on desc);

-- ── Draws (§06, §07) ──────────────────────────────────────────────────────────

-- One row per monthly draw, carrying a full snapshot of the inputs so it stays auditable after churn.
create table draws (
  id                       uuid primary key default gen_random_uuid(),
  draw_month               date not null unique check (extract(day from draw_month) = 1),
  mode                     draw_mode not null default 'random',
  status                   draw_status not null default 'draft',
  numbers                  smallint[] check (numbers is null or cardinality(numbers) = 5),
  active_subscriber_count  int not null default 0,
  pool_share_bps           smallint not null default 3000,
  pool_paise               bigint not null default 0,
  rollover_in_paise        bigint not null default 0,
  jackpot_pool_paise       bigint not null default 0,
  four_pool_paise          bigint not null default 0,
  three_pool_paise         bigint not null default 0,
  rollover_out_paise       bigint not null default 0,
  unclaimed_retained_paise bigint not null default 0,
  entries_hash             text,                       -- stale-draft guard: hash of eligible entries at simulate time
  simulated_at             timestamptz,
  published_at             timestamptz,
  published_by             uuid references profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
-- Only one draw may be open (draft or simulated) at a time.
create unique index one_open_draw on draws ((true)) where status <> 'published';
create index draws_published_idx on draws (draw_month desc) where status = 'published';

-- Snapshot of each eligible member's five scores at simulate time; proves fairness if scores change later.
create table draw_entries (
  id          uuid primary key default gen_random_uuid(),
  draw_id     uuid not null references draws (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  scores      smallint[] not null check (cardinality(scores) = 5),
  match_count smallint not null default 0 check (match_count between 0 and 5),
  constraint one_entry_per_member unique (draw_id, user_id)
);

-- Engine output per winner. Immutable once the draw is published.
create table draw_results (
  id          uuid primary key default gen_random_uuid(),
  draw_id     uuid not null references draws (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  entry_id    uuid not null references draw_entries (id) on delete cascade,
  match_count smallint not null check (match_count in (3, 4, 5)),
  prize_paise bigint not null check (prize_paise >= 0),
  constraint one_result_per_member unique (draw_id, user_id)
);
create index draw_results_user_idx on draw_results (user_id);

-- ── Winner verification (§09) ─────────────────────────────────────────────────

-- The mutable workflow row; kept apart from draw_results so results never change.
create table winner_verifications (
  id             uuid primary key default gen_random_uuid(),
  result_id      uuid not null unique references draw_results (id) on delete cascade,
  user_id        uuid not null references profiles (id) on delete cascade,
  proof_path     text,
  review_status  review_status not null default 'awaiting_proof',
  payout_status  payout_status not null default 'pending',
  resubmissions  smallint not null default 0,
  reviewed_by    uuid references profiles (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint paid_only_when_approved check (payout_status = 'pending' or review_status = 'approved')
);
create index winner_verifications_queue_idx on winner_verifications (review_status, payout_status);

-- ── Operational ───────────────────────────────────────────────────────────────

-- Webhook idempotency: Stripe's event id is the primary key, so a replay is a no-op insert.
create table stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- Admin edits to member data after a draw exists.
create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references profiles (id) on delete set null,
  action       text not null,
  target_table text not null,
  target_id    uuid,
  diff         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_target_idx on audit_log (target_table, target_id);
