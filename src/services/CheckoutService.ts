import type { PlanInterval } from "@/config/constants";
import { ForbiddenError, NotFoundError } from "@/engine/errors";
import type { BillingGateway } from "@/lib/stripe/BillingGateway";
import type { ProfileRepository } from "@/repositories/interfaces/ProfileRepository";
import type { SubscriptionRepository } from "@/repositories/interfaces/SubscriptionRepository";
import type {
  SubscriptionSyncOutcome,
  SubscriptionSyncService,
} from "@/services/SubscriptionSyncService";

export interface CheckoutDeps {
  readonly gateway: BillingGateway;
  readonly profiles: ProfileRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly sync: SubscriptionSyncService;
  readonly priceIds: Readonly<Record<PlanInterval, string>>;
}

/**
 * The member-initiated side of billing. Every method takes the *authenticated* user id and only
 * ever touches that member's customer and subscription — the guard that makes it safe to run
 * these on the service-role client (writes to the subscription mirror need it).
 */
export class CheckoutService {
  constructor(private readonly deps: CheckoutDeps) {}

  async startCheckout(userId: string, interval: PlanInterval): Promise<{ url: string }> {
    const profile = await this.requireProfile(userId);
    return this.deps.gateway.createCheckoutSession({
      userId,
      email: profile.email,
      customerId: profile.stripeCustomerId,
      priceId: this.deps.priceIds[interval],
      interval,
    });
  }

  /**
   * Called when the member lands back from Stripe. Same sync as the webhook, so whichever runs
   * first wins and the second is a harmless repeat. Null: the session isn't finished yet.
   */
  async syncAfterCheckout(
    userId: string,
    sessionId: string,
  ): Promise<SubscriptionSyncOutcome | null> {
    const checkout = await this.deps.gateway.retrieveCompletedCheckout(sessionId);
    if (!checkout) return null;
    if (checkout.userId !== userId)
      throw new ForbiddenError("That checkout belongs to someone else.");
    if (!checkout.subscription) return null;
    const outcome = await this.deps.sync.applySubscription(checkout.subscription);
    // Idempotent on invoice id: when the webhook has already recorded it, this is a no-op.
    if (outcome.applied && checkout.invoice) await this.deps.sync.applyInvoice(checkout.invoice);
    return outcome;
  }

  /** Cancel keeps access until the paid period ends; resume undoes it before then. */
  async setCancelAtPeriodEnd(userId: string, cancel: boolean): Promise<SubscriptionSyncOutcome> {
    const live = await this.deps.subscriptions.findLiveForUser(userId);
    if (!live) throw new NotFoundError("You don't have an active subscription.");
    const snapshot = await this.deps.gateway.setCancelAtPeriodEnd(
      live.stripeSubscriptionId,
      cancel,
    );
    // Apply immediately so the very next render is right; the webhook's copy will be a no-op.
    return this.deps.sync.applySubscription(snapshot);
  }

  async openBillingPortal(userId: string): Promise<{ url: string }> {
    const profile = await this.requireProfile(userId);
    if (!profile.stripeCustomerId) throw new NotFoundError("Subscribe first to manage billing.");
    return this.deps.gateway.createPortalSession(profile.stripeCustomerId);
  }

  private async requireProfile(userId: string) {
    const profile = await this.deps.profiles.findById(userId);
    if (!profile) throw new NotFoundError("We couldn't find your profile.");
    return profile;
  }
}
