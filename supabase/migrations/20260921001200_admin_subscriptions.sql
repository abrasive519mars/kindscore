-- Phase 9: admin subscription control (PRD §11.01 "manage subscriptions").
-- subscriptions is read-only for every client; this is the one admin write, done here so no
-- service-role key is needed in app code. Rows it creates are marked source = 'admin' and never
-- touch Stripe. Every call writes its own audit row.
create or replace function admin_set_subscription(
  p_user_id  uuid,
  p_action   text,
  p_interval plan_interval default 'month'
)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  subscriptions;
  v_step interval := case when p_interval = 'year' then interval '1 year' else interval '1 month' end;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_action not in ('grant', 'end') then
    raise exception 'unknown action %', p_action using errcode = 'P0001';
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  select * into v_row from subscriptions
  where user_id = p_user_id and status in ('active', 'past_due')
  for update;

  if p_action = 'grant' then
    if found then
      update subscriptions
      set status = 'active',
          plan_interval = p_interval,
          current_period_end = greatest(current_period_end, now()) + v_step,
          cancel_at_period_end = false,
          canceled_at = null
      where id = v_row.id
      returning * into v_row;
    else
      insert into subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan_interval, status,
                                 current_period_start, current_period_end, source)
      values (p_user_id, 'admin_' || p_user_id || '_' || extract(epoch from now())::bigint, 'price_admin',
              p_interval, 'active', now(), now() + v_step, 'admin')
      returning * into v_row;
    end if;
  else
    if not found then
      raise exception 'no live subscription to end' using errcode = 'P0001';
    end if;
    update subscriptions
    set status = 'lapsed', current_period_end = now(), canceled_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, diff)
  values (auth.uid(), 'subscription.' || p_action, 'subscriptions', v_row.id,
          jsonb_build_object('user_id', p_user_id, 'interval', p_interval, 'status', v_row.status,
                             'current_period_end', v_row.current_period_end, 'source', v_row.source));
  return v_row;
end;
$$;

revoke all on function admin_set_subscription(uuid, text, plan_interval) from public;
grant execute on function admin_set_subscription(uuid, text, plan_interval) to authenticated;
