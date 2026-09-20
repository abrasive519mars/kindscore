# Kindscore — Design spec (Direction B: Editorial Impact)

Chosen 2026-09-21 against PRD §12. Governing sentence: **"Design must be emotion-driven — leading with charitable impact, not sport."** Everything below is ordered by that: the charity is the first thing seen, the game is the second beat, golf is vocabulary only. Research basis: `docs/specs/UX_RESEARCH.md` (§2 charity patterns, §3 motion numbers, §4 homepage/CTA, §5 admin).

---

## 1. Principles (the five tests every screen must pass)

1. **Impact first.** Above the fold, a human and an outcome appear before any number, price or game rule. (§12 "leading with charitable impact")
2. **The money is visible.** Wherever ₹ appears, the split to charity is stated or drawn. Nobody should wonder where their fee goes. (§08, research §2 "the split, stated plainly")
3. **Numbers are the only decoration.** The five Stableford scores, the five drawn numbers, and the rupee figures are set large in tabular numerals and are the graphic language. No golf scenery, ever. (§12 AVOID)
4. **Quiet surface, few moments.** Hairlines, ivory, ink. Motion budget: three signature moments; everything else ≤ 200ms fades. (§12 FEEL, ANIMATIONS)
5. **Warm voice.** Serious money, light tone. "Match three and you share the pool" — never "ENTER NOW". (research §2 "warmth through voice, not pathos")

---

## 2. Brand system

### 2.1 Palette

| Token | Role | Light | Dark |
|---|---|---|---|
| `bg` | page | `#F7F3EC` ivory | `#131211` |
| `surface` | cards, table rows | `#FFFDF9` | `#1C1A18` |
| `surface-2` | tinted panels, stripes | `#F0EAE0` | `#262321` |
| `ink` | text, primary buttons | `#171411` | `#F2EDE4` |
| `ink-2` | secondary text | `#5F5850` | `#A69E93` |
| `ink-3` | captions, disabled | `#8E867B` | `#6F675D` |
| `line` | hairlines, rules | `#DDD5C8` | `#332F2A` |
| `saffron` | **the accent** — charity slice, links, focus ring, the single highlight per viewport | `#D9791A` | `#F2994A` |
| `saffron-ink` | text on saffron | `#1A0F04` | `#1A0F04` |
| `pool` | prize-pool slice in the Split, "drawn" ring | `#2B4A7A` | `#8FB0E8` |
| `success` | approved / paid | `#2E6B45` | `#5FBF85` |
| `warn` | pending / draft / lapsing | `#8F6414` | `#E8B04C` |
| `danger` | rejected / errors (always with icon + text) | `#933A2B` | `#F08A7A` |

Rules: saffron appears **once per viewport** as a highlight (a rule, a figure, a button) and always as the charity slice in any money diagram — "the saffron part is the part that goes to charity" is literally true everywhere. No green anywhere in the product. Dark mode: no shadows, hairline borders only, saffron desaturated 8%.

### 2.2 Type

| Face | Role | Settings |
|---|---|---|
| **Newsreader** (Google, variable, optical size) | Display: H1/H2, pull-quote numerals, the charity outcome line | `opsz` auto; H1 56–72px `wght 500`, tracking −0.015em; italics allowed for the emotional clause ("*could fund a classroom.*") |
| **Inter** (variable, `next/font`) | Body, UI, tables, forms | Body 16/1.6 on marketing, 15/1.5 in app; `font-feature-settings: "cv11", "ss01"`; **`font-variant-numeric: tabular-nums` on every number**; labels 12.5px 500 uppercase +0.06em `ink-2` |
| Numerals (both faces) | Scores / drawn numbers / ₹ | Newsreader for display figures ≥ 40px; Inter tabular below. `Intl.NumberFormat('en-IN')` everywhere (₹1,80,000) |

### 2.3 Tokens

| Token | Values |
|---|---|
| Radius | `sm 4` · `md 8` · `lg 14` · `full`. Photos `md`. Buttons `full` (pill) on marketing, `md` in app |
| Elevation | Light: none by default; `s1: 0 1px 0 rgb(23 20 17/.06)` under sticky nav only; modal `0 24px 64px -24px rgb(23 20 17/.35)`. Dark: borders only |
| Rules | 1px `line`. Section dividers are a **hairline + a 24px saffron dash** at the left (the one accent) |
| Spacing | 8px base; marketing sections 96px vertical; app 24px gutters, 16px on mobile |
| Duration | `fast 120` · `base 200` · `move 320` · `reveal 600` · `story 900` ms |
| Easing | enter/exit `cubic-bezier(.23,1,.32,1)` · move `cubic-bezier(.77,0,.175,1)` · drawer `cubic-bezier(.32,.72,0,1)` · spring `{duration .5, bounce .2}` |
| Stagger | 60ms, cap 6 |
| Texture | None. Ivory is flat. Photography carries all warmth |

### 2.4 Motifs

- **The outcome line** — every charity has one sentence in the form *"₹50 a month = [unit]"* ("= 5 school days for one girl", "= 12 cataract screenings"). It appears on the card, the profile, the Split, and the post-subscribe confirmation.
- **The five numerals** — a user's scores always render as five large tabular figures on a single hairline baseline, oldest on the right. Drawn numbers render the same way with a `pool`-blue ring. A match fills the figure saffron. This *is* the ticket; there is no ticket illustration.
- **The Split** — one horizontal bar: saffron (charity) · pool-blue (prize pool) · `surface-2` (platform). Static on cards, interactive under a slider.
- **The stepper** — state machines (draw: Draft → Simulated → Published; winner: Awaiting proof → Submitted → Approved → Paid/Rejected) render as a horizontal stepper: filled dot = done, ring = current, hollow = future, with a timestamp/actor line.
- **Logomark** — wordmark "Kindscore" in Newsreader 500 with a single saffron full stop (`Kindscore.`). **Favicon / app icon** = an ivory outline heart hanging from the saffron full stop, on an ink rounded square (`src/app/icon.svg`). Chosen 2026-09-21 by the user over an initial "K", a lone full stop, and filled hearts — charity-first, and still the wordmark's stop.

### 2.5 Photography

Documentary, dignity-framed, one person or a small group *doing* something (learning, planting, examining eyes) — never posed pity. Warm natural light. Indian settings. One photo per charity (cover) + 2–3 gallery. Source: Unsplash/Pexels under their licences, curated for Indian context, attributed in `docs/CREDITS.md`. Photos are the **only** place colour is unrestricted. Never: golf courses, flags, balls, clubs, plaid, stock handshakes.

---

## 3. Landing page storyboard (§12 HOMEPAGE: what you do · how you win · charity impact · CTA)

| # | Section | Content (real copy) | The one motion | Why it's there |
|---|---|---|---|---|
| 1 | **Hero** (impact-first) | Left 55%: cover portrait of the featured charity's beneficiary, `md` radius, caption "Udaan Girls' Sports Collective · Hyderabad". Right: H1 "Your last five rounds *could fund a classroom.*" Sub: "Every Kindscore subscription sends at least ₹50 a month to a charity you choose — and enters your five most recent Stableford scores into a monthly draw. Match three, four or five and you share the prize pool." Primary `Subscribe & fund a cause · ₹499/mo` · soft `See how the draw works →`. Reassurance: "Cancel anytime · at least ₹50 to your charity · payments by Stripe". | Portrait fades in (600ms); headline rises 12px (600ms, 100ms later). Nothing loops. | All four §12 homepage items in the first viewport, cause before game |
| 2 | **Live proof strip** | Three server-rendered figures on one hairline: "₹2,41,300 given to charities" · "₹1,80,000 jackpot — rolls over until won" · "312 golfers playing". Each with a `pool`/saffron dash. | Odometer count-up once on first paint (900ms, stagger 60ms). | Trust via real ledger numbers (research §2 "proof as a feature") |
| 3 | **How it works** | Header "Three steps. One round a month." Numbered, Kiva-style, with a named golfer: (1) "Subscribe and pick your charity." + mini Split at 10%. (2) "Log your last five scores — 1 to 45, one per date. A sixth replaces the oldest." + the five numerals `28 33 31 36 29` with a sixth `35` sliding in and `28` fading. (3) "Match the monthly draw." + drawn `33 12 29 36 41` above Priya's row, `33 36 29` fill saffron → "3 matches · Priya shared ₹37,500 with 14 others in August." | Step 2's eviction (200ms in / 150ms fade) and step 3's match fill (200ms) play once on scroll-into-view. | "What the user does" and "how they win" demonstrated with real rules |
| 4 | **Charity impact** (the emotional core) | Header "Where the saffron goes." Interactive Split with slider 10→70%; under it the outcome line updates live ("₹75 a month = 7 school days"). Then a 3-up of charity cards (photo, name, city, outcome line, "Verified" chip). "See all 7 charities →". | Split segments resize with layout spring; outcome figure rolls. | §08 charity leads; user *feels* control over their money |
| 5 | **The draw** | Header "How a draw works." One paragraph, then a live mini-reveal the visitor can trigger: `Pull this month's practice draw` → five tiles roll in (80ms stagger), matches light on a sample row, result line. Beneath: "Random or weighted by what golfers actually score — the admin chooses each month" with a small 1–45 histogram that toggles. | Tile roll-in per research §3.3 A. Confetti never on the landing page. | Explains both draw modes; the only "game" section |
| 6 | **Jackpot** | Header "It grows until someone takes it." Large Newsreader odometer `₹1,80,000` and a three-month ladder "Jun ₹60,000 · Jul ₹1,20,000 · Aug ₹1,80,000 — next draw 30 Sep". | Odometer roll on enter. | The one legitimate urgency device (research §4.2) |
| 7 | **Pricing** | Two cards: **Monthly ₹499** · **Yearly ₹4,999** with "₹417/mo · 2 months free" beneath; "incl. GST"; each card shows its Split at 10%; line "Lapsed members keep their scores but sit out the draw." | Selected card gets the saffron rule. | Indian D2C conventions (research §4.2) |
| 8 | **Closing CTA** | Ivory band: "Play your round. Fund a cause. *The fair way.*" `Subscribe & fund a cause` + "Try a demo account →" (evaluator on-ramp). | Headline fade. | Tagline lands last |

Nav (≤6): `Charities · How it works · Draws · Pricing` + `Log in` + `Subscribe` (ink pill; on mobile becomes a fixed bottom-centre pill once the hero CTA scrolls off).

---

## 4. Signature moments (the motion budget — three, plus one utility)

### 4.1 Draw Reveal — `/app/draws/[id]`
Result-first on return visits; the show on first view after publish (research §3.3 A + D).
- First view: a headline placeholder "This month's draw"; the user's five numerals on their baseline. Five drawn tiles roll in left→right (`scale .96→1 + opacity`, 240ms, 80ms stagger). 400ms after the last: a single pass — each matching numeral fills saffron (200ms) and its drawn tile gets a `pool` ring; non-matches soften to `ink-3`. Then the outcome line resolves: "**3 matches** — you share ₹37,500 with 14 members" / "**No match this month** — the jackpot rolls to ₹2,40,000". Jackpot (5-match) only: one saffron/pool confetti burst, 1.2s, once.
- Return visits: result line and numbers render instantly; "Watch the draw" replays the roll-in.
- Skip link; reduced motion → final frame + "Play the reveal".

### 4.2 Jackpot Odometer
Fixed-width digit columns (`ch` cells), each a 0–9 strip. Roll 0→value on first paint (900ms, right-to-left stagger); on live change (Supabase realtime on the open draw) only changed digits roll (400ms spring). `en-IN` grouping. `aria-label` with the value; strips `aria-hidden`. Used on landing §2/§6, member dashboard, admin overview.

### 4.3 The Split
Slider 10–70% step 5 above the bar. Saffron grows, pool holds at 30%, platform shrinks to 0 at 70% where a small `ink` label reads "Kindscore takes nothing". Rupee values (paise-exact) and the charity's outcome line update live. Signup step 2, `/app/charity`, landing §4.

### 4.4 Score entry (utility, kept quiet)
`/app/scores` — five numerals on the baseline, newest left. `Add a score` opens an inline row: number input (`inputmode=numeric`, 1–45, tabular) + date (default today, used dates disabled). Save → new figure slides in at left (200ms), the sixth fades at right (150ms), inline confirmation "Saved — replaced your 19 Aug score (31)" (no toast). Tap a figure → inline edit. Duplicate date → the date field shows the existing entry inline with Edit/Delete (research §3.4). Fewer than five → hollow slots "Enter 2 more to be in October's draw".

---

## 5. Page inventory

Every page: dimension-matched skeletons, an empty state that prompts the next action, an `error.tsx` with one line and one action. Golf appears only in words.

| Route | Components | Empty |
|---|---|---|
| `/` | Hero, ProofStrip, HowItWorks, SplitSection + CharityCards, PracticeDraw + Histogram45, JackpotSection, Pricing, ClosingCTA | Proof strip hides silently if no draws |
| `/how-it-works` | Long-form of §3 steps 3–6, FAQ | — |
| `/charities` | Search, FilterChips (cause · city), CharityCard grid (photo, outcome line, Verified) | "Nothing matches — clear filters" |
| `/charities/[slug]` | Cover, story, outcome line, gallery, EventList, `Choose this charity` / `Donate once` | "No upcoming events" |
| `/draws` | DrawCard list (numbers, tier counts, jackpot, rollover chip) | "First draw 30 Oct" |
| `/pricing` | Pricing cards, Split, FAQ | — |
| `/login`, `/signup` | Signup 4-step Stepper: account → charity + Split → plan → Stripe | Inline field errors |
| **`/app`** | StatusBanner, ScoreRow (compact), Jackpot, NextDraw, CharityStat + mini Split + outcome line, WinningsStat, LatestDraw | New member: hollow numerals + "Enter your first five scores" |
| `/app/scores` | ScoreRow full + inline form | Hollow slots |
| `/app/draws`, `/app/draws/[id]` | DrawCard list; Draw Reveal | "You haven't been in a draw yet" |
| `/app/charity` | Current charity card, Split slider, change charity, DonateOnce | — |
| `/app/winnings`, `/app/winnings/[id]/proof` | WinningsTable, total; FileDrop + Stepper (Awaiting → Submitted → Approved → Paid) | "No winnings yet. Three matches is all it takes." |
| `/app/subscription` | PlanCard, renewal, portal link, cancel modal; lapsed = warn rule + "Renew to enter October" | — |
| `/app/settings` | Profile, theme, danger zone | — |
| **`/admin`** | Five figures with trend (users · active · pool · charity total · pending proofs), open-draw Stepper, recent winners | — |
| `/admin/users`, `/admin/users/[id]` | DataTable (search, status filter); profile, admin-editable ScoreRow, SubscriptionControls, audit list | "No users match" |
| `/admin/draws`, `/admin/draws/[id]` | Month, ModeToggle + Histogram45, `Simulate`, draft panel (`warn` rule, "Simulated 14 Sep 18:02"), WinnersTable, `Publish` confirm ("Publishing makes these 5 numbers final for 312 members"), rollover chip | "No draft — simulate to preview" |
| `/admin/charities`, `/admin/charities/new|[id]` | DataTable, form, ImageUploader, EventsEditor, featured toggle, soft-delete | "Add your first charity" |
| `/admin/winners` | DataTable by status, ProofViewer, Approve / Reject (reason) / Mark paid, Stepper | "Nothing to verify" |
| `/admin/reports` | Figures, charity totals table + bars, per-tier per-month stats, CSV | "Publish a draw to see statistics" |

---

## 6. Component library

Button (ink / saffron / ghost / danger-outline; sm md lg; loading dots; press `.97`) · Card (hairline, `surface`) · Rule (hairline + saffron dash) · Figure (large tabular number + label, optional Odometer) · ScoreRow (five numerals; states hollow / filled / matched / dimmed / drawn-ring) · Split + SplitSlider · Stepper (state machine) · Badge (one word, low-contrast in tables) · Chip (Verified, Rollover active) · DataTable (sortable, sticky, hover actions, mobile restack) · FormField (text / numeric / date / select / file-drop / slider; inline errors) · Modal / Sheet (bottom on mobile) · Inline confirmation (preferred over toast) · Toast (Sonner-style, bottom-right) · Banner · Skeleton · EmptyState · Nav / BottomNav / AdminSidebar (`layoutId` indicator) · Histogram45 · CharityCard · Photo (`next/image`, blur placeholder).

---

## 7. Micro-interactions

Hover: text links get a saffron underline (120ms); cards no lift — hairline darkens. Press `scale(.97)` 120ms. Focus: 2px saffron ring, 2px offset, `:focus-visible` only. Page transition: fade 200ms; no slide. List add/remove per §4.4. Validation on blur; on submit scroll to first invalid, message fades in beside the field. Modal `.95→1` 200ms, exit 150ms. Scroll reveals once at 20% visibility, 12px rise, 60ms stagger. Keyboard actions never animate. Hover effects gated by `@media (hover:hover) and (pointer:fine)`.

## 8. Mobile

Hero stacks: portrait full-width (4:5), headline, CTA. Subscribe pill fixed bottom-centre after hero. Members: BottomNav (Home · Scores · Draws · Charity · Winnings); avatar sheet for Subscription/Settings. Admin: top bar + drawer. ScoreRow wraps 3+2 at < 360px; add-score as bottom sheet. Draw Reveal: drawn tiles on top, user's row beneath; matches fill in place (no travel path). Tables → cards. Tap targets ≥ 44px, 16px gutters, `100dvh`, safe-area insets.

## 9. Accessibility & performance

`useMotionPref()`; reduced motion = final frames, keep opacity/colour, no confetti. Contrast: ink/bg 15.2:1; saffron-ink on saffron 8.1:1; `ink-2` on bg 6.3:1; dark saffron on `#131211` 7.4:1. Danger never colour-only. Skip link, focus trap/return, `aria-current`, `aria-live=polite` for results and confirmations. Labels visible; `aria-describedby` errors. LCP ≤ 2.0s: hero photo `priority` + `sizes`, AVIF/WebP, blur placeholder; fonts via `next/font` subset; `LazyMotion` + `domAnimation`; landing JS ≤ 120KB gz. ISR 60s on public pages; app pages with skeletons (CLS < .05). `data-theme` on `<html>`, no flash.

## 10. Never

Green as brand or accent · golf imagery/icons of any kind · dark navy + emerald + gold + glass · emoji · gradient text, blobs, glow · indigo/purple · "Play. Give. Win." verb lists · "Feel, not fairway" quoted anywhere · countdown clocks or fake scarcity · entry bundles or multipliers · USD or ₹150,000-style grouping · pity photography · looping confetti · horizontal-scroll tables · toast for every save · counters that can render "0" (server-render from the ledger).
