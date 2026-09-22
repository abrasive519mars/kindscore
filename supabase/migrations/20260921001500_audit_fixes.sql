-- Phase 14: what a line-by-line PRD audit found the database should also guarantee.

-- 1. §04 restricted access applies to every score write, not only inserts: a lapsed member may
--    read their rounds but may not change them until they renew.
drop policy if exists scores_update_own on scores;
drop policy if exists scores_delete_own on scores;
create policy scores_update_own on scores for update to authenticated
  using (user_id = auth.uid() and has_active_access(auth.uid()))
  with check (user_id = auth.uid() and has_active_access(auth.uid()));
create policy scores_delete_own on scores for delete to authenticated
  using (user_id = auth.uid() and has_active_access(auth.uid()));

-- 2. §07 tier arithmetic is a database invariant, not only an engine one: the three tier pools
--    always account for exactly the pool plus what rolled in, and only the jackpot rolls out.
alter table draws
  add constraint draws_tiers_sum
    check (jackpot_pool_paise + four_pool_paise + three_pool_paise = pool_paise + rollover_in_paise),
  add constraint draws_rollover_is_jackpot
    check (rollover_out_paise = 0 or rollover_out_paise = jackpot_pool_paise);

-- 3. §11.04 escape hatch: an admin can record a payout settled outside Stripe (the winner's
--    self-claim stays the default). Admin only, audited, same state rule as the claim.
alter table winner_verifications drop constraint if exists winner_verifications_payout_method_check;
alter table winner_verifications
  add constraint winner_verifications_payout_method_check
    check (payout_method in ('stripe_credit', 'manual', 'seed'));

create or replace function record_payout(p_verification_id uuid, p_reference text)
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
  if p_reference is null or length(trim(p_reference)) = 0 then
    raise exception 'a payout reference is required' using errcode = 'P0001';
  end if;

  select * into v_row from winner_verifications where id = p_verification_id for update;
  if not found then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;
  if v_row.review_status <> 'approved' or v_row.payout_status <> 'pending' then
    raise exception 'cannot record a payout while review is % and payout is %', v_row.review_status, v_row.payout_status
      using errcode = 'P0001';
  end if;

  update winner_verifications
  set payout_status = 'paid', paid_at = now(), payout_method = 'manual', payout_reference = trim(p_reference)
  where id = p_verification_id
  returning * into v_row;

  insert into audit_log (actor_id, action, target_table, target_id, diff)
  values (auth.uid(), 'payout.recorded', 'winner_verifications', v_row.id,
          jsonb_build_object('user_id', v_row.user_id, 'reference', v_row.payout_reference));

  return v_row;
end;
$$;

revoke all on function record_payout(uuid, text) from public;
grant execute on function record_payout(uuid, text) to authenticated;

-- 4. §11.05 "total prize pool": the lifetime figure beside this month's (appended column).
create or replace view reports_summary
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
  next_rollover_in()                                                                       as current_rollover_paise,
  (select coalesce(sum(pool_paise), 0)::bigint from payments)                             as pool_total_paise;
