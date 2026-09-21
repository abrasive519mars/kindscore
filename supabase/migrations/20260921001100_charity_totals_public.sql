-- Phase 8: impact metrics are public.

-- charity_totals was security_invoker, so a visitor (who may not read the ledger rows) saw ₹0 for
-- every charity. The view now runs as its owner: it exposes only the per-charity sum and the
-- number of distinct contributors — PRD §08.2 "impact metrics" — never a row, never a name.
drop view if exists charity_totals;
create view charity_totals as
select
  c.id                                      as charity_id,
  c.slug,
  c.name,
  c.is_active,
  coalesce(sum(cc.amount_paise), 0)::bigint as total_paise,
  count(distinct cc.user_id)::int           as contributor_count
from charities c
left join charity_contributions cc on cc.charity_id = c.id
group by c.id;

grant select on charity_totals to anon, authenticated;
