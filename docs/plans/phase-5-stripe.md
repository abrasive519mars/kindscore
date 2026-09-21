# Phase 5 — Stripe + subscription

**Goal:** a member can pay (monthly ₹499 or yearly ₹4,999, INR, Stripe test mode), and from that moment every request sees the truth of their subscription without ever calling Stripe on read. Renewal, cancellation and lapse each have a defined state, a banner and a way back.
**PRD:** §04 (gating, renewal, cancellation, lapsed), §07 (pool funded by a fixed portion), §08 (charity share on every payment), §15.3 (Stripe, monthly + yearly discounted), §16.1 steps 2–3 and 10.
**Done when:** a real test-card checkout activates the account; `pnpm test:int` proves the webhook end-to-end against local Postgres with signed fixture events (activate, pay, fail, cancel, replay, bad signature, unknown customer); the walkthrough script drives Checkout in a browser and ends with an Active dashboard; build/lint/tests green; committed as `Phase 5: stripe`.

## 0. Who does what

| Actor                               | Responsibility                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe**                          | Card entry (PCI), the subscription object, invoices, retries, the customer portal. We never see a card number.                      |
| **Webhook** (`/api/stripe/webhook`) | The only writer of `subscriptions`, `payments`, `profiles.stripe_customer_id`. Service role.                                        |
| **Success-page sync**               | Same writer, invoked once when the member lands back before the webhook does (local dev without the Stripe CLI, or a slow webhook). |
| **`getAccess()`** (Phase 3)         | Reads the mirror. One indexed query per request. Unchanged.                                                                         |
| **Engine** (Phase 1)                | `mapStripeStatus`, `hasActiveAccess`, `splitPayment` — already written and tested; this phase only calls them.                      |

Money flow per successful invoice (`invoice.paid`, amount 49,900 paise, charity 10%): `splitPayment` → charity 4,990 · pool 14,970 · platform 29,940 → one `payments` row → the Phase 2 trigger writes the `charity_contributions` ledger row. The charity and percentage are **snapshotted at payment time**, so changing charity later never rewrites history.

## 1. Shape of the code — two abstractions, both new

**Repositories** (Phase 4 pattern, continued): `SubscriptionRepository`, `PaymentRepository`, `StripeEventRepository`, `ProfileRepository`. The Supabase implementations are constructed with whichever client the caller has — the webhook passes the service-role client, pages pass the user client — and the services never know which.

**Gateway** (new): `BillingGateway` is the interface for everything we _ask Stripe to do_ (create checkout session, portal session, flip cancel-at-period-end, retrieve a checkout session). `StripeBillingGateway` is the only file that calls the Stripe SDK for those. `CheckoutService` and the subscription actions depend on the interface, so they are unit-tested with a fake gateway, exactly as `ScoreService` is tested with a fake repository.

**Snapshots** (new, pure): the webhook never hands raw Stripe objects to a service. `src/lib/stripe/snapshots.ts` maps a `Stripe.Subscription` to `SubscriptionSnapshot` and a `Stripe.Invoice` to `InvoiceSnapshot` — plain objects with our field names, in paise and ISO strings. This is where the Stripe API version lives (in the 2026 API, period dates are on the subscription _item_, and an invoice's subscription id is under `parent.subscription_details`). Unit-tested against fixture JSON.

```
Stripe ──POST──▶ route.ts ──verify sig──▶ claim event id ──▶ handleStripeEvent
                                                              │  (lib/stripe/handleEvent.ts: picks the object out of the event,
                                                              │   retrieves the subscription only for checkout.session.completed,
                                                              │   converts to snapshots)
                                                              ▼
                                                    SubscriptionSyncService   (no Stripe import)
                                                      applySubscription(snapshot) → mapStripeStatus → SubscriptionRepository.upsert
                                                      applyInvoice(snapshot)      → splitPayment    → PaymentRepository.recordIfNew
```

## 2. Files, in build order

### 2.1 `supabase/migrations/20260921000900_subscription_sync.sql`

`alter table subscriptions add column last_event_at timestamptz;` — the out-of-order guard from QA §2: an update is applied only if its `event.created` is not older than what we already stored. `pnpm db:reset`, `pnpm db:types`, `pnpm db:push`.

### 2.2 `src/config/constants.ts`

`PLANS[interval].lookupKey` (`kindscore_monthly`, `kindscore_yearly`) — Stripe prices are found by lookup key so the setup script is idempotent. `BILLING.SUCCESS_PATH`, `CANCEL_PATH`, `RETURN_PATH` — the three URLs Stripe sends people back to.

### 2.3 `src/lib/stripe/client.ts`

`getStripe()` — lazy singleton over `serverEnv().STRIPE_SECRET_KEY`, `import "server-only"`. The SDK's own pinned API version (`2026-08-26.dahlia`) — not overridden, so the typings and the wire format agree.

### 2.4 `src/lib/stripe/snapshots.ts` (pure)

```ts
interface SubscriptionSnapshot { stripeSubscriptionId; stripeCustomerId; stripePriceId; userId: string | null /* from metadata */;
  stripeStatus; interval: "month" | "year"; currentPeriodStart; currentPeriodEnd; cancelAtPeriodEnd; canceledAt; eventCreatedAt }
interface InvoiceSnapshot { stripeInvoiceId; stripeCustomerId; stripeSubscriptionId; amountPaise; paidAt }
toSubscriptionSnapshot(sub, eventCreated) · toInvoiceSnapshot(invoice) → null when not a paid subscription invoice
```

### 2.5 Repository interfaces + Supabase implementations

- `SubscriptionRepository`: `upsertFromSnapshot(s, status) → "applied" | "stale"`, `findByStripeId(id)`, `findLiveForUser(userId)`.
- `PaymentRepository`: `recordIfNew(write) → boolean` (unique `stripe_invoice_id`; `23505` → false).
- `StripeEventRepository`: `claim(id, type) → boolean` (insert-first; duplicate → false), `markProcessed(id)`.
- `ProfileRepository`: `findById(id)`, `findByStripeCustomerId(id)`, `setStripeCustomerId(userId, customerId)`.

### 2.6 `src/services/SubscriptionSyncService.ts`

- `applySubscription(snapshot)` → resolve the member: `snapshot.userId` (metadata we set at checkout) else profile by customer id; unknown → `{ applied: false, reason: "unknown_customer" }` (webhook still answers 200 — Stripe must not retry forever). Otherwise store `stripe_customer_id` if missing, `mapStripeStatus`, upsert.
- `applyInvoice(snapshot)` → member by customer id → `splitPayment(amount, profile.charity_bps)` → `recordIfNew` with charity snapshot. Returns whether a row was written.

### 2.7 `src/lib/stripe/handleEvent.ts`

`handleStripeEvent(event, stripe, service)`: `checkout.session.completed` → retrieve subscription → `applySubscription`; `customer.subscription.created|updated|deleted` → object from the event; `invoice.paid` → `applySubscription` (the object carries the new period) then `applyInvoice`; `invoice.payment_failed` → `applySubscription` (Stripe has already set `past_due`); anything else → ignored. **Decision vs ARCHITECTURE.md §3:** the event payload's own object is used (it is the full object at the moment of the event, and `last_event_at` handles ordering); a retrieve is made only where the payload has just an id. This keeps the integration test offline.

### 2.8 `src/app/api/stripe/webhook/route.ts`

`runtime = "nodejs"`; `await req.text()`; `constructEvent` (bad signature → 400 via `toResponse`); `claim` (duplicate → 200 `{ duplicate: true }`); handle; `markProcessed`; 200. Any handler error → 500 so Stripe retries.

### 2.9 `src/lib/stripe/BillingGateway.ts` + `StripeBillingGateway.ts`

Interface: `createCheckoutSession({ userId, email, customerId, priceId, interval })`, `retrieveCheckoutSession(id) → { userId, subscriptionId } | null`, `createPortalSession(customerId)`, `setCancelAtPeriodEnd(subscriptionId, cancel)`. Stripe impl: `mode: "subscription"`, `client_reference_id`, `metadata.user_id`, `subscription_data.metadata.user_id`, `billing_address_collection: "required"`, `customer` when known else `customer_email`, `success_url …?session_id={CHECKOUT_SESSION_ID}`, `cancel_url …?canceled=1`.

### 2.10 `src/services/CheckoutService.ts`

`startCheckout(access, interval)` → price id from env, customer id from profile, gateway → URL. `syncAfterCheckout(userId, sessionId)` → gateway retrieve; refuse if the session's `client_reference_id` isn't this user; retrieve subscription → `SubscriptionSyncService.applySubscription`. `cancelAtPeriodEnd(access)` / `resume(access)` → live subscription id → gateway → the webhook `subscription.updated` writes the mirror (the action also applies the returned object directly so the UI is right on the very next render).

### 2.11 `src/app/(member)/app/subscription/actions.ts` + `page.tsx`

Actions: `startCheckout` (redirects to Stripe), `cancelSubscription`, `resumeSubscription`, `openBillingPortal` — every one `requireUser()` first, `runAction`. Page states: **none/cancelled/lapsed** → plan cards with live buttons ("Renew" copy when returning); **active** → paid-through, renew/ends date, Cancel or Resume, "Update payment method" (portal); **past_due** → danger panel + portal CTA; `?session_id=` → run the sync then render "Payment received — you're in the next draw"; `?canceled=1` → "No charge was made." The dashboard's subscription figure and `SubscriptionBanner` already read the same state.

### 2.12 `src/app/api/cron/keepalive/route.ts` + `vercel.json`

Bearer `CRON_SECRET`; one cheap query; `0 3 * * *`. Keeps the free Supabase project from pausing (QA §7 risk 2).

### 2.13 `scripts/stripe-setup.ts` (+ `pnpm stripe:setup`)

Idempotent: find-or-create the two products/prices by lookup key, print the `price_…` ids for `.env.local`; with `--webhook https://<app>` also creates the endpoint for the five event types and prints `whsec_…`. The user only has to supply the two API keys.

## 3. Tests

- **Unit** `tests/unit/lib/stripe/snapshots.test.ts` — fixtures `tests/fixtures/stripe/{subscription.active,subscription.cancel-at-period-end,invoice.paid,invoice.non-subscription}.json`; period dates from the item; interval from the price; `null` for a non-subscription invoice.
- **Unit** `tests/unit/services/SubscriptionSyncService.test.ts` (fake repos): active→active, `past_due`, `canceled`→cancelled, `unpaid`→lapsed; unknown customer → not applied; metadata user wins over customer lookup; customer id stored once; invoice → payment with exact split (49,900 / 1000 bps → 4,990 · 14,970 · 29,940) and charity snapshot; duplicate invoice → false; stale event → "stale".
- **Unit** `tests/unit/services/CheckoutService.test.ts` (fake gateway): monthly/yearly price selection; existing customer reused; foreign session refused; cancel/resume use the live subscription only.
- **Integration** `tests/integration/webhook.test.ts` — calls the route's `POST` with bodies signed by `stripe.webhooks.generateTestHeaderString`: `customer.subscription.created` → row active, period ≈ +1 mo; `invoice.paid` → one `payments` row + one ledger row; **replay → 200, still one row**; bad signature → 400, nothing written; `invoice.payment_failed` → `past_due` and `has_active_access()` false; `customer.subscription.deleted` → cancelled/lapsed by `cancel_at_period_end`; older `event.created` → ignored.
- **Walkthrough** `scripts/walkthrough-phase5.ts` — Playwright: signup → Choose monthly → Stripe Checkout (4242, Indian address) → back with `session_id` → "Payment received" → dashboard Active with renewal date → Cancel → banner "won't renew" → Resume → 390px. Screenshots in `docs/screenshots/phase-5/`.

## 4. Order of work

1. migration → types → constants → stripe client → snapshots (+ fixtures, tests)
2. repositories → SubscriptionSyncService (+ tests) → handleEvent → webhook route → integration test
3. gateway → CheckoutService (+ tests) → actions → page → cron → setup script
4. **needs the user:** Stripe test keys → `pnpm stripe:setup` → `.env.local` → walkthrough → docs → commit

## 5. Explicitly not in this phase

One-off donations (Phase 8 — same gateway, `mode: "payment"`). Admin subscription controls (Phase 9). Seeded subscriptions for demo personas (Phase 11 — `source = 'seed'`, never touch Stripe). Vercel deployment of the webhook (Phase 11; the setup script's `--webhook` flag is ready for it).

## 6. Decisions made here

- **[decision] Cancelling keeps access until the paid period ends** (`cancel_at_period_end`), then the row becomes `cancelled`. The member can resume any time before that. Nothing is refunded mid-period — the PRD says only "cancellation", and this is the standard reading.
- **[decision] `past_due` restricts immediately.** The PRD asks for a _real-time_ check; a failed renewal is exactly the moment it should bite. The banner links straight to the card-update portal, and Stripe's retries (Smart Retries, default) reinstate the member on success with no action from us.
- **[decision] Charity share is snapshotted per payment.** Changing charity or percentage applies to the _next_ invoice; past contributions stay with the charity that received them.
- **[decision] Unknown customers get a 200.** A webhook for a customer we can't map (e.g. created in the Stripe dashboard) is logged and acknowledged, not retried for three days.
- **[decision] No trials, no coupons, no proration.** One fee, one entry, everyone equal — the same principle the subscription page already states.

## 7. Outcome (2026-09-21)

Done. 244 unit / 58 integration tests, build clean, walkthrough green against real Stripe test mode.
Changes from the plan while building: (1) `retrieveCompletedCheckout` also returns the session's first invoice and the sync records it — without this a dev box (no webhook) had a subscription but no payment row; (2) `invoice.paid` / `invoice.payment_failed` retrieve the subscription (the invoice payload doesn't carry it), so the route's dependencies are injected (`lib/stripe/webhook.ts`) and the integration test stubs that one call; (3) Stripe India is invite-only, so the sandbox is a US-registered test account — INR works unchanged.
