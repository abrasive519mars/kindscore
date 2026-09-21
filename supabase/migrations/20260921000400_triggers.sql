-- Kindscore · migration 4 of 8 · triggers
-- Wires the functions from migration 3 to their tables.

-- auth.users → profiles
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Rolling five: fires after the row is in, then trims the member's history to the latest five by date.
create trigger scores_enforce_window
  after insert or update on scores
  for each row execute function enforce_score_window();

-- Ledger
create trigger payments_to_ledger
  after insert on payments
  for each row execute function record_payment_contribution();

create trigger donations_to_ledger
  after update of paid on donations
  for each row execute function record_donation_contribution();

-- updated_at bookkeeping on every mutable table
create trigger profiles_set_updated_at             before update on profiles             for each row execute function set_updated_at();
create trigger charities_set_updated_at            before update on charities            for each row execute function set_updated_at();
create trigger charity_events_set_updated_at       before update on charity_events       for each row execute function set_updated_at();
create trigger subscriptions_set_updated_at        before update on subscriptions        for each row execute function set_updated_at();
create trigger scores_set_updated_at               before update on scores               for each row execute function set_updated_at();
create trigger draws_set_updated_at                before update on draws                for each row execute function set_updated_at();
create trigger winner_verifications_set_updated_at before update on winner_verifications for each row execute function set_updated_at();
