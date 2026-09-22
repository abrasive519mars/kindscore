import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SPLIT } from "@/config/constants";
import { getAccess, type SignedInAccess, type SubscriptionState } from "@/lib/auth/access";
import { createCheckoutService } from "@/lib/stripe/billing";
import { planIntervalSchema } from "@/schemas/auth";
import { subscribeSteps } from "@/components/app/subscribeSteps";
import { Banner, Card, Figure } from "@/components/ui/primitives";
import { Stepper } from "@/components/ui/Stepper";
import { ManageSubscription } from "@/app/(member)/app/subscription/ManageSubscription";
import { PlanChooser } from "@/app/(member)/app/subscription/PlanChooser";

export const metadata: Metadata = { title: "Subscription" };

type Search = { session_id?: string; canceled?: string; activated?: string; plan?: string };

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/**
 * Landing back from Stripe with a session id: sync the mirror now rather than wait for the
 * webhook, then redirect so the whole page (layout banner included) renders from fresh data.
 */
async function syncFromCheckout(userId: string, sessionId: string): Promise<never> {
  const outcome = await createCheckoutService().syncAfterCheckout(userId, sessionId);
  redirect(
    outcome?.applied ? "/app/subscription?activated=1" : "/app/subscription?activated=pending",
  );
}

export default async function SubscriptionPage({ searchParams }: PageProps<"/app/subscription">) {
  const access = (await getAccess()) as SignedInAccess;
  const search = (await searchParams) as Search;
  if (search.session_id) await syncFromCheckout(access.userId, search.session_id);

  const { subscription } = access;
  // Straight from signup: this page is step 2 of subscribing, and reads as one.
  const firstTimer = subscription.status === "none" && access.kind !== "admin";
  return (
    <div className="flex flex-col gap-8">
      {firstTimer && <Stepper steps={subscribeSteps(2)} />}
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Subscription</h1>
        <p className="text-ink-2">
          {firstTimer
            ? "Step 2 of 2 — pick a plan. Stripe takes the payment; we never see your card."
            : "One fee, one entry, everyone equal. No bundles, no multipliers."}
        </p>
      </header>

      <ReturnNotice search={search} />
      <StatusCard subscription={subscription} isAdmin={access.kind === "admin"} />

      {/* past_due keeps its live subscription: the card is fixed in the portal, not by a second checkout. */}
      {!subscription.hasAccess && subscription.status !== "past_due" && (
        <PlanChooser
          charityBps={access.profile.charity_bps}
          verb={subscription.status === "none" ? "Subscribe" : "Renew"}
          preferred={planIntervalSchema.safeParse(search.plan).data}
        />
      )}

      <p className="text-sm text-ink-2">
        Of every payment, at least {SPLIT.CHARITY_MIN_BPS / 100}% goes to your charity and{" "}
        {SPLIT.POOL_SHARE_BPS / 100}% to the prize pool. The rest runs Kindscore. Payments are
        handled by Stripe; we never see your card.
      </p>
    </div>
  );
}

function ReturnNotice({ search }: { search: Search }) {
  if (search.activated === "1") {
    return (
      <Banner tone="success">
        Payment received — you&apos;re in the next draw. Log your five rounds.
      </Banner>
    );
  }
  if (search.activated === "pending") {
    return (
      <Banner tone="warn">
        Payment received — activating your membership. Refresh in a moment.
      </Banner>
    );
  }
  if (search.canceled === "1") {
    return <Banner tone="neutral">No charge was made. Pick a plan when you&apos;re ready.</Banner>;
  }
  return null;
}

function StatusCard({
  subscription,
  isAdmin,
}: {
  subscription: SubscriptionState;
  isAdmin: boolean;
}) {
  const { status, hasAccess, currentPeriodEnd, cancelAtPeriodEnd, interval } = subscription;
  const periodEnd = currentPeriodEnd ? formatDay(currentPeriodEnd) : null;
  const label = isAdmin && status === "none" ? "Admin" : statusLabel(status, hasAccess);
  const hint = hintFor(status, hasAccess, cancelAtPeriodEnd, periodEnd, interval);

  return (
    <Card className="flex flex-col gap-5">
      <Figure
        label="Current status"
        value={<span className="text-2xl">{label}</span>}
        hint={hint}
      />
      {hasAccess && periodEnd && (
        <ManageSubscription cancelAtPeriodEnd={cancelAtPeriodEnd} periodEndLabel={periodEnd} />
      )}
      {status === "past_due" && (
        <ManageSubscription
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          periodEndLabel={periodEnd ?? ""}
        />
      )}
    </Card>
  );
}

function statusLabel(status: SubscriptionState["status"], hasAccess: boolean): string {
  if (hasAccess) return "Active";
  if (status === "none") return "Not subscribed";
  if (status === "past_due") return "Payment failed";
  return status === "cancelled" ? "Ended" : "Lapsed";
}

function hintFor(
  status: SubscriptionState["status"],
  hasAccess: boolean,
  cancelAtPeriodEnd: boolean,
  periodEnd: string | null,
  interval: SubscriptionState["interval"],
): string | undefined {
  const plan = interval === "year" ? "yearly" : "monthly";
  if (hasAccess && periodEnd) {
    return cancelAtPeriodEnd ? `Ends ${periodEnd} · won't renew` : `Renews ${periodEnd} · ${plan}`;
  }
  if (status === "past_due")
    return "Your last payment didn't go through. Update your card to get back in the draw.";
  if (status === "cancelled" || status === "lapsed")
    return "Your scores are safe. Renew to enter the next draw.";
  return undefined;
}
