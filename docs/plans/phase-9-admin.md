# Phase 9 — Admin: users and reports

**Goal:** the admin can find any member, fix their profile, scores or subscription (every edit audited), and read the platform's numbers — users, prize pool, charity totals, draw statistics — straight from the ledger, with CSV export.
**PRD:** §11.01 (user management: view/edit profiles, scores, subscriptions), §11.05 (reports: total users, total prize pool, charity totals, draw statistics), §16.1 step 10 ("restricted access after lapse").
**Done when:** an admin edits a member's scores through the same rules as the member (trigger keeps five, one per date), grants and ends a subscription and the member's access flips on the very next request, every edit leaves an `audit_log` row, report totals equal SQL sums, CSV downloads; walkthrough + tests green; committed as `Phase 9: admin`.

## 0. What already exists

| Layer                 | Already built                                                                                                                                                                                                                                                                                                                             | Phase 9 adds                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database              | `profiles_admin_all`, `scores_admin_all`, `audit_log_admin_all`; `subscriptions` read-only for everyone (only the service role writes); `reports_summary`, `charity_totals`, `draw_statistics` views; column grant on profiles (`full_name, charity_id, charity_bps` only — an admin can't change a role or email through the API either) | one migration: RPC `admin_set_subscription` (grant / end, `source = 'admin'`, writes its own audit row) — so subscription control needs no service role in app code |
| Engine                | `validateCharityBps`, `latestFive` rules                                                                                                                                                                                                                                                                                                  | `engine/reports/monthly.ts` — `summarisePaymentsByMonth` (pure aggregation)                                                                                         |
| Services              | `ScoreService` (userId is a parameter → works for an admin acting on a member)                                                                                                                                                                                                                                                            | `AdminUserService`, `ReportsService`                                                                                                                                |
| Admin shell (Phase 3) | overview tiles from `reports_summary`, nav links to Users / Reports                                                                                                                                                                                                                                                                       | the pages behind them                                                                                                                                               |

## 1. Shape of the code

```
/admin/users            AdminUserRepository.listMembers({ query, status })   profiles ⨝ live subscription ⨝ score count
/admin/users/[id]       AdminUserService.detail(id)   → profile, subscription, scores (ScoreService.list), payments, winnings summary, audit rows
   edit profile         AdminUserService.updateProfile(actor, userId, { fullName, charityId, charityBps })  → validateCharityBps → profiles update (RLS admin_all, column grant) → audit
   edit scores          AdminUserService.addScore / updateScore / removeScore(actor, userId, …)             → ScoreService (same rules, trigger keeps five) → audit
   subscription         AdminUserService.grantSubscription(actor, userId, interval) / endSubscription      → RPC admin_set_subscription → (RPC audits)
/admin/reports          ReportsService.overview()     → reports_summary + charity_totals ⨝ names + draw_statistics + summarisePaymentsByMonth(payments)
/admin/reports/export   route handler → requireAdmin → ReportsService → toCsv (pure) → text/csv attachment
```

Everything runs on the admin's own client: RLS grants admins the rows, the column grant keeps role/email out of reach, and the one thing RLS forbids everyone (writing `subscriptions`) goes through a security-definer RPC that checks `is_admin()` itself.

## 2. Files, in build order

### 2.1 `supabase/migrations/20260921001200_admin_subscriptions.sql`

`admin_set_subscription(p_user_id uuid, p_action text, p_interval plan_interval default 'month')`:

- `grant` → if a live row exists, extend `current_period_end` by one interval and set `active`; else insert `{ stripe_subscription_id: 'admin_' || user_id || '_' || epoch, status active, period now → +1 month/year, source 'admin' }`.
- `end` → live row → `status = 'lapsed'`, `current_period_end = now()`, `canceled_at = now()` (the §04 gate closes on the next request).
- Inserts an `audit_log` row (`actor_id = auth.uid()`, `action = 'subscription.' || p_action`, `target_table = 'subscriptions'`, diff).
- `is_admin()` check first; `42501` otherwise. Grant execute to authenticated.

### 2.2 Engine

- `engine/reports/monthly.ts` — `summarisePaymentsByMonth(payments: { paidAt, amountPaise, poolPaise, charityPaise, platformPaise }[])` → `{ month: "2026-09", payments, amountPaise, poolPaise, charityPaise, platformPaise }[]`, newest first, IST months.
- `lib/csv.ts` — `toCsv(headers, rows)` (RFC 4180 quoting), pure.

### 2.3 Repositories

- `AdminUserRepository`: `listMembers(filter) → MemberRow[]` (`id, fullName, email, charityName, charityBps, subscription: { status, interval, currentPeriodEnd, source } | null, scoreCount, createdAt`), `findMember(id) → MemberDetail | null` (profile + subscription + payments + audit rows), `writeAudit(entry)`, `setSubscription(userId, action, interval)` (RPC; `42501` → Forbidden).
- `ReportsRepository`: `summary()` (reports_summary), `charityTotals()` (view ⨝ name/slug), `drawStatistics()` (reuse `DrawRepository.listSummaries`), `payments()` (`paid_at, amount_paise, pool_paise, charity_paise, platform_paise`).

### 2.4 Services

- `AdminUserService(users, scores: ScoreService, profiles: ProfileRepository)`: `list`, `detail`, `updateProfile` (validate bps; charity must exist — via `ProfileRepository.updateCharityChoice` + name update), `addScore/updateScore/removeScore` (delegate to `ScoreService`, then audit with `{ before, after }`), `grantSubscription/endSubscription`.
- `ReportsService`: `overview()` assembling the four blocks; `csv(kind)` for `charities | draws | payments | members`.

### 2.5 Pages

- `/admin/users`: search (`?q=` name/email), status chips (All · Active · Lapsed/ended · Never subscribed), table (member, charity · %, subscription with an `admin` chip when granted here, scores n/5, joined); empty "No users match".
- `/admin/users/[id]`: header (name, email, joined, role badge); **Profile** form (name, charity select, `SplitSlider`); **Subscription** card (status, period, source; Grant monthly / Grant yearly / End now — with the one-line consequence: "The member's access changes on their next request"); **Scores** — `ScoreRow` + an admin editor (add / inline edit / delete, same fields as the member's, calls admin actions carrying `userId`); **Payments** (last 6: date, amount, split); **Winnings** summary (from `WinnerService.listWinnings` + `summariseWinnings`); **Audit** list (when, action, diff).
- `/admin/reports`: figures (members, active subscribers, pool this month, charity total, prizes awarded / paid, rollover carried); **By month** table (payments, amount, pool, charity, platform); **Charity totals** with proportional bars (pure width %); **Draw statistics** (month, mode, numbers, winners 5/4/3, prizes, rollover); CSV buttons (`/admin/reports/export?report=…`). Empty states when no draw yet.
- Admin overview: "This month's draw" and "Proofs to review" link through; recent audit rows.

## 3. Tests

- **Unit**: `summarisePaymentsByMonth` (grouping by IST month, sums, order); `toCsv` (quotes, commas, newlines, numbers); `AdminUserService` with fakes (bps rule, audit row per edit with before/after, score edits go through `ScoreService` rules — sixth evicts, duplicate date refused); `ReportsService.overview` assembly + csv kinds.
- **Integration** `tests/integration/admin.test.ts`: member cannot list profiles or call the RPC (`42501`); admin lists members with score counts; admin edits a member's scores (trigger keeps five, `23505` on duplicate date) and `audit_log` has the rows; `admin_set_subscription('grant')` → `has_active_access(uid)` true, member's own `subscriptions` select shows `source = 'admin'`; `'end'` → false immediately; `reports_summary.charity_total_paise` = `sum(charity_contributions)`, `pool_this_month_paise` = `sum(payments.pool_paise)` this month.
- **Walkthrough** `scripts/walkthrough-phase9.ts`: seed members → `/admin/users` search → detail → rename + change charity → add / edit / delete a score → grant monthly → the member's dashboard is Active → end → the member's next request is locked → `/admin/reports` → CSV download → 390px.

## 4. Order of work

1. migration → types → engine + csv + tests → repositories → services + tests
2. integration test → users pages + actions → reports page + export route → overview links
3. walkthrough → docs (`GAME.md`, `PLAN.md`) → commit `Phase 9: admin`

## 5. Explicitly not in this phase

Changing a member's role or email (deliberately impossible through the API; roles are set at seed time). Refunds or Stripe-side changes for real subscriptions (an admin "end" lapses the mirror; a real Stripe subscription would also need cancelling in Stripe — the page says so when `source = 'stripe'`). Charts beyond proportional bars.

## 6. Decisions made here

- **[decision] Admin-granted subscriptions are marked `source = 'admin'`** and never touch Stripe. They exist for support cases and demos; the UI shows the chip so nobody mistakes one for a payment.
- **[decision] Every admin edit of member data is audited** (who, what, before/after) — profile, scores, subscription. The audit list is on the member's admin page.
- **[decision] Admins edit scores under the same rules as members** — five kept by date, one per date, 1–45 — through the same service; the database trigger and constraints apply regardless.
- **[decision] Ending a subscription takes effect on the member's next request**, because the gate reads the database every time (PRD §04 "real-time"); nothing is cached per session.

## 7. Outcome (2026-09-22)

Done. 346 unit / 87 integration tests, build clean, walkthrough green. No deviations from the plan.
