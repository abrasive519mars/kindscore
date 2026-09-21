import type Stripe from "stripe";
import { toInvoiceSnapshot, toSubscriptionSnapshot } from "@/lib/stripe/snapshots";
import type { SubscriptionSyncService } from "@/services/SubscriptionSyncService";

/** The narrow piece of the SDK this file needs, so tests can pass a stub instead of a network. */
export interface SubscriptionFetcher {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
}

export type HandledEvent =
  | { readonly handled: true; readonly summary: string }
  | { readonly handled: false; readonly reason: "ignored_type" | "not_a_subscription" };

function subscriptionIdOf(session: Stripe.Checkout.Session): string | null {
  const ref = session.subscription;
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

/**
 * One event → one or two service calls. The event payload's own object is used (it is the full
 * object at the moment of the event, and `last_event_at` guards ordering); a retrieve happens only
 * for checkout.session.completed, whose payload carries just the subscription id.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  stripe: SubscriptionFetcher,
  sync: SubscriptionSyncService,
): Promise<HandledEvent> {
  switch (event.type) {
    case "checkout.session.completed": {
      const id = subscriptionIdOf(event.data.object);
      if (!id) return { handled: false, reason: "not_a_subscription" };
      const subscription = await stripe.retrieveSubscription(id);
      return applySubscription(sync, subscription, event.created);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applySubscription(sync, event.data.object, event.created);
    case "invoice.paid":
      return applyPaidInvoice(sync, event.data.object, event.created, stripe);
    case "invoice.payment_failed":
      return applyInvoiceSubscription(sync, event.data.object, event.created, stripe);
    default:
      return { handled: false, reason: "ignored_type" };
  }
}

async function applySubscription(
  sync: SubscriptionSyncService,
  subscription: Stripe.Subscription,
  created: number,
): Promise<HandledEvent> {
  const outcome = await sync.applySubscription(toSubscriptionSnapshot(subscription, created));
  const summary = outcome.applied
    ? `subscription ${subscription.id} → ${outcome.status}`
    : `subscription ${subscription.id} skipped: ${outcome.reason}`;
  return { handled: true, summary };
}

/** A failed or paid invoice changes the subscription's status/period; Stripe has already updated it. */
async function applyInvoiceSubscription(
  sync: SubscriptionSyncService,
  invoice: Stripe.Invoice,
  created: number,
  stripe: SubscriptionFetcher,
): Promise<HandledEvent> {
  const snapshot = toInvoiceSnapshot(invoice);
  const id = snapshot?.stripeSubscriptionId ?? invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof id === "string" ? id : id?.id;
  if (!subscriptionId) return { handled: false, reason: "not_a_subscription" };
  return applySubscription(sync, await stripe.retrieveSubscription(subscriptionId), created);
}

async function applyPaidInvoice(
  sync: SubscriptionSyncService,
  invoice: Stripe.Invoice,
  created: number,
  stripe: SubscriptionFetcher,
): Promise<HandledEvent> {
  const snapshot = toInvoiceSnapshot(invoice);
  if (!snapshot) return { handled: false, reason: "not_a_subscription" };
  const subscriptionResult = await applyInvoiceSubscription(sync, invoice, created, stripe);
  const outcome = await sync.applyInvoice(snapshot);
  const paid = outcome.recorded
    ? `payment ${snapshot.stripeInvoiceId} recorded`
    : `payment ${snapshot.stripeInvoiceId} skipped: ${outcome.reason}`;
  const first = subscriptionResult.handled ? subscriptionResult.summary : "";
  return { handled: true, summary: `${first}; ${paid}` };
}
