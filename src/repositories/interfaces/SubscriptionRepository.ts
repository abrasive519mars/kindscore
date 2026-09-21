import type { SubscriptionStatus } from "@/engine/subscription/status";
import type { SubscriptionSnapshot } from "@/lib/stripe/snapshots";

/** The mirror row as the app reads it. `id` is our uuid, not Stripe's. */
export interface SubscriptionRecord {
  readonly id: string;
  readonly userId: string;
  readonly stripeSubscriptionId: string;
  readonly status: SubscriptionStatus;
  readonly interval: "month" | "year";
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly lastEventAt: string | null;
}

/** "stale": the stored row came from a newer Stripe event, so this one was ignored. */
export type UpsertOutcome = "applied" | "stale";

/**
 * Writes happen only through the webhook and the post-checkout sync (service role); reads happen
 * as the signed-in user. Same interface either way — the client decides what RLS allows.
 */
export interface SubscriptionRepository {
  upsertFromSnapshot(
    userId: string,
    snapshot: SubscriptionSnapshot,
    status: SubscriptionStatus,
  ): Promise<UpsertOutcome>;
  findByStripeId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null>;
  /** The one row in `active` or `past_due` (partial unique index), or null. */
  findLiveForUser(userId: string): Promise<SubscriptionRecord | null>;
}
