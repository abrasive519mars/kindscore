/**
 * Our four subscription states (PRD §04: renewal, cancellation, lapsed) and the rule for access.
 * Stripe's vocabulary is translated here once; nothing else in the app sees Stripe status strings.
 */
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "lapsed";

const STRIPE_TO_LOCAL: Readonly<Record<string, SubscriptionStatus>> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  canceled: "cancelled",
  unpaid: "lapsed",
  incomplete: "lapsed",
  incomplete_expired: "lapsed",
  paused: "lapsed",
};

/** Unknown Stripe statuses map to `lapsed`: when in doubt, restrict rather than grant. */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  return STRIPE_TO_LOCAL[stripeStatus] ?? "lapsed";
}

export interface AccessCheck {
  readonly status: SubscriptionStatus;
  /** ISO-8601 timestamp of the end of the paid period. */
  readonly currentPeriodEnd: string;
}

/**
 * PRD §04 "real-time subscription status check": active AND still inside the paid period.
 * The period check self-heals a missed webhook — an expired period denies access on its own.
 */
export function hasActiveAccess(subscription: AccessCheck | null, now: Date): boolean {
  if (!subscription || subscription.status !== "active") return false;
  return new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
}
