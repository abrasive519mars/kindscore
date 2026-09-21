import { splitPayment } from "@/engine/charity/splitPayment";
import { mapStripeStatus, type SubscriptionStatus } from "@/engine/subscription/status";
import type { InvoiceSnapshot, SubscriptionSnapshot } from "@/lib/stripe/snapshots";
import type { PaymentRepository } from "@/repositories/interfaces/PaymentRepository";
import type {
  BillingProfile,
  ProfileRepository,
} from "@/repositories/interfaces/ProfileRepository";
import type { SubscriptionRepository } from "@/repositories/interfaces/SubscriptionRepository";

export interface SyncRepositories {
  readonly subscriptions: SubscriptionRepository;
  readonly payments: PaymentRepository;
  readonly profiles: ProfileRepository;
}

export type SubscriptionSyncOutcome =
  | { readonly applied: true; readonly userId: string; readonly status: SubscriptionStatus }
  | { readonly applied: false; readonly reason: "unknown_customer" | "stale" };

export type InvoiceSyncOutcome =
  | { readonly recorded: true; readonly userId: string }
  | { readonly recorded: false; readonly reason: "unknown_customer" | "no_charity" | "duplicate" };

/**
 * Turns what Stripe says into what the database mirrors. Called by the webhook and by the
 * post-checkout sync — the same code path, so the member sees the same result whichever
 * arrives first. No Stripe import: the inputs are plain snapshots, the rules are engine functions.
 */
export class SubscriptionSyncService {
  constructor(private readonly repos: SyncRepositories) {}

  async applySubscription(snapshot: SubscriptionSnapshot): Promise<SubscriptionSyncOutcome> {
    const profile = await this.resolveProfile(snapshot);
    if (!profile) return { applied: false, reason: "unknown_customer" };

    if (!profile.stripeCustomerId) {
      await this.repos.profiles.setStripeCustomerId(profile.id, snapshot.stripeCustomerId);
    }
    const status = mapStripeStatus(snapshot.stripeStatus);
    const outcome = await this.repos.subscriptions.upsertFromSnapshot(profile.id, snapshot, status);
    if (outcome === "stale") return { applied: false, reason: "stale" };
    return { applied: true, userId: profile.id, status };
  }

  /** The charity share is frozen from the profile *as it is now* — later changes never rewrite history. */
  async applyInvoice(snapshot: InvoiceSnapshot): Promise<InvoiceSyncOutcome> {
    const profile = await this.repos.profiles.findByStripeCustomerId(snapshot.stripeCustomerId);
    if (!profile) return { recorded: false, reason: "unknown_customer" };
    if (!profile.charityId) return { recorded: false, reason: "no_charity" };

    const subscription = await this.repos.subscriptions.findByStripeId(
      snapshot.stripeSubscriptionId,
    );
    const recorded = await this.repos.payments.recordIfNew({
      userId: profile.id,
      subscriptionId: subscription?.id ?? null,
      stripeInvoiceId: snapshot.stripeInvoiceId,
      amountPaise: snapshot.amountPaise,
      charityId: profile.charityId,
      charityBps: profile.charityBps,
      split: splitPayment(snapshot.amountPaise, profile.charityBps),
      paidAt: snapshot.paidAt,
    });
    return recorded
      ? { recorded: true, userId: profile.id }
      : { recorded: false, reason: "duplicate" };
  }

  /** Our checkout stamps `metadata.user_id`; a subscription made any other way is matched by customer. */
  private async resolveProfile(snapshot: SubscriptionSnapshot): Promise<BillingProfile | null> {
    if (snapshot.userId) {
      const byId = await this.repos.profiles.findById(snapshot.userId);
      if (byId) return byId;
    }
    return this.repos.profiles.findByStripeCustomerId(snapshot.stripeCustomerId);
  }
}
