import type { Metadata } from "next";
import Link from "next/link";
import { PLANS, SCORE, SPLIT, TIER_SHARE_BPS } from "@/config/constants";
import { applyBps, formatInr } from "@/engine/money/paise";
import { Button } from "@/components/ui/Button";
import { Rule } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Your last five Stableford scores are your lottery numbers. Here is exactly how the draw, the prizes, the charity share and the rollover work.",
};
export const revalidate = 3600;

const MIN_CHARITY = applyBps(PLANS.month.pricePaise, SPLIT.CHARITY_MIN_BPS);
const POOL_SLICE = applyBps(PLANS.month.pricePaise, SPLIT.POOL_SHARE_BPS);

const SECTIONS: ReadonlyArray<{ title: string; body: string[] }> = [
  {
    title: "Your five scores are your numbers",
    body: [
      `After each round, log your Stableford score — a whole number from ${SCORE.MIN} to ${SCORE.MAX} — with the date you played. We keep your ${SCORE.WINDOW_SIZE} most recent rounds by date played; a sixth replaces the oldest automatically. One score per date: an existing round can be edited or deleted, never doubled.`,
      "Those five numbers are your ticket for the month. You need all five, and an active subscription, to be in a draw. A round dated earlier than all five kept rounds is refused rather than silently dropped.",
    ],
  },
  {
    title: "The draw",
    body: [
      `Once a month the admin runs the draw: five different numbers from ${SCORE.MIN} to ${SCORE.MAX}, like five balls from forty-five. The admin picks one of two modes. Random gives every number the same chance. Weighted by scores makes the numbers golfers are actually scoring likelier — more winners, more excitement — while every number stays possible.`,
      "The admin always simulates first and sees every winner and every rupee before publishing. Nothing is re-rolled at publish: what was previewed is exactly what goes out. If anyone's scores change between simulate and publish, the draft is marked stale and must be re-run.",
    ],
  },
  {
    title: "Matching and prizes",
    body: [
      `Your five scores are compared with the five drawn numbers. A repeated score counts once. Three winning levels: five matches (the jackpot, ${TIER_SHARE_BPS[5] / 100}% of the pool), four (${TIER_SHARE_BPS[4] / 100}%), three (${TIER_SHARE_BPS[3] / 100}%). Two or fewer wins nothing.`,
      "Everyone at a level splits it equally, to the paisa. The pool is the sum of every active member's prize slice that month — nothing is added or invented.",
    ],
  },
  {
    title: "The jackpot rolls over",
    body: [
      "Most months nobody matches all five. When that happens the jackpot money carries into next month's five-match prize and keeps growing until someone takes it. The four- and three-match prizes do not roll over; if nobody wins one, it simply isn't paid that month.",
    ],
  },
  {
    title: "Where the money goes",
    body: [
      `Each payment is split three ways. At least ${SPLIT.CHARITY_MIN_BPS / 100}% (${formatInr(MIN_CHARITY)} of ${formatInr(PLANS.month.pricePaise)}) goes to the charity you chose; you can raise that to ${SPLIT.CHARITY_MAX_BPS / 100}%. A fixed ${SPLIT.POOL_SHARE_BPS / 100}% (${formatInr(POOL_SLICE)}) funds the prize pool. Whatever is left runs Kindscore — and at ${SPLIT.CHARITY_MAX_BPS / 100}%, that is nothing.`,
      "The split is frozen on every payment, so changing your charity later never rewrites history. You can also give once, any amount from ₹10, outside the game entirely.",
    ],
  },
  {
    title: "Winning, proving, getting paid",
    body: [
      "Winners upload one screenshot of their scores from the app or club system where the rounds were recorded. The admin approves or rejects it — a rejection comes with a reason and one more attempt. An approved prize is paid and marked paid. Only you and the admin ever see the screenshot.",
    ],
  },
  {
    title: "If your subscription lapses",
    body: [
      "You keep your account, your scores and your history. You just sit out the draw until you renew. Cancelling keeps you in until the end of the paid period; you can resume any time before then.",
    ],
  },
];

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Do I have to be good at golf?",
    a: "No. Any score from 1 to 45 is a number in the draw. A 12 matches a drawn 12 exactly like a 36 matches a 36.",
  },
  {
    q: "What if I only have three rounds logged?",
    a: "You are not in that month's draw. Your dashboard tells you how many more you need. Your subscription still funds your charity.",
  },
  {
    q: "Can I enter twice?",
    a: "No. One fee, one entry, everyone equal. There are no bundles or multipliers.",
  },
  {
    q: "Who sees my scores?",
    a: "You, and the admin when reviewing a win. Other members only ever see how many people won at each level.",
  },
  {
    q: "What does the admin see before publishing?",
    a: "Everything: the five numbers, every winner, every prize amount. Publishing makes it final; re-simulating replaces it.",
  },
  {
    q: "Is the money real?",
    a: "Payments run through Stripe. On this demo deployment Stripe is in test mode, so use the test card 4242 4242 4242 4242.",
  },
  {
    q: "How is the pool calculated?",
    a: `Every active member adds their prize slice — ${formatInr(POOL_SLICE)} on the monthly plan, one twelfth of the yearly slice on the yearly plan — and the total is split 40 / 35 / 25 across the three levels.`,
  },
  {
    q: "What happens to unclaimed four- and three-match prizes?",
    a: "They are retained and shown in the admin's reports. Only the jackpot rolls over.",
  },
  {
    q: "Can I change my charity?",
    a: "Any time. It applies from your next payment; earlier payments stay with the charity that received them.",
  },
  {
    q: "Can I cancel?",
    a: "Any time. You stay in until the end of the period you paid for, and you can resume before then.",
  },
];

export default function HowItWorksPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">How it works</p>
        <h1 className="text-5xl">The whole game, plainly.</h1>
        <p className="text-lg text-ink-2">
          Every rule below is the rule the software enforces. Where the brief left something open,
          the choice we made is stated, not hidden.
        </p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-3xl">{section.title}</h2>
          {section.body.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed text-ink-2">
              {p}
            </p>
          ))}
        </section>
      ))}
      <Rule />
      <section className="flex flex-col gap-6" aria-labelledby="faq">
        <h2 id="faq" className="text-3xl">
          Questions people ask
        </h2>
        <dl className="flex flex-col divide-y divide-line">
          {FAQ.map((item) => (
            <div key={item.q} className="flex flex-col gap-1 py-4">
              <dt className="font-medium">{item.q}</dt>
              <dd className="text-ink-2">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/signup">
          <Button variant="saffron">Subscribe &amp; fund a cause</Button>
        </Link>
        <Link href="/charities">
          <Button variant="ghost">Meet the charities</Button>
        </Link>
      </div>
    </article>
  );
}
