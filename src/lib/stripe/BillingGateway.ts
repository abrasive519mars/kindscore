import type { PlanInterval } from "@/config/constants";
import type { InvoiceSnapshot, SubscriptionSnapshot } from "@/lib/stripe/snapshots";

export interface CheckoutRequest {
  readonly userId: string;
  readonly email: string;
  /** Reuse the member's Stripe customer when we already have one; otherwise Stripe creates it. */
  readonly customerId: string | null;
  readonly priceId: string;
  readonly interval: PlanInterval;
}

export interface CompletedCheckout {
  /** `client_reference_id` we set — proves the session belongs to the caller. */
  readonly userId: string | null;
  readonly customerId: string | null;
  readonly subscription: SubscriptionSnapshot | null;
  /** The first invoice, so a dev box with no webhook still records the payment. */
  readonly invoice: InvoiceSnapshot | null;
}

/**
 * Everything the app asks Stripe to *do*. The one interface between business logic and the
 * payment provider: CheckoutService depends on this, StripeBillingGateway implements it, tests
 * use an in-memory fake. Swapping providers (Razorpay, say) means one new class.
 */
export interface BillingGateway {
  createCheckoutSession(request: CheckoutRequest): Promise<{ url: string }>;
  retrieveCompletedCheckout(sessionId: string): Promise<CompletedCheckout | null>;
  createPortalSession(customerId: string): Promise<{ url: string }>;
  setCancelAtPeriodEnd(
    stripeSubscriptionId: string,
    cancel: boolean,
  ): Promise<SubscriptionSnapshot>;
}
