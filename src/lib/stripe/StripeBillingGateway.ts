import type Stripe from "stripe";
import { BILLING } from "@/config/constants";
import { clientEnv } from "@/config/env";
import { ExternalServiceError } from "@/engine/errors";
import type {
  BillingGateway,
  CheckoutRequest,
  CompletedCheckout,
  CompletedDonation,
  DonationCheckoutRequest,
} from "@/lib/stripe/BillingGateway";
import {
  toInvoiceSnapshot,
  toSubscriptionSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/stripe/snapshots";

function appUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_APP_URL).toString();
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/** The only class that calls the Stripe SDK on the app's behalf (the webhook reads; this writes). */
export class StripeBillingGateway implements BillingGateway {
  constructor(private readonly stripe: Stripe) {}

  async createCheckoutSession(request: CheckoutRequest): Promise<{ url: string }> {
    const session = await this.call("Checkout", () =>
      this.stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: request.priceId, quantity: 1 }],
        client_reference_id: request.userId,
        metadata: { user_id: request.userId, interval: request.interval },
        subscription_data: { metadata: { user_id: request.userId } },
        ...(request.customerId
          ? { customer: request.customerId }
          : { customer_email: request.email }),
        // INR charges need a billing name + address; asking Stripe to collect them avoids a decline.
        billing_address_collection: "required",
        success_url: appUrl(BILLING.SUCCESS_PATH),
        cancel_url: appUrl(BILLING.CANCEL_PATH),
        allow_promotion_codes: false,
      }),
    );
    if (!session.url) throw new ExternalServiceError("Checkout");
    return { url: session.url };
  }

  async retrieveCompletedCheckout(sessionId: string): Promise<CompletedCheckout | null> {
    const session = await this.call("Checkout", () =>
      this.stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription", "invoice"] }),
    );
    if (session.status !== "complete") return null;
    const { subscription, invoice, customer } = session;
    return {
      userId: session.client_reference_id,
      customerId: typeof customer === "string" ? customer : (customer?.id ?? null),
      subscription:
        subscription && typeof subscription !== "string"
          ? toSubscriptionSnapshot(subscription, nowUnix())
          : null,
      invoice: invoice && typeof invoice !== "string" ? toInvoiceSnapshot(invoice) : null,
    };
  }

  async createPortalSession(customerId: string): Promise<{ url: string }> {
    const portal = await this.call("Billing portal", () =>
      this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: appUrl(BILLING.PORTAL_RETURN_PATH),
      }),
    );
    return { url: portal.url };
  }

  async setCancelAtPeriodEnd(id: string, cancel: boolean): Promise<SubscriptionSnapshot> {
    const subscription = await this.call("Subscriptions", () =>
      this.stripe.subscriptions.update(id, { cancel_at_period_end: cancel }),
    );
    return toSubscriptionSnapshot(subscription, nowUnix());
  }

  async createDonationCheckout(
    request: DonationCheckoutRequest,
  ): Promise<{ id: string; url: string }> {
    const session = await this.call("Checkout", () =>
      this.stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: BILLING.CURRENCY,
              unit_amount: request.amountPaise,
              product_data: { name: `Donation to ${request.charityName}` },
            },
          },
        ],
        client_reference_id: request.userId,
        customer_email: request.email,
        metadata: { kind: "donation", donation_id: request.donationId, user_id: request.userId },
        billing_address_collection: "required",
        success_url: appUrl(request.returnPath),
        cancel_url: appUrl(
          request.returnPath.replace("session_id={CHECKOUT_SESSION_ID}", "canceled=1"),
        ),
      }),
    );
    if (!session.url) throw new ExternalServiceError("Checkout");
    return { id: session.id, url: session.url };
  }

  async retrieveCompletedDonation(sessionId: string): Promise<CompletedDonation | null> {
    const session = await this.call("Checkout", () =>
      this.stripe.checkout.sessions.retrieve(sessionId),
    );
    const donationId = session.metadata?.donation_id;
    if (session.status !== "complete" || session.metadata?.kind !== "donation" || !donationId)
      return null;
    return { donationId, amountPaise: session.amount_total ?? 0 };
  }

  /** Every Stripe failure surfaces as one ExternalServiceError; callers never see SDK error shapes. */
  private async call<T>(service: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new ExternalServiceError(service, error);
    }
  }
}
