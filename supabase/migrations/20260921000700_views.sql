-- Kindscore · migration 7 of 8 · reporting views (§11.05)
-- security_invoker: the caller's RLS still applies, so members see only their own slice and admins see all.

-- Charity totals come from the ledger and nowhere else.
create view charity_totals
with (security_invoker = true) as
select
  c.id                                    as charity_id,
  c.slug,
  c.name,
  c.is_active,
  coalesce(sum(cc.amount_paise), 0)::bigint as total_paise,
  count(distinct cc.user_id)::int         as contributor_count
from charities c
left join charity_contributions cc on cc.charity_id = c.id
group by c.id;

-- Per published draw: the numbers, the pool, and how many won at each tier.
create view draw_statistics
with (security_invoker = true) as
select
  d.id                                                             as draw_id,
  d.draw_month,
  d.mode,
  d.numbers,
  d.active_subscriber_count,
  d.pool_paise,
  d.rollover_in_paise,
  d.jackpot_pool_paise,
  d.rollover_out_paise,
  d.published_at,
  count(r.id) filter (where r.match_count = 5)::int                 as five_match_winners,
  count(r.id) filter (where r.match_count = 4)::int                 as four_match_winners,
  count(r.id) filter (where r.match_count = 3)::int                 as three_match_winners,
  coalesce(sum(r.prize_paise), 0)::bigint                           as prizes_paise
from draws d
left join draw_results r on r.draw_id = d.id
where d.status = 'published'
group by d.id;

-- The admin overview tiles in one row.
create view reports_summary
with (security_invoker = true) as
select
  (select count(*)::int from profiles where role = 'member')                              as total_members,
  (select count(*)::int from subscriptions where status = 'active' and current_period_end > now()) as active_subscribers,
  (select coalesce(sum(pool_paise), 0)::bigint from payments
     where paid_at >= date_trunc('month', now()))                                         as pool_this_month_paise,
  (select coalesce(sum(amount_paise), 0)::bigint from charity_contributions)              as charity_total_paise,
  (select coalesce(sum(prize_paise), 0)::bigint from draw_results r
     join draws d on d.id = r.draw_id where d.status = 'published')                       as prizes_awarded_paise,
  (select coalesce(sum(prize_paise), 0)::bigint from draw_results r
     join winner_verifications v on v.result_id = r.id where v.payout_status = 'paid')     as prizes_paid_paise,
  (select count(*)::int from winner_verifications where review_status = 'submitted')      as proofs_awaiting_review,
  next_rollover_in()                                                                       as current_rollover_paise;
