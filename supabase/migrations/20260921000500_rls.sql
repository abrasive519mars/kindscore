-- Kindscore · migration 5 of 8 · row-level security
-- Deny by default: every table has RLS on, and only the policies below grant anything.
-- The service role (webhook, seed) bypasses RLS entirely; `authenticated` and `anon` are what clients get.
-- `(select is_admin())` is wrapped in a subselect so Postgres evaluates it once per statement, not per row.

-- ── Enable everywhere ─────────────────────────────────────────────────────────
alter table profiles              enable row level security;
alter table charities             enable row level security;
alter table charity_media         enable row level security;
alter table charity_events        enable row level security;
alter table subscriptions         enable row level security;
alter table payments              enable row level security;
alter table donations             enable row level security;
alter table charity_contributions enable row level security;
alter table scores                enable row level security;
alter table draws                 enable row level security;
alter table draw_entries          enable row level security;
alter table draw_results          enable row level security;
alter table winner_verifications  enable row level security;
alter table stripe_events         enable row level security;
alter table audit_log             enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────────
create policy profiles_select_own   on profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own   on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all    on profiles for all    to authenticated using ((select is_admin())) with check ((select is_admin()));
-- Column privileges are additive to table privileges, so a column-level revoke alone does nothing while
-- the default table-level grant stands. Remove the table grant, then grant back only the editable columns:
-- a member may change their name and charity choice, never their role, email or Stripe identity —
-- even if a row policy is later loosened. (Admins change roles via the service role / seed only.)
revoke update on profiles from authenticated;
grant update (full_name, charity_id, charity_bps, updated_at) on profiles to authenticated;

-- ── charities (public directory, §08.2) ───────────────────────────────────────
create policy charities_public_read       on charities      for select to anon, authenticated using (is_active);
create policy charities_admin_all         on charities      for all    to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy charity_media_public_read   on charity_media  for select to anon, authenticated
  using (exists (select 1 from charities c where c.id = charity_id and c.is_active));
create policy charity_media_admin_all     on charity_media  for all    to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy charity_events_public_read  on charity_events for select to anon, authenticated
  using (exists (select 1 from charities c where c.id = charity_id and c.is_active));
create policy charity_events_admin_all    on charity_events for all    to authenticated using ((select is_admin())) with check ((select is_admin()));

-- ── subscriptions / payments / stripe_events: read-only mirrors of Stripe ─────
-- No insert/update policy for anyone: only the service role (webhook) writes these.
create policy subscriptions_select_own on subscriptions for select to authenticated using (user_id = auth.uid());
create policy subscriptions_admin_read on subscriptions for select to authenticated using ((select is_admin()));
create policy payments_select_own      on payments      for select to authenticated using (user_id = auth.uid());
create policy payments_admin_read      on payments      for select to authenticated using ((select is_admin()));
create policy stripe_events_admin_read on stripe_events for select to authenticated using ((select is_admin()));

-- ── donations ─────────────────────────────────────────────────────────────────
-- A member can open a donation (unpaid); only the webhook flips it to paid.
create policy donations_select_own on donations for select to authenticated using (user_id = auth.uid());
create policy donations_insert_own on donations for insert to authenticated with check (user_id = auth.uid() and paid = false);
create policy donations_admin_read on donations for select to authenticated using ((select is_admin()));

-- ── charity_contributions: written by triggers only ───────────────────────────
create policy contributions_select_own on charity_contributions for select to authenticated using (user_id = auth.uid());
create policy contributions_admin_read on charity_contributions for select to authenticated using ((select is_admin()));

-- ── scores (§05) ──────────────────────────────────────────────────────────────
-- Own rows only; adding a round requires an active subscription (§04 restricted access).
create policy scores_select_own on scores for select to authenticated using (user_id = auth.uid());
create policy scores_insert_own on scores for insert to authenticated with check (user_id = auth.uid() and has_active_access(auth.uid()));
create policy scores_update_own on scores for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy scores_delete_own on scores for delete to authenticated using (user_id = auth.uid());
create policy scores_admin_all  on scores for all    to authenticated using ((select is_admin())) with check ((select is_admin()));

-- ── draws (§06) ───────────────────────────────────────────────────────────────
-- Members (and the public landing page) see published draws only; drafts are admin-only.
create policy draws_published_read on draws for select to anon, authenticated using (status = 'published');
create policy draws_admin_all      on draws for all    to authenticated using ((select is_admin())) with check ((select is_admin()));

create policy draw_entries_select_own on draw_entries for select to authenticated
  using (user_id = auth.uid() and exists (select 1 from draws d where d.id = draw_id and d.status = 'published'));
create policy draw_entries_admin_all  on draw_entries for all to authenticated using ((select is_admin())) with check ((select is_admin()));

create policy draw_results_select_own on draw_results for select to authenticated
  using (user_id = auth.uid() and exists (select 1 from draws d where d.id = draw_id and d.status = 'published'));
create policy draw_results_admin_all  on draw_results for all to authenticated using ((select is_admin())) with check ((select is_admin()));

-- ── winner_verifications (§09) ────────────────────────────────────────────────
-- Read-only for clients. Every state change (submit proof, approve, reject, mark paid) goes through
-- an RPC in migration 6 that enforces the same transitions as engine/verification/stateMachine.ts.
create policy verifications_select_own  on winner_verifications for select to authenticated using (user_id = auth.uid());
create policy verifications_admin_read  on winner_verifications for select to authenticated using ((select is_admin()));

-- ── audit_log ─────────────────────────────────────────────────────────────────
create policy audit_log_admin_all on audit_log for all to authenticated using ((select is_admin())) with check ((select is_admin()));
