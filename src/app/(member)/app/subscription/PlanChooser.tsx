"use client";

import { useActionState } from "react";
import { PLANS, type PlanInterval } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { startCheckout } from "@/app/(member)/app/subscription/actions";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/primitives";
import { SplitBar } from "@/components/ui/Split";

const YEARLY_PER_MONTH = Math.floor(PLANS.year.pricePaise / 12);

interface PlanChooserProps {
  readonly charityBps: number;
  /** "Subscribe" for a first-timer, "Renew" for someone coming back. */
  readonly verb: "Subscribe" | "Renew";
}

/** Two plan cards, one form each. Submitting sends the member to Stripe Checkout. */
export function PlanChooser({ charityBps, verb }: PlanChooserProps) {
  const [state, action, pending] = useActionState(startCheckout, null);
  const error = state && !state.ok ? state.error.message : null;

  return (
    <section className="flex flex-col gap-4" aria-label="Plans">
      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard
          interval="month"
          price={`${formatInr(PLANS.month.pricePaise)}/month`}
          sub="cancel anytime"
          charityBps={charityBps}
          verb={verb}
          action={action}
          pending={pending}
        />
        <PlanCard
          interval="year"
          price={`${formatInr(PLANS.year.pricePaise)}/year`}
          sub={`${formatInr(YEARLY_PER_MONTH)}/month · 2 months free`}
          charityBps={charityBps}
          verb={verb}
          action={action}
          pending={pending}
          badge="Best value"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

interface PlanCardProps {
  readonly interval: PlanInterval;
  readonly price: string;
  readonly sub: string;
  readonly charityBps: number;
  readonly verb: string;
  readonly action: (formData: FormData) => void;
  readonly pending: boolean;
  readonly badge?: string;
}

function PlanCard({
  interval,
  price,
  sub,
  charityBps,
  verb,
  action,
  pending,
  badge,
}: PlanCardProps) {
  const plan = PLANS[interval];
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">{plan.label}</p>
          <p className="num font-display text-3xl">{price}</p>
          <p className="text-sm text-ink-2">{sub}</p>
        </div>
        {badge && <Badge tone="saffron">{badge}</Badge>}
      </div>
      <SplitBar amountPaise={plan.pricePaise} charityBps={charityBps} compact />
      <form action={action}>
        <input type="hidden" name="interval" value={interval} />
        <Button
          type="submit"
          pending={pending}
          variant={badge ? "saffron" : "ink"}
          className="w-full"
        >
          {verb} {plan.label.toLowerCase()}
        </Button>
      </form>
    </Card>
  );
}
