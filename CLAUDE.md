# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Kindscore** — a charity lottery for golfers, built for the Digital Heroes Level 1 PRD (trainee-selection assignment). Subscribers log their last 5 Stableford scores; monthly, 5 numbers 1–45 are drawn and matched against them; ≥10% of each fee goes to a charity the user picks. The PRD PDF is the source of truth; `docs/PRD.md` is its verbatim transcription (page 11/14, §13–§14, is missing from the PDF).

Read in this order before touching code: `docs/GAME.md` (rules + every `[decision]`), `docs/PLAN.md` (phase checklist — tick items as you go), `docs/specs/ARCHITECTURE.md`, `docs/specs/DESIGN.md`, `docs/specs/QA.md`.

**Every phase gets its own plan before execution:** `docs/plans/phase-N-<name>.md` — goal, boundaries, file-by-file contracts, test cases, order of work, what is explicitly out of scope. Write it, get it approved, then build. Phase 1's is `docs/plans/phase-1-engine.md`.

## Commands

```bash
pnpm dev                 # Next 16 dev server (Turbopack)
pnpm build               # production build — must pass before any phase is "done"
pnpm typecheck           # next typegen && tsc --noEmit (typegen creates LayoutProps/PageProps globals)
pnpm lint                # eslint . (next lint is removed in Next 16)
pnpm format              # prettier --write .
pnpm test                # Vitest unit project (tests/unit/**) — pure engine, no I/O
pnpm test:watch
pnpm test:coverage       # engine coverage thresholds: 100% lines/functions, 95% branches
pnpm test:int            # Vitest integration project (tests/integration/**) against LOCAL Supabase (.env.test); files run sequentially
pnpm vitest run tests/unit/engine/draw/allocatePrizes.test.ts   # single test file
pnpm db:start            # supabase start — local Postgres/Auth/Storage in Docker (Docker Desktop must be running)
pnpm db:reset            # drop + re-apply every migration + supabase/seed.sql on local
pnpm db:stop
pnpm db:types            # regenerate src/types/database.types.ts from LOCAL (run after every migration)
pnpm db:types:cloud      # same, from the linked cloud project
pnpm db:push             # supabase db push — apply migrations to the linked cloud project (nvduvsskhxkypmckfwil)
pnpm exec supabase db query --linked --file supabase/seed.sql   # seed the cloud charities (db push skips seeds)
pnpm seed                # tsx scripts/seed.ts (needs SUPABASE_SERVICE_ROLE_KEY)
pnpm stripe:listen       # forward Stripe test webhooks to localhost:3000
```

Stack: Next.js 16.3 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 (CSS-first, tokens in `src/app/globals.css` via `@theme`) · `motion` (Framer Motion v13) · Supabase (`@supabase/ssr`) · Stripe · Zod 4 · Vitest 5 · pnpm 12.

## Next.js 16 — what differs from older training data

- `middleware.ts` is **`proxy.ts`** exporting `proxy()`; Node runtime only.
- `cookies()`, `headers()`, `params`, `searchParams` are **async only** — always `await`.
- `LayoutProps<'/'>` / `PageProps<'/x/[id]'>` are generated globals from `next typegen`; run `pnpm typecheck` after adding routes.
- Parallel-route slots require `default.tsx`.
- Full guide: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. See also `AGENTS.md`.

## Layout

```
src/config/      constants.ts (every business number, PRD-cited) · env.ts (zod-validated, client vs server)
src/engine/      PURE — no imports from next/supabase/stripe. Unit-tested to 100%.
src/schemas/     Zod schemas shared by forms and server actions
src/repositories/ interfaces/ + supabase/ implementations
src/services/    orchestration over repositories + engine
src/lib/         supabase clients, stripe client, error mapping, auth guards
src/app/         (marketing) · (auth) · (member)/app · (admin)/admin · api/
src/components/  ui primitives · motion · feature components
supabase/        migrations · config
scripts/         seed.ts, package.ps1
tests/           unit/ (mirrors src/engine) · integration/
docs/            PRD, GAME, PLAN, DELIVERABLES, specs/
```

## Environment quirks

- Repo lives under OneDrive with an apostrophe in the path. **Quote every path.** Bash heredocs with apostrophes inside break — write files with the Write tool or a Python script. If Turbopack misses file changes, set `WATCHPACK_POLLING=true`.
- pnpm 12 blocks postinstall scripts; allowed ones are listed in `pnpm-workspace.yaml`.
- `.env.local` holds placeholders until Supabase/Stripe exist; `src/config/env.ts` validates shape at boot.
- Headless Edge screenshots (`msedge --headless=new --screenshot`) work for desktop; its minimum window width makes phone widths unreliable — use Playwright device emulation for mobile checks.

## Engineering workflow (user-mandated)

- **After every file written, give a concise architectural explanation**: why this structure, how it achieves modular isolation. The user must be able to understand and defend every file.
- SOLID — single responsibility per function/class; depend on abstractions (e.g. repository interfaces over direct Supabase calls in business logic).
- Composition over inheritance; treat state as immutable inside business logic (draw engine, prize math, score window must be pure functions).
- Functions under ~20 lines; extract pure helpers; early-return guard clauses instead of nesting.
- Intention-revealing names (`calculatePrizeTierShares`, not `handleData`).
- Structured error mapping at boundaries (API routes, server actions) — never let failures bubble unhandled.
- No magic numbers/strings: prize split, score range, window size, charity minimum, etc. live in named config constants.
- Inline comments only where logic is genuinely non-obvious.

## What the PRD asks for

A subscription-driven web app combining golf score tracking, a monthly lottery-style prize draw, and charity giving. Three roles: public visitor, registered subscriber, administrator.

### Hard deployment constraints (§15)

- Deploy to a **new** Vercel account (not personal/existing).
- Use a **new** Supabase project (not personal/existing).
- Env vars properly configured; deliver a public URL, test user credentials, and admin credentials.
- Stripe (or equivalent PCI-compliant provider) for payments; monthly and yearly (discounted) plans.

### Business rules that must be enforced exactly (§4–§9)

These cut across schema, API, and UI — get them right in the data layer first.

- **Subscription gating:** real-time subscription status check on every authenticated request. Non-subscribers get restricted access. Handle renewal, cancellation, and lapsed states.
- **Rolling 5-score window:** a user keeps exactly their latest 5 Stableford scores (range 1–45), each with a date. A new score evicts the oldest automatically. Display most-recent-first.
- **One score per date:** duplicate dates are rejected; an existing entry can only be edited or deleted.
- **Draw engine:** monthly cadence; two selectable modes — _random_ (standard lottery) and _algorithmic_ (weighted by score frequency). Admin must be able to run a **simulation before publishing**. Match tiers: 5-number, 4-number, 3-number.
- **Prize pool:** a fixed portion of each subscription funds the pool. Tier split is fixed — 5-match 40%, 4-match 35%, 3-match 25%. Pool tiers auto-calculate from active subscriber count. Multiple winners in a tier split equally. **Only the 5-match jackpot rolls over** if unclaimed.
- **Charity:** chosen at signup; minimum 10% of the subscription fee, user may raise it; plus an independent one-off donation path not tied to gameplay. Charity directory needs search/filter, profile pages (description, images, upcoming events), and a homepage spotlight.
- **Winner verification:** winners only. They upload a screenshot proof from their golf platform; admin approves/rejects; payout state goes Pending → Paid.

### Required surfaces

- **User dashboard (§10):** subscription status (active/inactive/renewal date), score entry/edit, selected charity + percentage, participation summary (draws entered, upcoming), winnings overview (total won, payment status).
- **Admin dashboard (§11):** user management (edit profiles/scores/subscriptions), draw management (configure logic, simulate, publish), charity CRUD + media, winners list/verify/mark paid, reports (total users, total prize pool, charity totals, draw stats).

### UI/UX direction (§12)

Must **not** look like a golf website — no fairways, plaid, or club imagery as the primary language. Emotion-driven, leads with charitable impact. Clean, modern, motion-enhanced with subtle micro-interactions. Prominent, persuasive subscribe CTA. Responsive on mobile and desktop.

### Evaluation (§16)

Judged on requirements interpretation, system design/data modelling, UI/UX creativity, data accuracy (score logic, draw engine, prize math), extensibility, and how ambiguity is identified and resolved — the PRD says "ambiguity is part of the test," so document assumptions where the spec is silent rather than guessing silently.

### Known gap in the PDF

The PDF file has 13 pages; page "11 / 14" (§13 Technical requirements and §14 Scalability considerations) is missing from the file. Stack and scalability choices are therefore unconstrained beyond §15 (Vercel + Supabase + Stripe).

## Submission format

The submission form accepts a file upload (max 50 MB combined; zip, pdf, doc, ppt, xls, png, jpg, mp3, mp4 only) plus an assignment link and required notes (≤2048 chars). Plan for a zipped repo and/or a live URL plus a short notes blurb.

# Next.js 16 agent rules (auto-maintained by `next dev`)

@AGENTS.md
