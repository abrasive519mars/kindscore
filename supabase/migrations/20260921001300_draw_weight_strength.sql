-- Phase 12: the admin configures how strongly algorithmic mode follows the scores (PRD §11
-- "configure draw logic"). Recorded per draw with the simulation, so a published result states
-- exactly what produced it. 10000 bps = today's behaviour; 0 = flat, indistinguishable from random.

alter table draws
  add column weight_strength_bps smallint not null default 10000
    check (weight_strength_bps between 0 and 10000);

-- save_simulation gains the parameter (defaulted, so older callers and the seed keep working).
drop function if exists save_simulation(
  uuid, draw_mode, smallint[], int, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, jsonb, jsonb
);

create or replace function save_simulation(
  p_draw_id                  uuid,
  p_mode                     draw_mode,
  p_numbers                  smallint[],
  p_active_subscriber_count  int,
  p_pool_paise               bigint,
  p_rollover_in_paise        bigint,
  p_jackpot_pool_paise       bigint,
  p_four_pool_paise          bigint,
  p_three_pool_paise         bigint,
  p_rollover_out_paise       bigint,
  p_unclaimed_retained_paise bigint,
  p_entries_hash             text,
  p_entries                  jsonb,
  p_results                  jsonb,
  p_weight_strength_bps      smallint default 10000
)
returns draws
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw draws;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_draw from draws where id = p_draw_id for update;
  if not found then
    raise exception 'draw not found' using errcode = 'P0002';
  end if;
  if v_draw.status = 'published' then
    raise exception 'draw already published' using errcode = 'P0001';
  end if;

  delete from draw_results where draw_id = p_draw_id;
  delete from draw_entries where draw_id = p_draw_id;

  insert into draw_entries (draw_id, user_id, scores, match_count)
  select p_draw_id,
         (e ->> 'user_id')::uuid,
         array(select jsonb_array_elements_text(e -> 'scores'))::smallint[],
         (e ->> 'match_count')::smallint
  from jsonb_array_elements(p_entries) as e;

  insert into draw_results (draw_id, user_id, entry_id, match_count, prize_paise)
  select p_draw_id,
         (r ->> 'user_id')::uuid,
         de.id,
         (r ->> 'match_count')::smallint,
         (r ->> 'prize_paise')::bigint
  from jsonb_array_elements(p_results) as r
  join draw_entries de on de.draw_id = p_draw_id and de.user_id = (r ->> 'user_id')::uuid;

  update draws set
    mode                     = p_mode,
    weight_strength_bps      = p_weight_strength_bps,
    status                   = 'simulated',
    numbers                  = p_numbers,
    active_subscriber_count  = p_active_subscriber_count,
    pool_paise               = p_pool_paise,
    rollover_in_paise        = p_rollover_in_paise,
    jackpot_pool_paise       = p_jackpot_pool_paise,
    four_pool_paise          = p_four_pool_paise,
    three_pool_paise         = p_three_pool_paise,
    rollover_out_paise       = p_rollover_out_paise,
    unclaimed_retained_paise = p_unclaimed_retained_paise,
    entries_hash             = p_entries_hash,
    simulated_at             = now()
  where id = p_draw_id
  returning * into v_draw;

  return v_draw;
end;
$$;

revoke all on function save_simulation(
  uuid, draw_mode, smallint[], int, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, jsonb, jsonb, smallint
) from public;
grant execute on function save_simulation(
  uuid, draw_mode, smallint[], int, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, jsonb, jsonb, smallint
) to authenticated;

-- The public view states the strength too (appended: create-or-replace may only add columns).
create or replace view draw_statistics as
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
  coalesce(sum(r.prize_paise), 0)::bigint                           as prizes_paise,
  d.weight_strength_bps
from draws d
left join draw_results r on r.draw_id = d.id
where d.status = 'published'
group by d.id;
