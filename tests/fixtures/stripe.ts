import type Stripe from "stripe";

/**
 * Minimal but shape-faithful Stripe objects for the current API version (2026-08-26.dahlia):
 * period dates on the subscription item, invoice's subscription under parent.subscription_details.
 * Only the fields our snapshots read are filled; the casts are deliberate — a full Stripe object
 * has hundreds of fields no test cares about.
 */

export const UNIX_2026_09_01 = 1_788_220_800; // 2026-09-01T00:00:00Z
export const UNIX_2026_10_01 = 1_790_812_800; // 2026-10-01T00:00:00Z

export interface SubscriptionOverrides {
  id?: string;
  customer?: string;
  priceId?: string;
  interval?: "month" | "year";
  status?: Stripe.Subscription.Status;
  userId?: string | null;
  periodStart?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: number | null;
}

export function subscriptionObject(o: SubscriptionOverrides = {}): Stripe.Subscription {
  const interval = o.interval ?? "month";
  const item = {
    id: "si_test",
    object: "subscription_item",
    current_period_start: o.periodStart ?? UNIX_2026_09_01,
    current_period_end: o.periodEnd ?? UNIX_2026_10_01,
    price: {
      id: o.priceId ?? "price_monthly_test",
      object: "price",
      recurring: { interval, interval_count: 1 },
    },
  };
  return {
    id: o.id ?? "sub_test_1",
    object: "subscription",
    customer: o.customer ?? "cus_test_1",
    status: o.status ?? "active",
    cancel_at_period_end: o.cancelAtPeriodEnd ?? false,
    canceled_at: o.canceledAt ?? null,
    metadata: o.userId === null ? {} : { user_id: o.userId ?? "user_test_1" },
    items: { object: "list", data: [item], has_more: false, url: "" },
  } as unknown as Stripe.Subscription;
}

export interface InvoiceOverrides {
  id?: string;
  customer?: string;
  subscriptionId?: string | null;
  amountPaid?: number;
  paidAt?: number;
}

export function invoiceObject(o: InvoiceOverrides = {}): Stripe.Invoice {
  const subscriptionId = o.subscriptionId === undefined ? "sub_test_1" : o.subscriptionId;
  return {
    id: o.id ?? "in_test_1",
    object: "invoice",
    customer: o.customer ?? "cus_test_1",
    amount_paid: o.amountPaid ?? 49_900,
    created: o.paidAt ?? UNIX_2026_09_01,
    status_transitions: { paid_at: o.paidAt ?? UNIX_2026_09_01 },
    parent: subscriptionId
      ? { type: "subscription_details", subscription_details: { subscription: subscriptionId } }
      : null,
  } as unknown as Stripe.Invoice;
}

export function checkoutSessionObject(subscriptionId: string | null, userId = "user_test_1") {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    mode: "subscription",
    status: "complete",
    client_reference_id: userId,
    customer: "cus_test_1",
    subscription: subscriptionId,
  } as unknown as Stripe.Checkout.Session;
}

let eventSeq = 0;
const runId = Math.random().toString(36).slice(2, 8);

/**
 * A webhook event wrapping any object. `created` defaults to a fresh, increasing timestamp; ids
 * carry a per-process random part so integration runs never collide with rows from a past run.
 */
export function eventOf<T extends Stripe.Event.Type>(
  type: T,
  object: unknown,
  created = UNIX_2026_09_01 + ++eventSeq,
): Stripe.Event {
  return {
    id: `evt_${runId}_${type.replace(/\./g, "_")}_${created}_${eventSeq}`,
    object: "event",
    type,
    created,
    api_version: "2026-08-26.dahlia",
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: { object },
  } as unknown as Stripe.Event;
}
