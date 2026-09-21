-- Kindscore · migration 6 of 8 · remote procedures
-- Supabase JS has no client-side transactions, so every multi-row write that must be atomic lives here.
-- The engine (src/engine) computes every number; these functions only persist and guard. Nothing is
-- recalculated in SQL. All are security definer with an explicit role check on the first line.

-- ── Draw: simulate ────────────────────────────────────────────────────────────
-- Saves a full simulation as a draft the admin can inspect. Re-running replaces the previous draft.
-- p_entries: [{ "user_id", "scores": [..5..], "match_count" }]
-- p_results: [{ "user_id", "match_count", "prize_paise" }]
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
  p_results                  jsonb
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

-- ── Draw: publish ─────────────────────────────────────────────────────────────
-- Flips a simulated draft to published and opens a verification for every winner.
-- Idempotent: publishing an already-published draw returns it unchanged. A bare draft is refused.
create or replace function publish_draw(p_draw_id uuid)
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

  update draws
  set status = 'published', published_at = now(), published_by = auth.uid()
  where id = p_draw_id and status = 'simulated'
  returning * into v_draw;

  if not found then
    select * into v_draw from draws where id = p_draw_id;
    if not found then
      raise exception 'draw not found' using errcode = 'P0002';
    end if;
    if v_draw.status = 'draft' then
      raise exception 'simulate before publishing' using errcode = 'P0001';
    end if;
    return v_draw;  -- already published
  end if;

  insert into winner_verifications (result_id, user_id)
  select id, user_id from draw_results where draw_id = p_draw_id
  on conflict (result_id) do nothing;

  return v_draw;
end;
$$;

-- ── Winner verification: the four events of engine/verification/stateMachine.ts ──
-- Each locks the row, checks the same guard the engine checks, and applies one transition.

-- Member event. awaiting_proof → submitted, or rejected → submitted once.
create or replace function submit_winner_proof(p_verification_id uuid, p_proof_path text)
returns winner_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row winner_verifications;
begin
  select * into v_row from winner_verifications where id = p_verification_id for update;
  if not found or v_row.user_id <> auth.uid() then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;

  if v_row.review_status = 'awaiting_proof' then
    update winner_verifications set proof_path = p_proof_path, review_status = 'submitted'
    where id = p_verification_id returning * into v_row;
  elsif v_row.review_status = 'rejected' and v_row.resubmissions < 1 then
    update winner_verifications
    set proof_path = p_proof_path, review_status = 'submitted', resubmissions = resubmissions + 1
    where id = p_verification_id returning * into v_row;
  else
    raise exception 'cannot submit proof while review is %', v_row.review_status using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- Admin event. submitted → approved | rejected.
create or replace function review_winner(p_verification_id uuid, p_approve boolean, p_note text default null)
returns winner_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row winner_verifications;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_row from winner_verifications where id = p_verification_id for update;
  if not found then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;
  if v_row.review_status <> 'submitted' then
    raise exception 'cannot review while review is %', v_row.review_status using errcode = 'P0001';
  end if;

  update winner_verifications
  set review_status = case when p_approve then 'approved' else 'rejected' end::review_status,
      reviewed_by   = auth.uid(),
      reviewed_at   = now(),
      review_note   = p_note
  where id = p_verification_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Admin event. approved · pending → approved · paid.
create or replace function mark_winner_paid(p_verification_id uuid)
returns winner_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row winner_verifications;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_row from winner_verifications where id = p_verification_id for update;
  if not found then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;
  if v_row.review_status <> 'approved' or v_row.payout_status <> 'pending' then
    raise exception 'cannot mark paid while review is % and payout is %', v_row.review_status, v_row.payout_status
      using errcode = 'P0001';
  end if;

  update winner_verifications set payout_status = 'paid', paid_at = now()
  where id = p_verification_id returning * into v_row;

  return v_row;
end;
$$;

-- Clients may call these; the functions enforce who may do what.
revoke all on function save_simulation(uuid, draw_mode, smallint[], int, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, jsonb, jsonb) from public;
revoke all on function publish_draw(uuid) from public;
grant execute on function save_simulation(uuid, draw_mode, smallint[], int, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, jsonb, jsonb) to authenticated;
grant execute on function publish_draw(uuid) to authenticated;
grant execute on function submit_winner_proof(uuid, text) to authenticated;
grant execute on function review_winner(uuid, boolean, text) to authenticated;
grant execute on function mark_winner_paid(uuid) to authenticated;
grant execute on function next_rollover_in() to authenticated;
