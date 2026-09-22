# Phase 12 — Polish from user testing (feel, admin entry, draw controls, docs)

## Context

The owner walked the local build as a first-time visitor, as admin and as each persona (2026-09-22) and listed what felt wrong. One real bug (a lapsed member read as "never subscribed"), several feel and clarity gaps against PRD §12 ("motion-enhanced, subtle micro-interactions"), one missing §11 control ("configure draw logic"), and an evaluator document that read like a spec instead of a script.

Decisions with the owner: add a configurable weighting strength to the algorithmic draw; leave the re-simulate loop as is (the stale guard already blocks simulate → edit scores → publish); keep **Mark as paid** as the PRD §09 admin action — Stripe collects, payouts stay outside the app (Stripe Connect / RazorpayX is the documented next step).

## Changes

- **Lapsed members** — `lib/auth/access.ts` read only `active`/`past_due` rows, so `lapsed`/`cancelled` collapsed to "never subscribed". It now reads the latest row whatever its status; the engine decides access.
- **Admins land in the admin** — login sends admins to `/admin` (unless a `?next=` asked otherwise); an **Admin** tab in the member nav; the public nav's signed-in link reads "Admin".
- **Figures fit** — `Figure` gains `size="md"` and wraps; the admin overview uses it.
- **Password meter** — `PasswordField`: a hairline that fills with length and turns green at 8; inputs focus in ink, not saffron.
- **Landing motion** — hero children stagger in; proof figures count up on view; every section header, the slider, the spotlight, charity cards, the practice draw, the jackpot ladder and the plan cards reveal on scroll; cards and steps darken their hairline on hover; nav links underline; public routes fade in via `(marketing)/template.tsx`. All respect reduced motion.
- **Draw controls** — `buildWeights(mode, frequency, strengthBps)`: algorithmic weight = baseline + strength × smoothed frequency (0 = flat, 100% = today). `draws.weight_strength_bps` recorded with each simulation (`save_simulation` gains the parameter; `draw_statistics` exposes it). Admin panel: **Weighting strength** dial (algorithmic only); `Histogram45` now draws the weights as saffron bars — flat in random, the distribution in weighted — animating between modes and strengths; reports and cards say "Weighted by scores · 60%" when the dial was moved.
- **Winning draw → claim** — member outcomes carry the verification id; the reveal ends in **Claim your prize →** (or **See your payout →**), and the dashboard's latest-draw line links it too.
- **Evaluator document** — `docs/TESTING.md` rewritten as a human script (accounts, twelve one-line steps with what you should see); the PDF gets a designed cover, coloured headings and step numbers.

## Verification

`pnpm test` (361 → engine strength cases, service records the dial), `pnpm test:int` on the migrated local stack, `pnpm build`, walkthroughs 3 / 6 / 9, owner re-test.

## Outcome

Done 2026-09-22. 361 unit / 87 integration tests green on the migrated local stack; build clean; walkthroughs 3 (admin lands on `/admin`, two-step banner copy), 6 (dial + histogram, claim CTA in the outcome line) and 9 pass. Screenshots and the PDF rebuilt; the local demo world re-seeded. Awaiting the owner's own pass.
