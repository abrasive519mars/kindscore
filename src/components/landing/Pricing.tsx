import Link from "next/link";
import { MONTHS_PER_YEAR, PLANS, SPLIT, type PlanInterval } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/primitives";
import { SplitBar } from "@/components/ui/Split";

const YEARLY_PER_MONTH = Math.floor(PLANS.year.pricePaise / MONTHS_PER_YEAR);
const MONTHS_FREE = MONTHS_PER_YEAR - Math.round(PLANS.year.pricePaise / PLANS.month.pricePaise);

/** DESIGN.md §3 step 7 — two plans, the split shown on each, GST named, no bundles or multipliers. */
export function Pricing({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="pricing-heading">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20">
        <FadeIn>
          <header className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">Pricing</p>
            <Heading id="pricing-heading" className="text-4xl md:text-5xl">
              One fee. One entry. Everyone equal.
            </Heading>
            <p className="max-w-prose text-lg text-ink-2">
              No bundles, no multipliers. The saffron part of each payment goes to your charity; the
              blue part funds the prize pool.
            </p>
          </header>
        </FadeIn>
        <div className="grid gap-6 md:grid-cols-2">
          <FadeIn delay={0.06}>
            <PlanCard
              interval="month"
              title="Monthly"
              price={`${formatInr(PLANS.month.pricePaise)}/month`}
              sub="incl. GST · cancel anytime"
              amountPaise={PLANS.month.pricePaise}
            />
          </FadeIn>
          <FadeIn delay={0.12}>
            <PlanCard
              interval="year"
              title="Yearly"
              price={`${formatInr(PLANS.year.pricePaise)}/year`}
              sub={`${formatInr(YEARLY_PER_MONTH)}/mo · ${MONTHS_FREE} months free · incl. GST`}
              amountPaise={PLANS.year.pricePaise}
              badge="Best value"
            />
          </FadeIn>
        </div>
        <p className="text-sm text-ink-2">
          Lapsed members keep their scores but sit out the draw until they renew. At least{" "}
          {SPLIT.CHARITY_MIN_BPS / 100}% goes to your charity; {SPLIT.POOL_SHARE_BPS / 100}% funds
          the pool.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  interval,
  title,
  price,
  sub,
  amountPaise,
  badge,
}: {
  interval: PlanInterval;
  title: string;
  price: string;
  sub: string;
  amountPaise: number;
  badge?: string;
}) {
  return (
    <div className="flex h-full flex-col gap-5 rounded-lg border border-line bg-bg p-6 transition-colors duration-fast hover:border-ink/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">{title}</p>
          <p className="num font-display text-3xl">{price}</p>
          <p className="text-sm text-ink-2">{sub}</p>
        </div>
        {badge && <Badge tone="saffron">{badge}</Badge>}
      </div>
      <SplitBar amountPaise={amountPaise} charityBps={SPLIT.CHARITY_MIN_BPS} compact />
      <Link href={`/signup?plan=${interval}`}>
        <Button variant={badge ? "saffron" : "ink"} className="w-full">
          Subscribe {title.toLowerCase()}
        </Button>
      </Link>
    </div>
  );
}
