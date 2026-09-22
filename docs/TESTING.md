# Testing Kindscore

Ten minutes, in the order of PRD §16.1. The site is live and seeded — nothing to set up. If a step doesn't match what you see, that's a bug; note the step number.

**Site:** `<LIVE_URL>` · **Password for every account below:** `Kindscore!2026` · **Test card:** `4242 4242 4242 4242`, any future date, any CVC (Stripe test mode — no real money)

## Accounts

| Log in as             | Who they are                                              | Use in steps |
| --------------------- | --------------------------------------------------------- | ------------ |
| `admin@kindscore.app` | The administrator                                         | 5, 6, 9, 11  |
| `priya@kindscore.app` | Active member · won 3 matches in August, proof not yet up | 4, 7, 8, 9   |
| `raj@kindscore.app`   | Active member with only three scores                      | 3            |
| `anita@kindscore.app` | Lapsed member · one June win already paid                 | 10           |
| _your own signup_     | The only real Stripe checkout                             | 1, 2         |

## The steps

1. **Sign up** — Home → **Subscribe & fund a cause** → fill the form, pick a charity, slide the share to 25% → **Create account**.
   _You land on step 2 of 2 with two plans (Monthly ₹499 · Yearly ₹4,999). Open **Home** first if you like: a banner says you're not subscribed and the scores card is locked._
2. **Subscribe** — **Subscribe monthly** → Stripe: card `4242 4242 4242 4242`, `12/34`, `123`, India, any address.
   _Back on Kindscore: "Payment received", status **Active · Renews … · monthly**. Try **Cancel** then **Resume** if you like._
3. **Scores** — **Scores** → add five rounds on different dates. Then a sixth on a newer date. Then a date you already used. Then `46`, then a future date.
   _Newest first. The sixth says which round it replaced and the oldest is gone. The duplicate is refused with an **Edit that round** link. 46 and the future date are refused inline. Home now says **Eligible**. Log in as `raj@` and Home says "Enter 2 more rounds"._
4. **Dashboard** — as `priya@`: **Home**.
   _Every §10 module is live: Active · yearly · renews 2027; scores `28 33 31 36 29`; Udaan Girls' Sports Collective at 15% with the rupee split of her ₹4,999; 3 draws entered; the September jackpot; Total won ₹0 with "1 win awaiting verification"; August's numbers with her three matches highlighted and a **Claim your prize** link._
5. **Simulate** — as `admin@` (login lands on the admin): **Draws** → **Open September's draw** → pick **Weighted by scores**, drag **Weighting strength** and watch the bars move → **Simulate the draw** → **Re-simulate with fresh numbers**.
   _A draft report: five numbers, pool ≈ ₹43,800 from 302 subscribers, jackpot **+ ₹52,591 rolled in** from August, winners by tier. Random mode shows flat bars; weighted mode the score distribution. Nobody sees a simulation._
6. **Publish** — (optional first: in **Users** change any member's score, come back — "Scores changed since this simulation" and Publish is disabled until you re-simulate) → **Publish this draw** → **Confirm — publish**.
   _Status **Published**, the report is read-only, **Draws** lists September, **Winners** has new claims._
7. **Results** — as `priya@`: **Draws** → **August 2026**.
   _The reveal: five tiles roll in, her `33 36 29` light up, "3 matches — you win ₹…", then **Claim your prize →**. Reload: result first, **Watch the draw again**._
8. **Proof** — **Claim your prize** → choose any PNG/JPG → **Upload proof**.
   _Status **Under review**._
9. **Verify & claim** — as `admin@`: **Winners → To review** → Priya → **Reject…** with a reason → as `priya@` read the reason and upload again → as `admin@` **Approve**. Then as `priya@`: **Winnings → Claim payout → Claim as subscription credit → Confirm claim**.
   _Priya's page shows the reason verbatim and one more attempt; after approval the admin has nothing left to do; Priya's claim is credited through Stripe (test mode) and the win reads **Paid · ₹… credited … · Stripe ref cbtxn\_…**, with **See it in your billing portal**. Home "Total won" counts it; the admin sees the same reference. `member017@` shows the whole path already completed._
10. **Lapsed** — as `anita@`: **Home**, then **Scores**.
    _"Your subscription has lapsed. Your scores are safe — renew…"; the scores page is locked; her June win is **Paid** under Winnings; **Subscription** offers **Renew**._
11. **Admin tour** — as `admin@`: **Users** (search, open a member: edit profile, scores, grant/end subscription — everything audited) · **Charities** (images, events, spotlight, hide) · **Reports** (totals, by month, charity totals, draw statistics, CSV).
    _Every number equals the ledger. Ending a subscription locks that member on their next click._
12. **Mobile** — open on a phone or at 390 px.
    _No horizontal scroll; a Subscribe pill after the hero; bottom navigation in the member area._

## Also worth a look

- `/` — every figure comes from the ledger; the practice draw runs the real engine in your browser.
- `/charities` — search "water", filter by cause or city; `/charities/neer-jal` has photos, events, totals, **Choose this charity** and **Donate once** (Stripe test mode).
- `/how-it-works` and `/pricing` state every rule the software enforces.
- Every place the PRD was silent and what we decided is marked `[decision]` in `docs/GAME.md` and listed in the README.

## Error handling — try these

| Do                                                                   | Expect                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Log in with a wrong password                                         | "Email or password is incorrect" (the same message for an unknown email)              |
| Sign up with an email that exists                                    | "An account with that email already exists — try logging in"                          |
| Add a score of `0`, `46`, `1.5` or a future date                     | Refused inline, nothing saved                                                         |
| Add a round on a date you already used                               | "You already logged a round on … — edit it instead" with the link                     |
| As a lapsed member, open **Scores**                                  | The page is locked; the database refuses the write too, not only the button           |
| Upload a PDF or a 6 MB file as proof                                 | "PNG, JPG or WebP up to 5 MB" — nothing is stored                                     |
| Open `/admin` as a member                                            | "That door is for admins."                                                            |
| Admin: edit any member's score after simulating, then try to publish | "Scores changed since this simulation" — Publish stays disabled until you re-simulate |
| Admin: publish the same draw from two tabs                           | The second tab reads "already published"; one set of numbers, once                    |
| Abandon Stripe Checkout with the back button                         | "No charge was made. Pick a plan when you're ready."                                  |
| Replay a Stripe webhook (Dashboard → Webhooks → Resend)              | 200 `duplicate: true`; no second payment row                                          |

## Not in the demo

Cash payouts — a prize is paid as subscription credit through Stripe (real in test mode, verified by Stripe's transaction id); paying cash to an Indian bank needs a rail this sandbox cannot reach (Stripe Connect excludes India, RazorpayX needs its own account) and sits behind the same gateway interface. Email notifications. Stripe India (test mode on a US sandbox; INR works unchanged).

_Last verified: `<LIVE_VERIFIED>`_
