# How Kindscore works — the whole game, in plain words

Kindscore is a **charity lottery for golfers**. In a normal lottery you buy a ticket with numbers on it, once a month numbers are drawn, and if yours match you win money from the pot everyone paid into. Kindscore is that, with one twist: **you never pick numbers — your golf scores are your numbers.**

Every rule below cites the PRD section it comes from (`docs/PRD.md`). Rules marked **[decision]** are places the PRD was silent and we chose an interpretation.

---

## 1. Subscribing — where the money comes from (§04, §07, §08)

A user subscribes for **₹499/month** or **₹4,999/year** (yearly ≈ two months free). Each payment is split three ways:

| Slice      | Where it goes                              | Rule                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charity    | The charity the user picked at signup      | At least **10%**. The user can raise this (§08.1 "users may voluntarily increase their charity percentage"). **[decision]** The ceiling is **70%** — because the prize pool always takes its fixed 30% first, 70% is the most that can go to charity; at 70% Kindscore keeps nothing. |
| Prize pool | The monthly pot that winners are paid from | A **fixed share** of every subscription (§07). PRD gives no number → **[decision]** 30%, kept as a single config constant. Taken off the top, before the charity slice is applied.                                                                                                    |
| Platform   | Kindscore's revenue                        | Whatever is left.                                                                                                                                                                                                                                                                     |

Users can also make a **one-off donation** to any charity at any time, unrelated to the game (§08.1). **[decision]** Donations need an account (signup is free) so every rupee in the ledger belongs to a member and "you have given ₹X" is honest; the minimum is ₹10, whole rupees, capped at ₹1,00,000 per transaction as a sanity limit. **[decision]** Exactly one charity is the homepage spotlight; featuring another un-features the last. **[decision]** Charities are never hard-deleted — "Hide" removes one from the directory and signup while existing supporters keep contributing until they change, and the admin sees how many that is before hiding.

Only users with an **active** subscription can use the app's features and enter draws. Subscriptions can renew, be cancelled, or lapse (payment failed / expired) — a lapsed user drops back to restricted access (§04). The app checks subscription status on **every** request from a logged-in user, not just at login. **[decision]** Lapsed and ended subscriptions stay visible: the app reads a member's latest subscription whatever its status, so "your subscription has lapsed" is shown rather than "never subscribed". **[decision]** Subscribing is two steps — account and charity first, plan and Stripe payment second. Someone who stops between the two is a registered non-subscriber with restricted access: they can browse, change their charity, pick a plan later and claim a prize won while active, but cannot log scores or enter a draw.

**[decision]** "Restricted access" means a _locked shell_, not a lockout: a member without an active subscription still sees the app, their charity and the jackpot, with score entry and draw participation dimmed behind one "Subscribe to unlock" button. **[decision]** Signup is one page — name, email, password, charity, percentage — and plan/payment come _after_ the account exists, so an abandoned checkout still leaves a member and the split is seen before money is asked for.

How the lifecycle plays out **[decision]**:

- **Cancelling keeps access until the paid period ends.** The member stays in that month's draw, the row then becomes _cancelled_, and they can change their mind (Resume) any time before the date. Nothing is refunded mid-period — the PRD says only "cancellation", and this is the standard reading.
- **A failed renewal restricts immediately.** The PRD asks for a _real-time_ check, and a bounced payment is exactly the moment it should bite. The banner links straight to Stripe's card-update page; Stripe's own retries reinstate the member on success with no action from us.
- **The charity share is frozen per payment.** Changing charity or percentage applies to the _next_ invoice; every past contribution stays with the charity that received it.
- **No trials, coupons or proration.** One fee, one entry, everyone equal.
- **Payments are Stripe test mode on a US-registered sandbox account.** Stripe India is invite-only for new accounts; test mode needs no activation and supports INR, so the ₹499 / ₹4,999 prices, the Indian billing address and the Indian test cards all work unchanged.

---

## 2. Entering scores — how you get your numbers (§05)

After each round, the user logs their **Stableford score**: a number from **1 to 45**, with the date they played.

Rules:

- The system keeps only the user's **latest 5 scores** — latest by the _date played_, not by when it was typed in. Entering a 6th automatically drops the oldest-dated one.
- **One score per date.** If a score already exists for that date, the user can edit or delete it, but not add a second.
- Scores are shown newest first.
- **[decision]** A score dated _earlier_ than all five kept scores is rejected with a message ("older than your five kept rounds") rather than silently added and immediately dropped.
- **[decision]** Dates are calendar dates in India (Asia/Kolkata). A round logged at 00:30 on 13 Sep is 13 Sep, whatever the server's clock says.
- **[decision]** Future dates are refused — a round can't have been played tomorrow.
- **[decision]** Deleting a round is allowed and immediate (§05: "an existing entry may only be edited or deleted"). Dropping to four rounds makes the member ineligible for the next draw, and the page says so.
- **[decision]** Editing a kept round to any past date is allowed — it stays one of your five; the "older than your five" rule exists to refuse a sixth round that would be evicted on arrival. **[decision]** Editing a round to a date another kept round already has is refused the same way as adding one — one score per date holds across edits too.

Example — Priya's current 5 scores: **28, 33, 31, 36, 29**

---

## 3. The draw — picking the winning numbers (§06)

Once a month, the admin runs the draw. The system picks **5 different numbers between 1 and 45** — like a lottery machine pulling 5 balls from 45. **[decision]** The PRD never says what "numbers" are matched; since scores are 1–45 and exactly 5 are kept, the only reading where every sentence fits is: drawn numbers are compared to the user's 5 scores.

The admin chooses **one of two ways** to pick the numbers:

### Random (§06 "standard lottery-style")

Every number from 1 to 45 has an equal chance. Pure luck.

### Algorithmic (§06 "weighted by score frequency")

The system first looks at what scores subscribers are _actually_ getting right now. Most golfers score 25–40; almost nobody scores 3 or 45. Numbers that many people have scored are made **more likely** to be drawn; rare numbers less likely. The result is more winners and more excitement — a lever the admin can pull.

Exactly how, in three steps:

1. **Count** — for each number 1–45, how many eligible users have it among their five scores (a repeated score counts once per user).
2. **Smooth** — blend each number's count with its neighbours: `¼·count(n−2) + ½·count(n−1) + count(n) + ½·count(n+1) + ¼·count(n+2)`. **[decision]** The PRD says only "weighted by score frequency"; with a few hundred users the raw tally is noisy (31 might have 9 holders while 30 and 32 have 40 each), and smoothing makes the draw follow the _shape_ of how golfers score rather than one month's sampling accidents.
3. **Floor** — weight = 1 + smoothed count. **[decision]** Every number keeps a small baseline chance so nothing is ever impossible to draw; the PRD never says a never-scored number should be excluded.

Then five numbers are drawn one at a time in proportion to their weights, each drawn number removed before the next pick. Random mode is the same machine with every weight set to 1.

Say this month's draw picks: **33, 12, 29, 36, 41**

---

**[decision]** The admin sets a **weighting strength** (0–100%) for algorithmic mode when simulating (§11 "configure draw logic"): the weight of each number is the baseline plus strength × its smoothed frequency, so 0% is flat like random and 100% follows what members score in full. The strength is saved with the simulation and shown on the published result.

## 4. Matching — who won (§06, §07)

Each subscriber's 5 scores are compared against the 5 drawn numbers. What matters is **how many of your scores appear in the drawn numbers**:

| Priya's scores                 | Drawn              | Matches | Result                    |
| ------------------------------ | ------------------ | ------- | ------------------------- |
| 28, **33**, 31, **36**, **29** | 33, 12, 29, 36, 41 | 3       | **3-number match** — wins |

| Raj's scores           | Drawn              | Matches | Result                       |
| ---------------------- | ------------------ | ------- | ---------------------------- |
| **33, 12, 29, 36, 41** | 33, 12, 29, 36, 41 | 5       | **5-number match** — jackpot |

| Anita's scores     | Drawn              | Matches | Result  |
| ------------------ | ------------------ | ------- | ------- |
| 20, 22, 25, 27, 30 | 33, 12, 29, 36, 41 | 0       | nothing |

There are three winning levels: **5 matches, 4 matches, 3 matches**. Two or fewer wins nothing.

Two edge rules **[decision]**:

- A user with **fewer than 5 scores** isn't in that month's draw (their dashboard says "enter 5 scores to be eligible").
- A **repeated score** counts once. `33, 33, 28, 36, 29` only has four different numbers, so the most it can match is 4.

---

## 5. The prize pool — how much winners get (§07)

The pool is the sum of everyone's prize-pool slice this month. With 1,000 active subscribers at ₹499 and a 30% pool share, that's about **₹1,50,000**. (With 300 subscribers it's about ₹45,000 — the size our demo data uses.)

**[decision]** The pool is sized from the **active subscriber count at draw time** (§07 "auto-calculation of each pool tier based on active subscriber count"): each active monthly subscriber contributes ₹149.70 (30% of ₹499); each active yearly subscriber contributes ₹124.97 (30% of ₹4,999 ÷ 12). A yearly payer's money is spread across twelve draws rather than landing in one.

The PRD fixes how the pool is divided across the three winning levels:

| Match level                 | Share of pool | This month's example |
| --------------------------- | ------------- | -------------------- |
| 5 numbers (**the jackpot**) | 40%           | ₹60,000              |
| 4 numbers                   | 35%           | ₹52,500              |
| 3 numbers                   | 25%           | ₹37,500              |

Within a level, **everyone who won splits it equally**. If 15 people got 3 matches, each gets ₹37,500 ÷ 15 = ₹2,500. If Raj is the only 5-match, he gets the full ₹60,000.

Money is calculated in whole paise so splits always add up exactly.

---

## 6. Jackpot rollover — why the pot grows (§06, §07)

"Jackpot" is just the name for the 5-match prize — the biggest and hardest to win. Most months **nobody** matches all 5. When that happens, the PRD says the jackpot money **rolls over**: it is carried forward and added to _next_ month's 5-match prize.

| Month | 5-match pool                    | Won? | Carried to next month |
| ----- | ------------------------------- | ---- | --------------------- |
| Jan   | ₹60,000                         | No   | ₹60,000               |
| Feb   | ₹60,000 + ₹60,000 = ₹1,20,000   | No   | ₹1,20,000             |
| Mar   | ₹60,000 + ₹1,20,000 = ₹1,80,000 | Yes  | ₹0                    |

It keeps growing until someone wins it. This is the engagement hook — a jackpot counter that visibly climbs. The 4-match and 3-match prizes **do not** roll over; if nobody wins one, it simply isn't paid that month (**[decision]** retained by the platform and shown in admin reports). **[decision]** Rollover is decided by the draw, not by verification: the jackpot carries only when nobody matched five. If a five-match winner is later rejected or never claims, that prize is retained like an unclaimed lower tier — the ladder never re-rolls money that was announced as won. **[decision]** A draw can be opened only once its month has begun (calendar time, not just order), so two months can never be drawn in one.

---

## 7. Simulate, then publish — the admin's control (§06, §11)

The draw is a two-step process so the admin never publishes something unseen:

1. **Simulate** — admin picks the mode (random / algorithmic) and clicks Simulate. The system generates the 5 numbers, works out every winner and every prize amount, and **saves all of it as a draft**. The admin sees the full result. Users see nothing yet. The admin can re-simulate for a fresh set of numbers, which overwrites the draft.
2. **Publish** — admin clicks Publish. The saved draft becomes official: it appears on every user's dashboard, winners are notified, and the rollover (if any) is carried into next month.

Nothing is re-rolled at publish. What the admin previewed is exactly what goes out.

Two safeguards **[decision]**:

- When the admin simulates, the system takes a **snapshot** of every eligible user's five scores at that moment and stores it with the draw. The published result always refers to the snapshot, so later score edits can never change history.
- If any eligible user's scores change _between_ simulate and publish, the draft is marked **stale** and Publish is disabled until the admin re-simulates. The admin never publishes a result that no longer matches what members have. **[decision]** Staleness is checked twice — when the admin opens the draft and again inside Publish — so two tabs or a slow click can never publish a stale result.

More rules the draw follows **[decision]**:

- **Who funds vs who can win.** Every _active_ subscriber funds the month's pool (they paid); only those with exactly five scores are _in_ the draw. The admin's page shows both numbers.
- **Tier winner counts are public; identities are not.** A member sees "you share ₹3,013 with 7 other members"; a visitor sees "8 winners"; only the admin sees who.
- **Draws run in calendar order.** The next draw is always the month after the last published one (or the current month for the very first), so months can't be skipped or duplicated by accident.
- **The jackpot shown before a draw is an estimate** — 40% of the pool the current active subscribers would fund, plus the carried rollover — and is labelled as such. The published draw's figure is the truth.

---

## 8. Winner verification and payout (§09)

Because real money is involved, a winner must prove their scores were genuine:

1. The winner uploads a **screenshot of their scores from their golf platform** (the app/club system where the round was recorded).
2. The admin reviews it and clicks **Approve** or **Reject**.
3. An approved win has a payout status of **Pending** until the winner **claims** it. The claim credits the prize to the winner's Kindscore billing account through Stripe — applied automatically to their next renewals — and the win becomes **Paid**, with Stripe's transaction id as the record. The admin does nothing after approving.

Only winners go through this — ordinary subscribers never have to upload anything.

The rules around it **[decision]**:

- **"Total won" means approved.** A prize counts towards a member's total once the admin has approved the proof; before that the dashboard says "awaiting your proof" or "under review". Paid and awaiting-payout amounts are shown separately (§10).
- **One resubmission after a rejection.** A rejected winner may upload a second screenshot; a second rejection closes the claim and says so.
- **A rejection needs a reason** (up to 200 characters) and the member reads it verbatim.
- **Proof images are private** to the winner and the admins — served through ten-minute signed links, stored under a path built from ids, never from the file name. Nothing is ever public.
- **A lapsed subscriber can still claim a prize they won while active.** The win happened; the subscription gate is for playing, not for being paid.
- **[decision]** The winner claims the payout themselves and it is paid as subscription credit through Stripe, verified by Stripe's transaction id — no human marks anything paid. Stripe cannot send cash to an Indian individual from this platform (Connect cross-border payouts exclude India; Global Payouts needs Treasury), and a credit against future renewals is the one payout the customer we already hold can receive instantly. A cash rail (RazorpayX, Stripe Connect) is another implementation of the same `PayoutGateway`.
- **[decision]** A member who never checked out (a seeded demo account) gets a Stripe customer created at claim time, so the credit is real and waits for their first invoice.

---

## 9. What each person sees

### Subscriber dashboard (§10)

- Subscription: active / inactive, next renewal date
- Their 5 scores, with entry and edit
- Their charity and contribution percentage. **[decision]** Rupee figures appear only for money actually being paid — an active member sees the split of their own ₹499 or ₹4,999 payment; a non-subscriber sees their percentage and what it will fund once they subscribe.
- Draws entered, next draw date
- Total won and current payout status

### Admin dashboard (§11)

- **Users** — view/edit profiles, edit scores, manage subscriptions. **[decision]** Admin-granted subscriptions are marked `admin` and never touch Stripe (support and demos). **[decision]** Every admin edit of member data — profile, scores, subscription — is audited with who, what, before and after. **[decision]** Admins edit scores under the same rules as members (five kept by date, one per date, 1–45). **[decision]** Ending a subscription takes effect on the member's next request, because the gate reads the database every time — nothing is cached per session.
- **Draws** — choose mode, simulate, publish
- **Charities** — add/edit/delete, manage images and events
- **Winners** — full list, verify proofs, watch payouts land (winners claim their own; an admin can record one settled outside Stripe)
- **Reports** — total users, total prize pool, charity totals, draw statistics
- **[decision]** An admin who logs in lands in the admin panel, and the member area shows an **Admin** tab — the two roles are one account with two front doors.

### Public visitor (§03)

- Landing page: what you do, how you win, the charity impact, and a prominent Subscribe button
- Charity directory with search/filter, charity profile pages, featured charity spotlight
- How the draw works
- Published results — the five numbers, winner counts per tier and the rollover for every month. **[decision]** The PRD never says results are public, but a lottery whose outcomes are visible only to entrants is not credible; counts are public, identities never.

## 10. The demo world (seed)

The evaluators meet Kindscore already running: 300-odd members, three published months and September waiting to be drawn. **[decision]** Demo history is generated, not typed — the seed signs in as the admin and runs the real draw and verification services with a steered random source, so every figure on every page (pool, rollover ladder, charity totals, winners) is internally consistent and September is untouched for the evaluator to draw. **[decision]** Seeded subscriptions are marked `seed` and never touch Stripe; the evaluator's own signup on the live site is the proof that Stripe works. **[decision]** Demo accounts live at `@kindscore.app` and never receive mail (Supabase Auth refuses reserved TLDs such as `.test`; confirmation is off).

---

## One-page summary

**Subscribe → your fee funds a charity + the prize pool → log your last 5 golf scores → monthly, 5 numbers are drawn → match 3, 4, or 5 of them to win a share of the pool → the unclaimed jackpot rolls over and grows → winners prove their scores → get paid.**
