-- Kindscore · migration 1 of 8 · enumerated types
-- One vocabulary shared with src/engine: every string union there is an enum here.

create type app_role as enum ('member', 'admin');

create type plan_interval as enum ('month', 'year');

create type subscription_status as enum ('active', 'past_due', 'cancelled', 'lapsed');

create type draw_mode as enum ('random', 'algorithmic');

-- draft: created, nothing drawn · simulated: numbers + winners saved, invisible to members · published: final
create type draw_status as enum ('draft', 'simulated', 'published');

create type review_status as enum ('awaiting_proof', 'submitted', 'approved', 'rejected');

create type payout_status as enum ('pending', 'paid');

create type contribution_source as enum ('subscription', 'donation');
