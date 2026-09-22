# Phase 11b — Subscribe flow and CTA copy (from user testing)

## Context

Manual testing of the local build (TESTING.md steps 1–2, 2026-09-22) surfaced three framing problems — none of them rule bugs, all of them how the product _reads_ to a first-time visitor, which is exactly what PRD §12 ("prominent, persuasive subscribe CTA") and §16 (UI/UX) judge:

1. **The CTA showed a price for one of two plans.** Nav, hero and the mobile pill said "Subscribe · ₹499/mo" although the PRD (§04, §15) requires monthly _and_ yearly.
2. **"Subscribe" led to account creation, then dropped you on a half-locked dashboard.** The plan was chosen later, from a banner. The promise and the landing didn't match.
3. **A non-subscriber's dashboard showed rupee splits** ("₹149.70 to the prize pool") for money they had not paid — and monthly amounts for yearly members.

Decision with the user: keep "Subscribe" as the CTA and make it honest — **a two-step flow**: step 1 account + charity, step 2 plan + Stripe. Someone who stops between the two is a registered non-subscriber with restricted access (§04) — unchanged behaviour, only the on-ramp changes.

## Changes

### 1. CTAs say "Subscribe"; prices move to context

`SiteNav`, `MobileSubscribePill` → "Subscribe". `Hero` → "Subscribe & fund a cause", with "₹499/month or ₹4,999/year · cancel anytime · …" underneath (values from `PLANS`). `Pricing` cards link to `/signup?plan=month|year` so the clicked plan carries through.

### 2. Two-step signup

- `schemas/auth.ts`: `planIntervalSchema` (shared with the checkout action); `signupSchema.plan` optional.
- `/signup`: `Stepper` "Account & charity · Plan & payment" (`components/app/subscribeSteps.ts`), "Step 1 of 2" copy, hidden `plan` field, button stays **Create account**.
- `signUp` action redirects to `/app/subscription[?plan=…]` — step 2 — instead of the dashboard.
- `/app/subscription`: for a first-timer the same Stepper at step 2 and "Step 2 of 2 — pick a plan"; `PlanChooser` highlights and focuses the pre-selected plan ("Your pick"), otherwise yearly "Best value" as before.
- Banner for `none`: "You're not subscribed yet — pick a plan … **Choose a plan**".

### 3. Dashboard charity card tells the truth about money

`CharityModule` in `app/page.tsx`: active member → split of _their_ payment ("25% of every ₹4,999 yearly payment"); non-subscriber → compact bar, "25% of every payment will go here once you subscribe — at least ₹49.90 a month." + **Choose a plan →**; admin → share only.

### 4. Tests, walkthroughs, docs

Unit tests for `plan`; walkthroughs 3/4/5 expect `/app/subscription` after signup; TESTING.md steps 1–2; GAME.md §1 + §9 decisions; screenshots 01 and 03 re-captured; docs rebuilt.

## Out of scope

Choosing the plan on the signup form itself (create-user-then-checkout in one action); any change to the restricted-access rules; pricing.

## Outcome

_(filled in after verification)_
