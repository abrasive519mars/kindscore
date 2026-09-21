-- Kindscore · migration 3 of 8 · functions
-- Security helpers used by RLS, plus the trigger functions that enforce game rules in the database.

-- ── Security helpers ──────────────────────────────────────────────────────────

-- security definer so a policy on profiles can call this without recursing into profiles' own RLS.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- SQL twin of engine/subscription/hasActiveAccess: active AND still inside the paid period.
-- The period check self-heals a missed webhook.
create or replace function has_active_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions
    where user_id = uid
      and status = 'active'
      and current_period_end > now()
  );
$$;

-- Rollover chain: what the next draw inherits from the last published one.
create or replace function next_rollover_in()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rollover_out_paise from draws where status = 'published' order by draw_month desc limit 1),
    0
  );
$$;

-- ── Trigger functions ─────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Build the public profile the moment an auth user exists, from the metadata the signup form sends.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, charity_id, charity_bps)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'charity_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'charity_bps')::smallint, 1000)
  );
  return new;
end;
$$;

-- SQL twin of engine/scores/selectRetainedScores: keep the five most recent rounds by date played
-- (created_at only breaks ties, which one-score-per-date makes unreachable). Runs after every
-- insert or update, so admin edits and seeds obey the same rule as the app.
create or replace function enforce_score_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from scores
  where user_id = new.user_id
    and id not in (
      select id from scores
      where user_id = new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return null;
end;
$$;

-- Every successful payment writes exactly one ledger row for the charity slice.
create or replace function record_payment_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into charity_contributions (charity_id, user_id, source, payment_id, amount_paise)
  values (new.charity_id, new.user_id, 'subscription', new.id, new.charity_paise);
  return null;
end;
$$;

-- A donation reaches the ledger once, when paid flips from false to true.
create or replace function record_donation_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid and not old.paid then
    insert into charity_contributions (charity_id, user_id, source, donation_id, amount_paise)
    values (new.charity_id, new.user_id, 'donation', new.id, new.amount_paise)
    on conflict (donation_id) do nothing;
  end if;
  return null;
end;
$$;
