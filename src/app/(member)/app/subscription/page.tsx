import type { Metadata } from "next";
import { PLANS, SPLIT } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Figure } from "@/components/ui/primitives";
import { SplitBar } from "@/components/ui/Split";

export const metadata: Metadata = { title: "Subscription" };

const YEARLY_EFFECTIVE_MONTHLY = Math.floor(PLANS.year.pricePaise / 12);

/** Plan cards per DESIGN.md §3 pricing. Checkout itself arrives in Phase 5; today the buttons say so. */
export default async function SubscriptionPage() {
  const access = (await getAccess()) as SignedInAccess;
  const { status, hasAccess, currentPeriodEnd, interval } = access.subscription;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Subscription</h1>
        <p className="text-ink-2">
          One fee, one entry, everyone equal. No bundles, no multipliers.
        </p>
      </header>

      <Card>
        <Figure
          label="Current status"
          value={
            <span className="text-2xl">
              {hasAccess
                ? "Active"
                : status === "none"
                  ? "Not subscribed"
                  : status.replace("_", " ")}
            </span>
          }
          hint={
            currentPeriodEnd
              ? `Paid through ${new Date(currentPeriodEnd).toLocaleDateString("en-IN")} · ${interval}ly`
              : undefined
          }
        />
      </Card>

      <section className="grid gap-6 md:grid-cols-2" aria-label="Plans">
        <PlanCard
          title="Monthly"
          price={`${formatInr(PLANS.month.pricePaise)}/month`}
          sub="incl. GST · cancel anytime"
          amountPaise={PLANS.month.pricePaise}
          charityBps={access.profile.charity_bps}
        />
        <PlanCard
          title="Yearly"
          price={`${formatInr(PLANS.year.pricePaise)}/year`}
          sub={`${formatInr(YEARLY_EFFECTIVE_MONTHLY)}/month · 2 months free · incl. GST`}
          amountPaise={PLANS.year.pricePaise}
          charityBps={access.profile.charity_bps}
          badge="Best value"
        />
      </section>

      <p className="text-sm text-ink-2">
        Of every payment, at least {SPLIT.CHARITY_MIN_BPS / 100}% goes to your charity and{" "}
        {SPLIT.POOL_SHARE_BPS / 100}% to the prize pool. The rest runs Kindscore.
      </p>
    </div>
  );
}

interface PlanCardProps {
  readonly title: string;
  readonly price: string;
  readonly sub: string;
  readonly amountPaise: number;
  readonly charityBps: number;
  readonly badge?: string;
}

function PlanCard({ title, price, sub, amountPaise, charityBps, badge }: PlanCardProps) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">{title}</p>
          <p className="num font-display text-3xl">{price}</p>
          <p className="text-sm text-ink-2">{sub}</p>
        </div>
        {badge && <Badge tone="saffron">{badge}</Badge>}
      </div>
      <SplitBar amountPaise={amountPaise} charityBps={charityBps} compact />
      <Button disabled title="Payments arrive in the next phase">
        Choose {title.toLowerCase()} · coming soon
      </Button>
    </Card>
  );
}
