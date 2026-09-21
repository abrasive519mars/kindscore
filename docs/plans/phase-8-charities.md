# Phase 8 — Charities and donations

**Goal:** the charity side of the product becomes real: a public directory with search and filters, a profile page per charity (story, photos, upcoming events, what has been given), the member's control over where their money goes (change charity, raise the percentage), a one-off donation path through Stripe that is not tied to the game, and the admin's full charity management (create/edit, cover + gallery uploads, events, featured spotlight, soft-delete).
**PRD:** §08.1 (chosen at signup ✓, ≥10% ✓, user may increase, independent one-off donation), §08.2 (directory with search/filter, profile pages with description/images/events, homepage spotlight), §11.03 (admin CRUD, media, events), §16.1 steps 11–12.
**Done when:** directory + profile + `/app/charity` + donation + admin CRUD all work against local Supabase and Storage, a real ₹250 test donation lands in the ledger, the walkthrough covers visitor → member → admin, build/lint/tests green; committed as `Phase 8: charities`.

## 0. What already exists

| Layer              | Already built                                                                                                                                                                                                                                                                                                                              | Phase 8 adds                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Database (Phase 2) | `charities` (soft-delete `is_active`, `featured_rank`, `outcome_line`, `cover_path`), `charity_media`, `charity_events`, `donations` (member may insert unpaid; only the service role flips `paid`), ledger trigger on `paid`, `charity_totals` view, `charity-media` public bucket (admin write), RLS: public reads active charities only | no migration                                                                                     |
| Engine (Phase 1)   | `validateCharityBps`, `splitPayment`                                                                                                                                                                                                                                                                                                       | `charity/directory.ts` (pure search/filter, slug), `charity/donation.ts` (amount rule)           |
| Stripe (Phase 5)   | `BillingGateway`, webhook pipeline, `stripe_events` idempotency, success-page sync pattern                                                                                                                                                                                                                                                 | `createDonationCheckout` / `retrieveCompletedDonation`; a donation branch in `handleStripeEvent` |
| Seed (Phase 2)     | 7 charities, media rows pointing at `public/seed/<slug>/*.webp`, events                                                                                                                                                                                                                                                                    | admin uploads go to Storage; one helper resolves both kinds of path                              |

## 1. Shape of the code

```
visitor ─▶ /charities            CharityRepository.listActive() → engine filterCharities(q, category, city) → CharityCard grid
        ─▶ /charities/[slug]     CharityRepository.findBySlug + media + upcoming events + charity_totals
member  ─▶ /app/charity          ProfileRepository (Phase 5) → updateCharityChoice(charityId, bps): validateCharityBps → profiles update (RLS-granted columns)
        ─▶ Donate once           DonationService.start(userId, charityId, amountPaise)
                                   ├─ engine validateDonationAmount (≥ ₹10, whole rupees)
                                   ├─ id = randomUUID()  → gateway.createDonationCheckout({ donationId: id, … })  mode "payment", metadata.kind = "donation"
                                   └─ DonationRepository.create({ id, sessionId, … , paid: false })   (member's own client; RLS: insert own, unpaid)
Stripe  ─▶ webhook checkout.session.completed (metadata.kind = donation) → DonationRepository.markPaid(donationId)   (service role) → ledger trigger
        ─▶ success page ?session_id= → syncDonation(sessionId) — same markPaid, idempotent — so a dev box without a webhook is still consistent
admin   ─▶ /admin/charities      CharityService: create/update (slug from name), setFeatured (exactly one), setActive (soft-delete with contributor count), media upload (CharityMediaStorage → charity-media bucket), events upsert/delete
```

The donation id is generated _before_ Checkout so the Stripe session can carry it in metadata and the row can carry the session id — no circular write, no service role on the member's path.

## 2. Files, in build order

### 2.1 Engine (pure)

- `engine/charity/directory.ts` — `filterCharities(list, { query, category, city })` (case-insensitive match on name/tagline/city/category; filters AND together), `slugify(name)`.
- `engine/charity/donation.ts` — `DONATION.MIN_PAISE` (₹10) and `PRESETS` in constants; `validateDonationAmount(paise)` → integer, ≥ min, ≤ ₹1,00,000 (a sanity cap, not a rule).

### 2.2 Repositories

- `CharityRepository`: `listActive()`, `listAll()` (admin), `findBySlug`, `findById`, `listMedia(charityId)`, `listUpcomingEvents(charityId, now)`, `listTotals()` / `findTotals(charityId)` (view), `contributorCount(charityId)`, `create`, `update`, `setActive`, `setFeatured(id)` (clears others in the same call), `addMedia`, `removeMedia`, `upsertEvent`, `deleteEvent`. Supabase impl on the caller's client.
- `DonationRepository`: `create(write)`, `markPaid(id, sessionId)` → `"paid" | "already_paid" | "not_found"`, `listForUser(userId)`, `findById`.
- `ProfileRepository` (Phase 5) gains `updateCharityChoice(userId, charityId, bps)`.

### 2.3 Storage

`lib/storage/CharityMediaStorage.ts` (+ Supabase impl): `upload(path, file)` → public URL path; `lib/charityImages.ts`: `charityImageUrl(path)` → `/seed/…` for seed files, Storage public URL otherwise; `next.config.ts` `images.remotePatterns` for the Supabase host.

### 2.4 Services

- `CharityService` (public + admin): `directory(filter)`, `profile(slug)` → `{ charity, media, events, totals }`, `saveCharity(input)` (slug from name on create; unique-violation → Conflict), `setFeatured`, `deactivate(id)` → returns contributor count for the message, `reactivate`, `uploadMedia(charityId, file, role: cover | gallery)` (validate 2 MB/type → storage → cover_path or media row), `removeMedia`, `saveEvent`, `deleteEvent`.
- `MemberCharityService`: `current(userId)`, `updateChoice(userId, charityId, bps)` (charity must be active).
- `DonationService`: `start(userId, email, charityId, amountPaise)` → `{ url }`; `syncFromCheckout(sessionId)` (service role composition in `lib/donations.ts`); `historyForUser(userId)` (ledger rows: subscription slices + donations, with charity names).
- Webhook: `handleStripeEvent` gets a `donations` dependency; `checkout.session.completed` with `metadata.kind === "donation"` → `markPaid`; existing subscription path unchanged.

### 2.5 Pages

- `(marketing)/charities/page.tsx` — search field (GET `?q=`), chips for category and city (from the data), `CharityCard` grid (cover, name, city, outcome line, "₹X given by N members"), empty "Nothing matches — clear filters". ISR 60s… but search is a GET param so `dynamic`.
- `(marketing)/charities/[slug]/page.tsx` — cover, name, city, tagline, outcome line, story, totals (given, contributors), gallery, upcoming events, actions: **Choose this charity** (member: form → updateChoice; visitor: link to `/signup?charity=slug`) and **Donate once** (`DonateForm` for members; "Log in to donate" otherwise). `?donated=1` / `?session_id=` handled like the subscription page.
- `(member)/app/charity/page.tsx` — current charity card with outcome line, `SplitSlider` bound to a form (10–70, step 5) + "Save" → "applies from your next payment", change charity select, donation form, contribution history (ledger) with total given.
- Signup: `?charity=<slug>` preselects.
- `(admin)/admin/charities/page.tsx` (table: name, category, city, featured, active, contributors, given; "New charity"), `/admin/charities/new`, `/admin/charities/[id]` (form; cover uploader with preview; gallery grid with add/remove; events editor; Featured toggle; Hide/Show with the contributor-count sentence). Actions with `requireAdmin`.
- `components/charity/{CharityCard,CharitySpotlight,EventList,DonateForm}.tsx` — `CharitySpotlight` is built here and placed on the landing in Phase 10.

## 3. Tests

- **Unit**: `directory` (query matches name/city/category, AND-filters, empty query = all, slugify "Udaan Girls' Sports Collective" → `udaan-girls-sports-collective`); `donation` (₹9.99 refused, ₹10 ok, non-integer refused, cap); `charityImageUrl`; `DonationService` with fakes (id in metadata = row id, session id stored, inactive charity refused, sync marks paid once); `MemberCharityService` (bps rule, inactive charity refused); `CharityService.saveCharity` slug + conflict, `setFeatured` clears others, `deactivate` returns count; webhook donation branch (fake donations repo).
- **Integration** `tests/integration/charities.test.ts`: anon lists only active charities; member updates charity + bps (RLS), 7100 bps refused by the check constraint; donation row created by the member (unpaid) → `markPaid` as service role → one ledger row → `charity_totals` up by the amount → second `markPaid` is a no-op; admin creates a charity + event, uploads a cover to `charity-media` (anon upload refused), sets featured (only one), soft-deletes → gone for anon, still readable for admin.
- **Walkthrough** `scripts/walkthrough-phase8.ts`: `/charities` → search "water" → filter Health → profile → member: `/app/charity` raise to 25% → change charity → donate ₹250 on real Stripe Checkout → back → "Thank you" + ledger row → admin: new charity with cover + event → featured → hide → directory no longer lists it. Screenshots in `docs/screenshots/phase-8/`.

## 4. Order of work

1. engine + tests → repositories + storage → services + tests → webhook branch + gateway → `lib/donations.ts`
2. integration test → public pages → member page + signup preselect → admin pages → components
3. walkthrough → docs (`GAME.md`, `PLAN.md`) → commit `Phase 8: charities`

## 5. Explicitly not in this phase

Landing page spotlight placement and proof strip (Phase 10 — the components are ready). Donations by visitors without an account (see decision). Admin reports (Phase 9 — `charity_totals` is already the source). Image cropping/resizing beyond the 2 MB cap.

## 6. Decisions made here

- **[decision] Donations need an account.** Signup is free and takes a minute; every rupee in the ledger then belongs to a member, which is what makes "you have given ₹X" and the charity's contributor count honest. A visitor's "Donate once" leads to signup with the charity pre-selected.
- **[decision] Minimum one-off donation ₹10**, whole rupees, capped at ₹1,00,000 per transaction as a sanity limit.
- **[decision] Exactly one featured charity** — the homepage spotlight; making another one featured un-features the previous.
- **[decision] Charities are never hard-deleted.** "Hide" removes a charity from the directory and from signup; members already contributing keep contributing until they change (their history stays with the charity). The admin sees how many that is before hiding.
- **[decision] Changing charity or percentage applies from the next payment** (already in GAME.md §1) — the page says so next to the Save button.

## 7. Outcome (2026-09-22)

Done. 333 unit / 81 integration tests, build clean, walkthrough green against real Stripe test mode.
Found while building: `charity_totals` was `security_invoker`, so a visitor saw ₹0 given for every charity (the ledger rows are private). One migration makes the view owner-run — it exposes only per-charity sums and contributor counts, which PRD §08.2 makes public. Same class of bug as the Phase 6 `draw_statistics` fix; both views are now documented in ARCHITECTURE.md as public aggregates.
