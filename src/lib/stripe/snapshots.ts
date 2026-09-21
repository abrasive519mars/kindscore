import type Stripe from "stripe";
import type { PlanInterval } from "@/config/constants";

/**
 * Plain, Stripe-free descriptions of the two objects the app mirrors. Everything downstream
 * (services, repositories, tests) sees these — never a raw Stripe object. This file is the only
 * place that knows where Stripe keeps each field in the current API version:
 *   - period dates live on the subscription *item*, not the subscription (2025-03+)
 *   - an invoice's subscription id lives under `parent.subscription_details` (2025-03+)
 */

export interface SubscriptionSnapshot {
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string;
  readonly stripePriceId: string;
  /** From `metadata.user_id`, set by our checkout. Null for subscriptions created elsewhere. */
  readonly userId: string | null;
  readonly stripeStatus: string;
  readonly interval: PlanInterval;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: string | null;
  /** `event.created` of the webhook this came from — the ordering guard. */
  readonly eventCreatedAt: string;
}

export interface InvoiceSnapshot {
  readonly stripeInvoiceId: string;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly amountPaise: number;
  readonly paidAt: string;
}

function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

function toInterval(price: Stripe.Price): PlanInterval {
  const interval: string | undefined = price.recurring?.interval;
  if (interval === "month" || interval === "year") return interval;
  throw new Error(`Unsupported billing interval on price ${price.id}: ${interval}`);
}

/** The single subscription item our prices create; anything else is not a Kindscore subscription. */
function primaryItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem {
  const item = subscription.items.data[0];
  if (!item) throw new Error(`Subscription ${subscription.id} has no items`);
  return item;
}

export function toSubscriptionSnapshot(
  subscription: Stripe.Subscription,
  eventCreated: number,
): SubscriptionSnapshot {
  const item = primaryItem(subscription);
  const customerId = idOf(subscription.customer);
  if (!customerId) throw new Error(`Subscription ${subscription.id} has no customer`);
  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    stripePriceId: item.price.id,
    userId: subscription.metadata?.user_id ?? null,
    stripeStatus: subscription.status,
    interval: toInterval(item.price),
    currentPeriodStart: unixToIso(item.current_period_start),
    currentPeriodEnd: unixToIso(item.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? unixToIso(subscription.canceled_at) : null,
    eventCreatedAt: unixToIso(eventCreated),
  };
}

/** Null when the invoice is not a paid subscription invoice (e.g. a one-off donation, or ₹0). */
export function toInvoiceSnapshot(invoice: Stripe.Invoice): InvoiceSnapshot | null {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  const customerId = idOf(invoice.customer);
  if (!subscriptionId || !customerId || invoice.amount_paid <= 0) return null;
  return {
    stripeInvoiceId: invoice.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    amountPaise: invoice.amount_paid,
    paidAt: unixToIso(invoice.status_transitions?.paid_at ?? invoice.created),
  };
}
