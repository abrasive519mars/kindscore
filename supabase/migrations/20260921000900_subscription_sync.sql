-- Phase 5: out-of-order webhook guard.
-- Stripe does not guarantee delivery order. Every sync records the `created` time of the event it
-- came from; an update whose event is older than what is stored is ignored (QA.md §2).
alter table subscriptions add column last_event_at timestamptz;
