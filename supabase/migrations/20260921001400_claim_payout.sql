-- Phase 13: the winner claims their own payout. It is paid as subscription credit through Stripe
-- and recorded here with the provider's reference, so "paid" is something software can prove.
-- The admin's manual mark_winner_paid goes away: their role ends at approval (PRD §09).

alter table winner_verifications
  add column payout_method    text check (payout_method in ('stripe_credit', 'seed')),
  add column payout_reference text;

-- Rows paid before this migration were marked by an admin; record them as such before the rule lands.
update winner_verifications
set payout_method = 'seed', payout_reference = 'marked paid by admin before self-claim'
where payout_status = 'paid' and payout_method is null;

alter table winner_verifications
  add constraint paid_rows_carry_a_reference
    check (payout_status = 'pending' or (payout_method is not null and payout_reference is not null));

drop function if exists mark_winner_paid(uuid);

-- Member event: approved · pending → approved · paid. Only the row's owner may call it.
create or replace function claim_payout(p_verification_id uuid, p_method text, p_reference text)
returns winner_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row winner_verifications;
begin
  select * into v_row from winner_verifications where id = p_verification_id for update;
  if not found then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;
  if v_row.user_id <> auth.uid() then
    raise exception 'not your win' using errcode = '42501';
  end if;
  if v_row.review_status <> 'approved' or v_row.payout_status <> 'pending' then
    raise exception 'cannot claim while review is % and payout is %', v_row.review_status, v_row.payout_status
      using errcode = 'P0001';
  end if;

  update winner_verifications
  set payout_status    = 'paid',
      paid_at          = now(),
      payout_method    = p_method,
      payout_reference = p_reference
  where id = p_verification_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function claim_payout(uuid, text, text) from public;
grant execute on function claim_payout(uuid, text, text) to authenticated;
