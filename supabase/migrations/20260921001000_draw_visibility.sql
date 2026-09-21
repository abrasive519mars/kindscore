-- Phase 6: what the public may know about a published draw.

-- draw_statistics was security_invoker, so for a member (or anon) the per-tier winner counts
-- collapsed to their own rows. Aggregate counts of *published* draws are public by design
-- (PRD §06 "results visible to all users"); the view now runs as its owner and still exposes
-- nothing about unpublished draws and nothing about who won.
drop view if exists draw_statistics;
create view draw_statistics as
select
  d.id                                                             as draw_id,
  d.draw_month,
  d.mode,
  d.numbers,
  d.active_subscriber_count,
  d.pool_paise,
  d.rollover_in_paise,
  d.jackpot_pool_paise,
  d.four_pool_paise,
  d.three_pool_paise,
  d.rollover_out_paise,
  d.unclaimed_retained_paise,
  d.published_at,
  count(r.id) filter (where r.match_count = 5)::int                 as five_match_winners,
  count(r.id) filter (where r.match_count = 4)::int                 as four_match_winners,
  count(r.id) filter (where r.match_count = 3)::int                 as three_match_winners,
  coalesce(sum(r.prize_paise), 0)::bigint                           as prizes_paise
from draws d
left join draw_results r on r.draw_id = d.id
where d.status = 'published'
group by d.id;

grant select on draw_statistics to anon, authenticated;

-- How many people fund this month's pool, by plan. Two integers, no rows, no names — enough for
-- the engine to project the jackpot on a member's dashboard without reading subscriptions.
create or replace function active_subscriber_counts()
returns table (plan_interval plan_interval, subscribers int)
language sql
stable
security definer
set search_path = public
as $$
  select plan_interval, count(*)::int
  from subscriptions
  where status = 'active' and current_period_end > now()
  group by plan_interval;
$$;

revoke all on function active_subscriber_counts() from public;
grant execute on function active_subscriber_counts() to anon, authenticated;
