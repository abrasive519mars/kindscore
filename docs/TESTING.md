# Testing Kindscore

Ten minutes, in PRD §16.1 order. The site is live and seeded — nothing to set up.

**Site** https://kindscore.vercel.app · **Password** `Kindscore!2026` (every account) · **Card** `4242 4242 4242 4242`, any future date, any CVC

| Log in as             | Who                                             | Steps    |
| --------------------- | ----------------------------------------------- | -------- |
| `admin@kindscore.app` | The administrator                               | 5 6 9 11 |
| `priya@kindscore.app` | Active member, 3-match win in August, unclaimed | 4 7 8 9  |
| `raj@kindscore.app`   | Active member with only three scores            | 3        |
| `anita@kindscore.app` | Lapsed member, one June win already paid        | 10       |
| _your own signup_     | The only real Stripe checkout                   | 1 2      |

## The steps

1. **Sign up** — Home → **Subscribe & fund a cause** → name, email, password, a charity, slide the share to 25% → **Create account**.
   _You land on step 2 of 2: the two plans. **Home** shows a "not subscribed" banner and a locked scores card._

2. **Subscribe** — **Subscribe monthly** → Stripe: `4242 4242 4242 4242`, `12/34`, `123`, India, any address.
   _"Payment received" · status **Active · Renews … · monthly**. Optional: **Cancel**, then **Resume**._

3. **Scores** — **Scores** → add five rounds on different dates → a sixth on a newer date → a date you already used → `46` → a future date.
   _Newest first. The sixth names the round it replaced. Duplicate date refused with **Edit that round**. 46 and the future date refused. Home says **Eligible**. As `raj@`, Home says "Enter 2 more rounds"._

4. **Dashboard** — as `priya@`: **Home**.
   _Active · yearly · scores `28 33 31 36 29` · Udaan Girls' Sports Collective at 15% with the rupee split · 3 draws entered · September jackpot · Total won ₹0, "1 win awaiting verification" · August's numbers with her three matches and **Claim your prize**._

5. **Simulate** — as `admin@` (lands on the admin): **Draws → Open September's draw** → **Weighted by scores** → drag **Weighting strength** → **Simulate the draw** → **Re-simulate with fresh numbers**.
   _Draft: five numbers, pool ≈ ₹43,800 from 302 subscribers, jackpot **+ ₹52,591 rolled in**, winners per tier. Random = flat bars, weighted = the score distribution._

6. **Publish** — (optional: edit any member's score under **Users**, come back — "Scores changed since this simulation", Publish disabled until you re-simulate) → **Publish this draw → Confirm — publish**.
   _**Published**, read-only report; September appears under Draws and Winners._

7. **Results** — as `priya@`: **Draws → August 2026**.
   _Five tiles roll in, `33 36 29` light up, "3 matches — you win ₹…", **Claim your prize →**. Reload: result first, **Watch the draw again**._

8. **Proof** — **Claim your prize** → choose any PNG/JPG → **Upload proof**.
   _**Under review**._

9. **Verify & claim** — as `admin@`: **Winners → To review → Priya → Reject…** with a reason → as `priya@` read it, upload again → as `admin@` **Approve** → as `priya@`: **Winnings → Claim payout → Claim as subscription credit → Confirm claim**.
   _Reason shown verbatim with one more attempt · after approval the admin has nothing left to do · the claim reads **Paid · ₹… credited … · Stripe ref cbtxn\_…** with **See it in your billing portal** · Home "Total won" counts it · the admin sees the same reference._

10. **Lapsed** — as `anita@`: **Home**, then **Scores**.
    _"Your subscription has lapsed…" · scores locked · June win **Paid** under Winnings · Subscription offers **Renew**._

11. **Admin tour** — as `admin@`: **Users** (search, edit profile / scores / grant or end a subscription — all audited) · **Charities** (images, events, spotlight, hide) · **Reports** (totals, by month, charities, draws, CSV).
    _Every number equals the ledger. Ending a subscription locks that member on their next click._

12. **Mobile** — open on a phone or at 390 px.
    _No horizontal scroll · Subscribe pill after the hero · bottom navigation in the member area._

## Also worth a look

- `/` — every figure is live from the ledger; the practice draw runs the real engine in your browser.
- `/charities` — search "water", filter by cause or city; `/charities/neer-jal` has photos, events, totals, **Choose this charity** and **Donate once**.
- `/how-it-works` and `/pricing` state every rule the software enforces.

## Break it

| Try                                             | See                                                          |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Wrong password, or an email that already exists | One honest message each                                      |
| A score of `0`, `46`, `1.5`, or a future date   | Refused inline, nothing saved                                |
| As `anita@`, open **Scores**                    | Locked — and the database refuses the write, not only the UI |
| A PDF or a 6 MB file as proof                   | "PNG, JPG or WebP up to 5 MB"                                |
| `/admin` as a member                            | "That door is for admins."                                   |
| Publish the same draw from two tabs             | The second tab: already published — one set of numbers, once |
| Stripe Dashboard → Webhooks → resend an event   | 200 `duplicate: true`, no second payment row                 |

**Not in the demo:** cash payouts (prizes are Stripe subscription credit — this sandbox cannot pay an Indian bank) and email notifications.

_Last verified live: 22 September 2026, 12:29 UTC — 35 of 35 checks passed (`scripts/walkthroughs/walkthrough-live.ts`)._
