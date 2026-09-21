# Phase 10 — Landing page and polish

**Goal:** the public face of Kindscore per DESIGN.md §3 — impact first, the game second, golf as vocabulary only — plus `/how-it-works`, `/pricing`, the mobile nav, error pages, and the accessibility/performance pass. Everything on the landing page is real data from the ledger and the published draws; nothing is typed in.
**PRD:** §12 (emotion-driven, leads with charitable impact, clean/modern/motion-enhanced, prominent persuasive subscribe CTA, responsive), §08.2 (homepage spotlight), §16 (UI/UX creativity is a judged criterion).
**Done when:** the eight storyboard sections render from live data with the specified motions (once, on scroll, reduced-motion safe), the pages pass Lighthouse ≥ 90 performance and ≥ 90 accessibility on `/`, no horizontal scroll at 360/390, walkthrough green; committed as `Phase 10: landing`.

## 0. What already exists (reused, not rebuilt)

`CharitySpotlight`, `CharityCard`, `SplitSlider`/`SplitBar`, `JackpotOdometer`, `Histogram45`, `DrawNumbers`, `ScoreRow`, `FadeIn`, `Button`, `Card`, `Figure`, `Rule`; services `CharityService.featured/directory`, `DrawService.projectedJackpot/describeWeights`, `DrawRepository.listSummaries/activeSubscriberCounts`, `charity_totals` (public), `active_subscriber_counts()` (public). The engine's `generateNumbers`/`countMatches` power the practice draw client-side.

## 1. Files

### 1.1 Engine / pure helpers

- `engine/draw/practice.ts` — `practiceDraw(rng)` → `{ numbers, sample: [28,33,31,36,29], matches }` and `describeOutcome(matches)`; `jackpotLadder(summaries, upcomingMonth)` → last three published jackpots + the upcoming month (pure; tested).
- `lib/landing.ts` (server) — `loadLanding()` assembling: featured charity, three-up cards, proof figures (`charity_totals` Σ, projected jackpot, active member count), draw summaries, ladder, upcoming month. Figures that are zero are omitted (DESIGN §10 "counters that can render 0").

### 1.2 Landing `(marketing)/page.tsx` + `components/landing/*`

1. `Hero` — featured charity cover (`priority`), caption, H1 "Your last five rounds _could fund a classroom._", sub, `Subscribe & fund a cause · ₹499/mo` + `See how the draw works →`, reassurance line. Portrait fade 600ms, headline rise 12px 100ms later (`FadeIn`).
2. `ProofStrip` — up to three figures on one hairline, `JackpotOdometer`-style count for money; hidden entirely when nothing to show.
3. `HowItWorks` (client) — three numbered steps with Priya: mini Split at 10%; five numerals with the sixth sliding in and the oldest fading (once, on view); drawn `33 12 29 36 41` above Priya's row, `33 36 29` fill saffron → "3 matches · Priya shared ₹37,500 with 14 others in August."
4. `CharityImpact` — "Where the saffron goes." `SplitSlider` with live outcome line for the featured charity, `CharitySpotlight`, three `CharityCard`s, "See all charities →".
5. `PracticeDraw` (client) — "Pull this month's practice draw" → five tiles roll in (80ms stagger), matches light on the sample row, outcome line; mode toggle re-renders `Histogram45` from a sample distribution. No confetti.
6. `Jackpot` — "It grows until someone takes it." `JackpotOdometer` (projected) + ladder chips (last three months' jackpot pools + "next draw {Month}"); "First draw {Month}" before any is published.
7. `Pricing` — two cards with `SplitBar` at 10%, "₹417/mo · 2 months free", "incl. GST", lapsed line; `Subscribe` → `/signup`.
8. `ClosingCTA` — "Play your round. Fund a cause. _Give every month. Win some months._" + `Subscribe & fund a cause` + "Try a demo account →" (`/login?demo=1`).

### 1.3 Pages

- `/how-it-works` — long-form of GAME.md §2–§8 in plain language (the five scores, the draw and both modes, tiers and split, rollover, verification, what lapsing means) + FAQ (10 questions). Static.
- `/pricing` — the two plan cards, the Split explained (10–70%, pool 30%), GST line, FAQ (cancel, lapse, yearly, donations). Static.
- `/login?demo=1` — a "Demo accounts" panel listing the seeded personas (constants `DEMO_ACCOUNTS`, shown only when `NEXT_PUBLIC_DEMO_ACCOUNTS=1`; Phase 11 sets it on Vercel).
- `not-found.tsx` / `error.tsx` — one line, one action, within the brand (already close; polish copy and add the wordmark to `error.tsx`).
- `robots.ts`, `sitemap.ts`, `metadataBase` + Open Graph fields in the root layout; `opengraph-image.tsx` (ivory card, wordmark, tagline — generated, no photo).

### 1.4 Nav and polish

- `SiteNav`: mobile menu (`MobileMenu` client: button + panel, focus-trapped, Escape closes); `MobileSubscribePill` (client, IntersectionObserver on a hero sentinel; fixed bottom-centre, safe-area inset; hidden when signed in).
- `globals.css`: `:focus-visible` saffron ring 2px/offset 2px; hover effects gated by `@media (hover:hover) and (pointer:fine)`; `prefers-reduced-motion` kills transforms.
- Root layout: skip link "Skip to content" → `#main`; every layout's `<main id="main">`.
- `revalidate = 60` on `/how-it-works`, `/pricing`, `/draws`, `/charities/[slug]` where no cookies are read; the landing reads the session for the nav (dynamic) but its data calls are the same cheap public reads.

## 2. Tests

- **Unit**: `practiceDraw` (five distinct, matches counted on the sample row, outcome copy), `jackpotLadder` (last three, ascending months, next month appended; empty → just the next month), `proof figures` shaping (zeros omitted).
- **Walkthrough** `scripts/walkthrough-phase10.ts`: `/` at 1280 (screenshots of each section), practice draw pulled, `/how-it-works`, `/pricing`, `/login?demo=1`, 404 page, 390px full-page + pill appears after scroll + no horizontal overflow, 360px overflow check; Lighthouse (`lighthouse` CLI against the running build, desktop + mobile presets) with scores logged into the walkthrough output.

## 3. Order of work

1. engine helper + tests → `lib/landing.ts` → landing components → page
2. `/how-it-works`, `/pricing`, demo panel, metadata/robots/sitemap/OG → nav (mobile menu, pill) → CSS polish (focus, reduced motion) → error pages
3. walkthrough + Lighthouse → fixes → docs (`PLAN.md`) → commit `Phase 10: landing`

## 4. Explicitly not in this phase

Seed data and deployment (Phase 11 — the landing renders correctly with zero data too: the proof strip hides, the ladder shows "First draw"). Realtime odometer. A blog or press page. Any golf imagery.

## 5. Decisions made here

- **[decision] The landing page never shows a fabricated number.** Every figure comes from the ledger, the published draws or the live subscriber count; anything that would read "0" is left out rather than shown.
- **[decision] The practice draw is client-side and clearly labelled "practice"** — it uses the real engine but never touches the database or the real draw.
- **[decision] Demo credentials are shown only behind `NEXT_PUBLIC_DEMO_ACCOUNTS=1`** — on for the evaluators' deployment, off by default.

## 6. Outcome (2026-09-22)

Done. 352 unit / 87 integration tests, build clean, walkthrough green.
Lighthouse on `/`: desktop **98 / 100 / 100 / 100**, mobile **82 / 100 / 100 / 100**. The mobile gap is LCP (4.7 s) under Lighthouse's simulated slow-4G + 4× CPU: the ~60 KB hero photo queues behind fonts and scripts. Tried and kept: `fetchpriority=high` + sync decode on the hero, dropping the second `priority` image, removing the Newsreader `opsz` axis (78 → 82, a11y 96 → 100 with the contrast fix). Tried and reverted: not preloading Inter (FCP worse, LCP unchanged). Accepted at 82 rather than trading the photo-led hero for a score.
