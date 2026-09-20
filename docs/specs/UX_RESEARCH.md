# Kindscore — UI/UX research (PRD §12)

Three research passes on 2026-09-20/21, each looking at live sites rather than theorising: (1) charity-impact and prize-draw-for-charity products, (2) motion-enhanced modern product craft + lottery reveal UX, (3) golf-site clichés, the 14 competing submissions, dashboard/admin references, Indian ₹ subscription patterns. Full source lists at the end.

---

## 0. The one-paragraph verdict

**Fourteen other submissions exist for this PRD and they have converged on the same look**: dark navy/obsidian + emerald + amber/gold + glassmorphism + Inter/system sans + a verb-list tagline ("Play. Give. Win.") + USD pricing. At least six say "glassmorphism" by name; four quote the PRD's own phrase "Feel, not fairway" back at the evaluator. Emerald-on-navy *is* golf green in dark mode. The research says the way to be different **on purpose** is: a light, warm-neutral canvas; one non-green accent used with restraint; a display typeface with a voice plus tabular numerals; **the five score numerals as the hero object**; ₹ with lakh formatting; a hero headline that names the charity outcome before the game; motion budgeted to 2–3 earned moments; and radical clarity about where the money goes.

---

## 1. What the field looks like (so we can be different deliberately)

### 1.1 The 14 competitors

| Submission | Look | Notable | Weakness |
|---|---|---|---|
| impact-golf-dev | Generic SaaS, emoji icons | Pricing "SAVE 17%" | No design; USD; charity is a bullet |
| manjot3093 | Near-black ink, ivory text, jade/coral/gold accents, Sora + DM Sans, glass | Most thought-through token system; 66 tests | Dark + glass = pack standard |
| tvenkat920 | Navy `#060913` + emerald `#10B981` + amber `#F59E0B`, frosted glass | 1-click role switcher for evaluators | Golf-green in dark mode; identical to five others |
| **WinForGood** | Black surfaces, red `#E11D48` + blue `#3B82F6`, system font | **Best landing IA of the set**: live jackpot + R1–R5 chips in hero, quantified cause cards, "Rollover Active" chip, "Cancel anytime · 10% charity floor" reassurance | Red/blue reads casino; USD; pricing hidden on /pricing; system font |
| Fairway Forward | shadcn defaults | Razorpay | Name is the cliché |
| ameen786 | Forest ink + amber + green | — | Green again; no demo |
| Sumitdevelops | Obsidian + teal + gold + coral, "Stripe/Linear-inspired" | Draw-pool snapshot card | Fintech framing over charity; USD $29 |
| DedSec2185 | Dark editorial, gold glows | OCR laser sweep, Monte Carlo simulator, UI sounds | Feature fireworks; gimmicky |
| anuragkashyap302 | **Ivory `#F3F1E8` + obsidian + pine + sage + gold; Playfair + Plus Jakarta** | The only light, serif-led, editorial entry | Pine + sage still golf-green |
| Jashraj21 | Dark glass; **£13/£130** | "The charity-first prize club"; Charity of the Month | "£0 raised" leaks on marketing page |
| others ×5 | Undocumented / dark | — | — |

**Zero** submissions use ₹499/₹4,999 with lakh formatting. **One** is light mode. **None** made the five numbers the visual identity (WinForGood shows R1–R5 chips but doesn't build on it).

### 1.2 The traditional golf website (what §12 forbids), concretely

From PGA Tour, DP World Tour, Delhi Golf Club, Wentworth, GolfNow, Topgolf, HowDidiDo, 18Birdies, Arccos, GolfPass:

- **Colour:** fairway/emerald primary; navy + gold "heritage"; sponsor palettes
- **Imagery:** golden-hour fairway hero, flag-in-hole, ball-on-tee, circular headshots, phone-mockup scorecards, clubhouse, plaid/argyle, mascots
- **Type:** ALL-CAPS "PLAY BETTER GOLF" bold sans, or conservative serif for "Est. 1930"
- **Layout:** 8–13-item megamenus, leaderboard tables as primary content, promo carousels, app-store badge rows, sponsor strips
- **Copy:** handicap bragging ("25% improvement"), exclusivity ("Live the Legacy"), forced puns ("Get your golf on")
- **Icons:** dimples, crossed clubs, flagsticks, tees

### 1.3 Golf brands that broke the mould (and how)

| Brand | Move | Lesson |
|---|---|---|
| Malbon | Cream base, navy/earth accents, poetic copy; golf only via vocabulary | Golf can be *implied* through words and objects, never scenery |
| Eastside Golf | Amber/fuchsia/cranberry; mission statement is the hero ("no one should have to choose between being themselves and playing the game they love") | Lead with a belief and belonging |
| Manors | Heritage tones used editorially; product names borrow golf vocabulary ("Stableford Trousers", "Free Mulligans") | Golf *terminology* as wit is fine; golf *pictures* are the cliché. "Stableford" can be a design word |
| Whim Golf | Black/white; turf as abstract material | Abstract the material (a single number) rather than depict the scene |
| Random Golf Club | "Golf is better, together"; "the best part isn't always the score" | De-emphasise score as rank — right for a game where score is a lottery number |
| Bogey Boys | A golf *failure* word reclaimed as identity | Self-deprecation about scores is warm; celebrate a 22 as much as a 40 |
| Sunday Golf | Matte black / heather / toasted almond + coral | Warm neutrals + one hot accent reads "lifestyle", not "club" |

Shared formula: neutral base (cream/ivory/black) + one or two non-green accents; editorial photos of people, never the course; golf vocabulary as language, not iconography; a belief in the hero position; nav under 6 items.

---

## 2. Emotion-driven, charity-led (§12 framing sentence)

From charity: water, GiveDirectly, Kiva, Comic Relief, Movember, Macmillan, Omaze, Postcode Lottery, Raffle House, give.do, CRY, Akshaya Patra, Goonj:

| Pattern | Seen at | Kindscore application |
|---|---|---|
| **One named face in the hero**, not a crowd or logo wall | GiveDirectly (Mercy Leonard + baby), charity: water ("Day One"), Kiva grid | The featured charity's one beneficiary, or one golfer + the charity they chose |
| **Money → human unit** | charity: water "$20 a month = six people, an entire family"; Akshaya Patra "5 billion meals"; Bombas one-for-one | "₹50 of your ₹499 = 5 meals at Akshaya-style charity". Each charity profile defines a unit |
| **Verb-led, first-person promises** | Macmillan "We're doing whatever it takes"; Postcode "Is your door in the draw?" | Relationship, not prospectus |
| **Proof as a feature** | charity: water "Give water. Get proof. Every single time."; give.do "Verified"; CRY GuideStar badge | Ledger-backed "₹X given" counters; "Verified charity" chip; 80G mention |
| **Warmth through voice, not pathos** | Comic Relief "serious good for serious reasons"; Movember "more fun means more funds" | Golfers are a social, banter-heavy audience. Light voice, serious money |
| **Documentary photography, dignity framing** | GiveDirectly, Goonj ("equal stakeholders") | Avoids CSR stock *and* poverty-porn |
| **The split, stated plainly** | Postcode Lottery "31% Trust · 40% prizes · 29% operating"; Gatherwell "60p in every £1" | "Of every ₹499: ₹50+ to your charity (you choose, up to ₹349), ₹150 to the prize pool, the rest runs Kindscore" — on the pricing card, always |
| **Published win-rate** | Postcode "25.80% of playing postcodes won a prize in August" | "Last month 47 of 312 members matched 3 or more" — beats odds jargon |
| **No bundles, no multipliers** | Omaze's £10=15 / £150=320 entry ladder is what critics call "gambling-like" | Kindscore's structural advantage: one fee, one entry, everyone equal, numbers earned on the course. Say it |
| **Dated urgency, never clocks** | Omaze "closes 23:59:59 on Sunday 27 July"; CRY "before 31 March" | "Next draw: 30 Sep". The only legitimate urgency is the rolling jackpot climbing |
| **Indian trust grammar** | give.do "Verified · Save tax · Cancel anytime"; live donor ticker; Ketto/Milaap "0% platform fee" | We can't claim 0% fee → counter with radical clarity. "Cancel anytime", 80G, UPI/Razorpay logos, "1,200+ golfers" not "1.2K users" |

Emotional register recommended by the charity research: **warm-premium** (charity: water / Postcode 2026 refresh axis, Movember's sociability). Bold-energetic = tombola/Dream Lottery = "gambling-like". Quiet-luxury = Omaze = only works for a £4m house and sidelines the charity.

---

## 3. Clean, modern, motion-enhanced (§12 FEEL + ANIMATIONS)

### 3.1 The 2026 vocabulary (Linear, Raycast, Stripe, Wise, Family, Mercury)

| Dimension | Now | Dated |
|---|---|---|
| Layout | One-dimensional scroll, left-aligned, ~96px section rhythm on 8px base; nav ≤ 6 items | Zig-zag alternating blocks; bento as a differentiator (it's standard now) |
| Depth | Hairline borders + 3–4-step surface ladder (Raycast: "no drop-shadow elevation at all"; Linear: "structure should be felt not seen") | Soft low-opacity shadows on everything; cards inside cards |
| Colour | ~98% achromatic, one rationed accent (~once per viewport — Wise lime, Raycast coral, Stripe indigo) | Indigo→purple gradients (Tailwind's `indigo-500` is "the loudest AI tell of 2026"); gradient text |
| Background | Warm near-neutrals (Linear moved warmer; Stripe cream `#f5e9d4`) | Glassmorphism (survives only in nav/modals), gradient blobs, WebGL showpieces |
| Type | One expressive display face used sparingly over a quiet workhorse; *chosen* Inter with custom axes is fine, *unchosen* Inter is the tell | Weightless "Build faster. Ship smarter." headlines |

### 3.2 Motion with numbers (Emil Kowalski's standards, Rauno Freiberg's guidelines, Family, Monzo)

| Rule | Numbers |
|---|---|
| UI transitions under 300ms; ≤200ms feels immediate | Button press 100–160ms; tooltip 125–200; dropdown 150–250; modal/drawer 200–500 |
| Never ease-in on UI; built-in CSS easings too weak | Enter/exit `cubic-bezier(0.23,1,0.32,1)`; on-screen moves `cubic-bezier(0.77,0,0.175,1)`; drawer `cubic-bezier(0.32,0.72,0,1)` |
| Springs only for "alive" or gesture-driven elements | `spring, duration 0.5, bounce 0.2`; keep bounce 0.1–0.3 |
| Scale proportional to trigger, never from 0 | Start `scale(0.9–0.97)` + `opacity 0`; dialogs from ~0.8 |
| Stagger is decorative | 30–80ms; never block interaction; cap ~8 items |
| Only animate `transform` + `opacity` | Never `transition: all` |
| What earns motion | State changes, enter/exit, spatial continuity. **Not** keyboard-initiated actions or things used 10× a day (Raycast has ~no animation, deliberately) |
| Calm via reduction | Linear's 2025 refresh removed things; added no animation |
| Reduced motion = fewer and gentler, not zero | Keep opacity/colour, drop transforms; gate hover with `@media (hover:hover) and (pointer:fine)` |
| Signature moments | Monzo: "if everything is a highlight, nothing is." Budget 2–3 per product: for Kindscore → jackpot odometer, draw reveal, score-saved |
| Perceived latency | Duolingo shows "Complete!" instantly while work finishes in background |

### 3.3 Draw-reveal pattern library (National Lottery, Yotta, Robinhood, Duolingo, Family)

Yotta (prize-linked savings — the closest analogue) *replaced* auto-playing animations with a **user-driven reveal**: "when users feel more ownership over the process of drawing… it's a stickier experience." The National Lottery app optimises for the *result* appearing instantly; the show is optional.

| # | Concept | Spec | Reads as |
|---|---|---|---|
| A | **Sequential roll-in + match lighting** | 5 tiles enter left→right, 80ms stagger, `scale .96→1 + opacity`, 240ms ease-out. 400ms after last, one pass over the user's scores: matches fill with accent (200ms) and get a hairline ring; non-matches dim to 40%. Result headline last | Modern product. Default for first view after publish |
| B | **Odometer digits per tile** | Digits roll (tabular nums, 350ms spring bounce 0.15), tiles resolve one at a time; never cross-fade values | Modern if ≤350ms/tile, no blur. Slot-machine if spin-up blur or >1s reels |
| C | **Tap-to-reveal (owned)** | Face-down tiles; tap or "Reveal all" with 120ms stagger; `rotateY` 300ms drawer easing; matches light on flip | Modern if flat, no gloss. Scratch-card shine = casino |
| D | **Result-first, reveal optional** | Headline renders instantly ("3 of 5 — you share the pool"), numbers visible; "Watch the draw" replays A. Confetti **once**, only for a 5-match, only for the winner | Most "product". Use on return visits |

Casino tells: chrome/gloss balls, rotating gold, motion-blur reels, coin sounds, red+gold, "JACKPOT" slab caps. Modern tells: flat tabular numerals, one accent, restraint on 0–2 matches (dim, not "sad"), celebration proportional to tier.

### 3.4 Micro-interaction catalogue

| Element | Behaviour | Ref |
|---|---|---|
| Buttons | Press `scale(.97)` 120ms; no hover weight change; disable after submit; label morph sharing letters ("Save" → "Saved") | Rauno; Family |
| Score input | `inputmode=numeric`, ≥16px (iOS zoom), tabular-nums, clamp 1–45, inline validation beside field (not toast) | Rauno; Family |
| Date field | Default today; if a score exists for the date, show it inline with Edit/Delete instead of an error | Rauno "feedback near its trigger" |
| 5-score list | New slides in at top (200ms); oldest fades at bottom when 6th added (opacity only, 150ms) | Rauno; Emil |
| Jackpot counter | Digits roll on change, 300–500ms spring bounce 0.2, `Intl.NumberFormat('en-IN')`; count-up on first view only | Motion AnimateNumber; Robinhood |
| Toasts | Bottom-right, slide+fade 200ms, stack, hover-expand, swipe-dismiss; prefer inline confirmation for saves | Sonner |
| Modals/drawers | From `scale .95` + opacity, 200–300ms; exit faster than enter | Emil |
| Page transitions | Fade only ≤200ms; directional slide only for tab order | Family |
| Empty states | Prompt creation inside the empty state ("Enter 5 scores to be eligible" + 5-slot progress row) | Rauno |
| Optimistic UI | Save locally, roll back with feedback | Rauno |
| Sound/haptics | Off by default; user toggle | Duolingo; Monzo |

---

## 4. Homepage & CTA (§12 HOMEPAGE + CTA)

### 4.1 Homepage order (from Kiva's numbered steps, GiveDirectly's form-under-hero, Comic Relief's stat slider, WinForGood's IA)

1. **Hero** — cause + prize at equal weight (Omaze couplet), the five numerals as the object, one primary CTA + one soft secondary, reassurance line
2. **Three server-rendered counters** — given to charities · paid to winners · current jackpot (Pencils of Promise's counters rendered "0" — server-render)
3. **How it works** — numbered steps with a *named* golfer ("Priya's 28 33 31 36 29 → 3 matches → ₹2,500") — Kiva's pattern
4. **Charity spotlight** — one face, one unit, "Verified"
5. **Jackpot + next draw date** — the loop diagram (Kiva's "multiply your impact" cycle); rollover *is* a loop
6. **Pricing** — split stated plainly, monthly + yearly
7. **Subscribe**

### 4.2 CTA formula (Postcode, give.do, CRY, cult.fit, Swiggy One, Jupiter, Fi, Zerodha, Groww)

| Element | Do | Don't |
|---|---|---|
| Copy | **Verb + beneficiary**: "Subscribe & fund [charity]"; outcome couplet "Win the draw / Fund a cause" | "Get Started", "Create Account" (weakest in the field), "Enter Now" (gambling verb) |
| Pair | One primary "Subscribe · ₹499/mo" + one soft "See how the draw works" | Three equal buttons |
| Reassurance line under button | "Cancel anytime · at least ₹50 to your charity · secured by Stripe" | Small-print clauses |
| Price framing | ₹499/month; ₹4,999/year with **"₹417/mo · 2 months free"** underneath (cult.fit pattern; a free-month frame beats "17% off" in every Indian D2C example) | "SAVE 17%" |
| Tax | "incl. GST" or "+18% GST" named (Groww) | Silent |
| Numbers | Lakh formatting ₹1,50,000; "1,200+ golfers" | ₹150,000; "1.2K users" |
| Urgency | Dated: "Next draw 30 Sep"; the jackpot climbing | Countdown clocks, flash anchors (Zomato ₹9), "47 left" |
| Placement | Sticky on mobile (bottom-centre pill once hero scrolls off); persistent top-right on desktop | Interstitials, exit-intent |
| Post-subscribe | Immediately: "₹50 of your ₹499 went to [charity] this month" (Swiggy "you saved ₹X", inverted to giving) | Silent success |
| Exclusivity | — | CRED-style "not everyone gets it" conflicts with charity |

---

## 5. Dashboard & admin (Stripe dashboard, Geist, Linear, Attio, Mercury, Ramp, Tremor, shadcn)

- **Colour only for status** (Stripe): green succeeded, red failed, amber pending; hierarchy via weight/size. Status is the only coloured thing in a row.
- **Badges**: one word, title case, low-contrast variant in dense tables (Geist). No redundant checkmarks.
- **Home = five numbers with trend**, not a chart wall (Stripe). Member "Total won" as one large calm figure (Mercury).
- **Tables**: tabular numerals, right-aligned money, ~40–44px rows, sticky header, single subtle sort chevron, filter chips above, hover-revealed row actions, real empty states, dimension-matched skeletons.
- **State machines** (winner: Awaiting proof → Submitted → Approved → Paid / Rejected; draw: Draft → Simulated → Published): horizontal **stepper** on detail (filled = done, ring = current, hollow = future) + one-word badge in lists + timestamp/actor line ("Approved by Admin · 14 Sep, 18:02"). Same component for both so the mental model transfers.
- **Human-in-the-loop made visible** (Ramp): Simulate → Publish and Approve → Paid confirmations restate consequences ("Publishing makes these 5 numbers final and notifies 312 members").
- **Rollover as a visible state** on the draw card ("Rollover active · ₹1,20,000 carried") — the one competitor idea (WinForGood) worth borrowing.
- Tremor's **Tracker** (row of coloured ticks) fits "draws entered" history.

---

## 6. §12 line-by-line → references → design answer

| §12 line | References | Design answer |
|---|---|---|
| "must not resemble a traditional golf website" | §1.2 catalogue; The Golf Lottery UK (negative); Malbon/Manors/Eastside (positive) | Light warm canvas, no green anywhere, no course/flag/ball/club imagery, nav ≤ 6, golf only as *vocabulary* ("Stableford", "round") |
| "emotion-driven — leading with charitable impact, not sport" | charity: water, GiveDirectly, Omaze couplet, Movember voice | Hero = cause + prize at equal weight; one named face in the charity section; money → human unit; warm-premium register with a light voice |
| FEEL "clean, modern, motion-enhanced" | Linear refresh, Raycast DESIGN.md, Wise, Family | Hairline borders, surface ladder, one accent once per viewport, 96px rhythm, chosen display face + tabular numerals; motion budgeted to 3 signature moments |
| AVOID "fairways, plaid, club imagery as primary design language" | Whim (abstract the material), Postcode's abstract mark, charity: water's jerry-can | Pick a non-golf brand object: **the five numerals / the ticket / the split**. Score digits are the graphic |
| HOMEPAGE "what the user does, how they win, charity impact, CTA" | Kiva steps, GiveDirectly form-under-hero, Comic Relief stats, WinForGood IA | Order in §4.1; all four answered in the first viewport by the hero + live strip |
| ANIMATIONS "subtle transitions and micro-interactions throughout" | Emil/Rauno standards, Sonner, Yotta owned reveal, Robinhood digits | §3.2 numbers; §3.4 catalogue; draw reveal per §3.3 (A first view, D on return; confetti once, jackpot only) |
| CTA "prominent and persuasive" | Postcode single price, give.do reassurance, cult.fit effective-monthly | §4.2 formula: verb + beneficiary, one primary + one soft, reassurance line, sticky on mobile, "2 months free", incl. GST |
| (§16) "responsive on mobile and desktop" | Family, Cal.com | Mobile-first components; bottom-centre CTA pill; member BottomNav; tables restack to cards |

---

## 7. Three directions

All three obey the research: light or ink canvas, no green, one accent, display face + tabular numerals, five numerals as the object, ₹ lakh formatting, motion budget. They differ in *temperature* and *how much "game" is in the visual identity*.

### Direction A — "The Ticket" (warm paper · one hot accent · the punch)
Cream paper `#F6F1E8`, ink `#16130F`, one accent in the **marigold/coral** family (warm, festive-generous in an Indian context; explicitly *not* casino red or lottery gold). Display: **Fraunces** (soft, wonky optical axis on H1 only) — or a humanist grotesk if the serif feels too editorial. Body: **Instrument Sans**, tabular numerals. Motif: a five-slot paper ticket; a match **punches a hole** (the accent shows through). Logomark `○ ○ ● ● ●` encodes "match 3, 4 or 5." The Split bar: accent = charity slice, so "the coloured part is the part that goes to charity" is literally true. Charity section gets the only big photograph — documentary, one face. Voice: Movember-light. Register: warm-premium.
*Strengths:* teaches the game visually before a word is read; unique in the field; every research thread points here. *Risk:* "funfair" can tip into playful if the accent is too loud — keep it to once per viewport.

### Direction B — "Editorial Impact" (magazine · serif · the face)
Ivory canvas, ink text, **saffron** accent used almost only in type and rules. Display: an editorial serif (Newsreader / Instrument Serif) at large sizes with the five numerals set like a magazine pull-quote; body Geist or Inter with chosen axes. Hero leads with a documentary portrait of a beneficiary and a one-line outcome ("Your last five rounds could fund a classroom"); the numbers sit beneath. Closest to charity: water × Manors × anuragkashyap302's direction done properly. The draw reveal is result-first (§3.3 D) with tile roll-in as the optional show.
*Strengths:* strongest emotional lead, most "not a golf site", reads premium. *Risk:* the game recedes; "how you win" needs more copy to land; photography quality becomes load-bearing (we're on placeholders).

### Direction C — "Ink & Signal" (monochrome · one electric accent · product-grade)
Near-white `#FAFAF7` and near-black, everything achromatic except one **electric accent** (a lime or a cobalt — Wise/Raycast discipline) that appears exactly once per viewport, on the thing that matters (the jackpot, the match, the button). Type: Inter Display / Geist with tight tracking, big tabular numerals as the only decoration. Hairline borders, no shadows, no texture. Motion is the personality: odometer, tile roll-in, layout springs. Closest to Linear/Whim/Random Golf Club.
*Strengths:* most "clean, modern, motion-enhanced" by the letter; the admin panel would be immaculate. *Risk:* cool and product-y; "emotion-driven, leading with charitable impact" has to come entirely from copy and photography; least differentiated from the fintech monoculture the research warns about.

### Recommendation
**A, tuned by the research**: keep the ticket + punch + split (the only motif no competitor and no golf site owns), shift the accent from "Raffle Red" to a **marigold-coral** so it reads generous rather than casino, lead the hero with the cause/prize couplet and the five numerals, give the charity section the one documentary face, and hold the motion to three signature moments with §3.2's numbers. Take B's hero copy discipline and C's admin restraint (colour only for status, one-word badges, stepper state machines).

---

## Sources

**Charity / prize-draw:** omaze.com · postcodelottery.co.uk (via press/excerpts) · rafflehouse.com (excerpts) · givedirectly.org · kiva.org · charitywater.org (+ /100-percent-model) · comicrelief.com · movember.com · macmillan.org.uk · pencilsofpromise.org · toms.com/impact · bombas.com/giving-back · give.do · cry.org · akshayapatra.org · goonj.org · milaap.org · ketto.org · marketingweek.com/postcode-lottery-brand-refresh · prizedrawsdaily.co.uk/operators/omaze · grailcomps.com/guides/raffle-house-review · onelottery.co.uk · dreamitwinit.ca · creativereview.co.uk/tombola-ad-meanwhile
**Motion / modern craft:** emilkowal.ski/ui/great-animations · github.com/emilkowalski/skills (STANDARDS.md) · interfaces.rauno.me · linear.app/now/behind-the-latest-design-refresh · linear.app/now/how-we-redesigned-the-linear-ui · github.com/VoltAgent/awesome-design-md (Raycast DESIGN.md) · shadcn.io/design/stripe · styles.refero.design (Wise, Linear) · wise.com/gb/blog/a-brand-for-everywhere · benji.org/family-values · 60fps.design (Family, Duolingo) · monzo.com/blog/2022/11/04/how-we-design-magic-moments-at-monzo · webuild.io/case-studies/yotta · help.withyotta.com (daily drawings) · apps.apple.com National Lottery Results · matt-croak.medium.com (Robinhood digits) · github.com/robinhood/ticker · motion.dev/docs/react-animate-number · sonner.emilkowal.ski · vercel.com/geist · themasterly.com/blog/fintech-design-guide · studiomeyer.io 2026 reality check · 925studios.co/blog/ai-slop-design-tells · dev.to indigo-500 / purple-gradient-problem
**Golf / competitors / admin / CTA:** pgatour.com · europeantour.com · delhigolfclub.org · wentworthclub.com · golfnow.com · topgolf.com · howdidido.com · 18birdies.com · arccosgolf.com · golfpass.com · malbon.com · eastsidegolf.com · manorsgolf.com · whimgolf.com · randomgolfclub.com · bogeyboys.com · sundaygolf.com · hypebeast.com (golf streetwear) · 14 competitor repos + live demos (impact-golf-dev, manjot3093, tvenkat920, WinForGood, Fairway Forward, ameen786, sanjayvarma2001, Sumitdevelops, DedSec2185, anuragkashyap302, Jashraj21, shadmasimran, Vishesh-io, Manikandan180804, karthik-0004, vishwas1116, Tulsi-gohil) · ui.shadcn.com/examples/dashboard · tremor.so · vercel.com/geist/badge · linear.app · attio.com · mercury.com · ramp.com · plausible.io · cal.com · 925studios.co Stripe dashboard breakdown · stripe.com/blog/accessible-color-systems · zerodha.com/charges · groww.in/pricing · cult.fit/cult/cultpass · jupiter.money · fi.money · cred.club · razorpay.com/pricing · Swiggy One / Zomato Gold coverage (desidime, paisawapas)
