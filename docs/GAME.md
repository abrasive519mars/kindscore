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

Users can also make a **one-off donation** to any charity at any time, unrelated to the game (§08.1).

Only users with an **active** subscription can use the app's features and enter draws. Subscriptions can renew, be cancelled, or lapse (payment failed / expired) — a lapsed user drops back to restricted access (§04). The app checks subscription status on **every** request from a logged-in user, not just at login.

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
- **[decision]** Editing a round to a date another kept round already has is refused the same way as adding one — one score per date holds across edits too.

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

It keeps growing until someone wins it. This is the engagement hook — a jackpot counter that visibly climbs. The 4-match and 3-match prizes **do not** roll over; if nobody wins one, it simply isn't paid that month (**[decision]** retained by the platform and shown in admin reports).

---

## 7. Simulate, then publish — the admin's control (§06, §11)

The draw is a two-step process so the admin never publishes something unseen:

1. **Simulate** — admin picks the mode (random / algorithmic) and clicks Simulate. The system generates the 5 numbers, works out every winner and every prize amount, and **saves all of it as a draft**. The admin sees the full result. Users see nothing yet. The admin can re-simulate for a fresh set of numbers, which overwrites the draft.
2. **Publish** — admin clicks Publish. The saved draft becomes official: it appears on every user's dashboard, winners are notified, and the rollover (if any) is carried into next month.

Nothing is re-rolled at publish. What the admin previewed is exactly what goes out.

Two safeguards **[decision]**:

- When the admin simulates, the system takes a **snapshot** of every eligible user's five scores at that moment and stores it with the draw. The published result always refers to the snapshot, so later score edits can never change history.
- If any eligible user's scores change _between_ simulate and publish, the draft is marked **stale** and Publish is disabled until the admin re-simulates. The admin never publishes a result that no longer matches what members have.

---

## 8. Winner verification and payout (§09)

Because real money is involved, a winner must prove their scores were genuine:

1. The winner uploads a **screenshot of their scores from their golf platform** (the app/club system where the round was recorded).
2. The admin reviews it and clicks **Approve** or **Reject**.
3. An approved win has a payout status of **Pending**. When the admin has sent the money, they mark it **Paid**.

Only winners go through this — ordinary subscribers never have to upload anything.

---

## 9. What each person sees

### Subscriber dashboard (§10)

- Subscription: active / inactive, next renewal date
- Their 5 scores, with entry and edit
- Their charity and contribution percentage
- Draws entered, next draw date
- Total won and current payout status

### Admin dashboard (§11)

- **Users** — view/edit profiles, edit scores, manage subscriptions
- **Draws** — choose mode, simulate, publish
- **Charities** — add/edit/delete, manage images and events
- **Winners** — full list, verify proofs, mark paid
- **Reports** — total users, total prize pool, charity totals, draw statistics

### Public visitor (§03)

- Landing page: what you do, how you win, the charity impact, and a prominent Subscribe button
- Charity directory with search/filter, charity profile pages, featured charity spotlight
- How the draw works

---

## One-page summary

**Subscribe → your fee funds a charity + the prize pool → log your last 5 golf scores → monthly, 5 numbers are drawn → match 3, 4, or 5 of them to win a share of the pool → the unclaimed jackpot rolls over and grows → winners prove their scores → get paid.**
