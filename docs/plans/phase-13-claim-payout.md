# Phase 13 — Winners claim their payout (Stripe customer credit)

## Context

PRD §09 ends at "payout status Pending → Paid" and leaves the payment itself to the admin. The owner wants the last step to be the **winner's**, automatic and verifiable — no human marking anything paid. We checked every Stripe rail from this sandbox (2026-09-22): Connect cross-border payouts exclude India for a US platform; Global Payouts needs Treasury activation; refunds cap at the original charge. The one payout Stripe can make to an Indian member from the customer we already hold is a **customer-balance credit**: the prize is credited to the winner's Stripe customer and applied automatically to their next renewals. Stripe returns a transaction id, so the payment is verified by software.

**[decision]** A winner claims their prize themselves; it is paid instantly as subscription credit through Stripe and recorded with Stripe's transaction id. The admin's role ends at approval. Cash rails (RazorpayX / Stripe Connect) fit behind the same `PayoutGateway` later.

## Flow

Approved · pending → member opens the win → **Claim as subscription credit** → confirm → gateway credits the Stripe customer (created on the spot if the member never checked out) → RPC flips the row to paid with method + reference → member sees _Paid · ₹1,565.20 credited 22 Sep · ref …_ and **See it in your billing portal →**; admin sees the same; dashboard Total won counts it.

## Changes

- **Engine** — `stateMachine.ts`: event `mark_paid` → `claim_payout` (same transition, new owner). `engine/prizes/credit.ts`: `creditMonths(prizePaise, monthlyPricePaise)` for the "about N months free" line. Tests updated/added.
- **DB** — migration `20260921001400_claim_payout.sql`: `winner_verifications.payout_method text`, `payout_reference text`; RPC `claim_payout(p_verification_id, p_method, p_reference)` — caller must be the row's owner, review approved, payout pending → paid + paid_at + method + reference; `mark_winner_paid` dropped. Types regenerated.
- **Gateway** — `lib/stripe/PayoutGateway.ts` (`createCustomer`, `creditCustomer` with an idempotency key = verification id) and `StripePayoutGateway.ts` (`customers.create`, `customers.createBalanceTransaction` with a negative INR amount). `tests/fakes/payouts.ts` in-memory fake.
- **Repository** — `WinnerRepository.claimPayout(id, method, reference)` replaces `markPaid`; `WinningRecord` gains `payoutMethod`, `payoutReference`. Supabase impl + fake.
- **Service** — `services/ClaimPayoutService.ts`: ownership → state check (`claim_payout`) → customer (reuse or create + `profiles.setStripeCustomerId`) → credit → RPC. `WinnerService.markPaid` removed. Composition root `lib/payouts.ts` (service role for profiles + Stripe; the caller's client for the winner rows so the RPC sees `auth.uid()`).
- **Member UI** — `winnings/[id]`: `ClaimPayoutCard` (client): amount, "about N months free", **Claim as subscription credit** → inline confirm → action `claimPayout`. After: success banner with date + reference and a **See it in your billing portal →** button (existing `openBillingPortal`). Winnings list: **Claim payout** button when approved · pending; status label "Approved · claim your payout". Dashboard hint "₹X to claim".
- **Admin UI** — `ReviewPanel`: approved → "Approved. The member claims their payout from their Winnings page."; paid → "Paid · subscription credit · <date> · ref <…>". `markClaimPaid` action removed. Queue filter label "Awaiting claim".
- **Seed** — the two paid demo claims are written as paid with method `seed` (no Stripe call in the seed).
- **Tests** — unit: state machine rename, `creditMonths`, `ClaimPayoutService` (happy path creates a customer once, reuses an existing one, refuses before approval, refuses a stranger, idempotency key = verification id); integration: winner claims via RPC → paid with method/reference, stranger and admin refused, reports agree. Walkthrough 7: the winner clicks Claim instead of the admin marking paid.
- **Docs** — GAME.md §8 rewritten for the new step 3 + decision; TESTING step 9; README §09 line + limitations; PLAN.md; decisions table + PDF rebuilt.

## Verification

`pnpm test`, `pnpm test:int` (after `supabase migration up --local`), `pnpm build`, walkthrough 7 against the local server (needs `STRIPE_SECRET_KEY` in `.env.local` — present), owner: approve Priya as admin → as Priya claim → Paid with a Stripe reference; check the credit in Stripe's test dashboard under Customers.

## Out of scope

Cash payouts (RazorpayX / Connect), partial claims, reversing a credit.

## Outcome

Done 2026-09-22. 370 unit / 87 integration tests green on the migrated local stack; build clean. Walkthrough 7 end to end against the local server: admin approves, the winner claims, Stripe (test mode) credits the prize and returns `cbtxn_…`, the win reads Paid with the reference on both sides and the dashboard counts it. Awaiting the owner's own pass and the Stripe test dashboard check (Customers → balance).
