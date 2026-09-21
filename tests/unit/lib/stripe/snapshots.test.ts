import { describe, expect, it } from "vitest";
import { toInvoiceSnapshot, toSubscriptionSnapshot } from "@/lib/stripe/snapshots";
import {
  invoiceObject,
  subscriptionObject,
  UNIX_2026_09_01,
  UNIX_2026_10_01,
} from "../../../fixtures/stripe";

describe("toSubscriptionSnapshot", () => {
  it("reads period dates from the subscription item and the interval from its price", () => {
    const snapshot = toSubscriptionSnapshot(subscriptionObject(), UNIX_2026_09_01 + 5);
    expect(snapshot).toEqual({
      stripeSubscriptionId: "sub_test_1",
      stripeCustomerId: "cus_test_1",
      stripePriceId: "price_monthly_test",
      userId: "user_test_1",
      stripeStatus: "active",
      interval: "month",
      currentPeriodStart: "2026-09-01T00:00:00.000Z",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      canceledAt: null,
      eventCreatedAt: "2026-09-01T00:00:05.000Z",
    });
  });

  it("keeps cancel-at-period-end and the cancellation time", () => {
    const snapshot = toSubscriptionSnapshot(
      subscriptionObject({ cancelAtPeriodEnd: true, canceledAt: UNIX_2026_09_01 + 60 }),
      UNIX_2026_09_01,
    );
    expect(snapshot.cancelAtPeriodEnd).toBe(true);
    expect(snapshot.canceledAt).toBe("2026-09-01T00:01:00.000Z");
  });

  it("has no user when the subscription was not created by our checkout", () => {
    expect(toSubscriptionSnapshot(subscriptionObject({ userId: null }), 1).userId).toBeNull();
  });

  it("accepts a customer given as an expanded object", () => {
    const sub = subscriptionObject();
    (sub as { customer: unknown }).customer = { id: "cus_expanded", object: "customer" };
    expect(toSubscriptionSnapshot(sub, 1).stripeCustomerId).toBe("cus_expanded");
  });

  it("refuses an interval we do not sell", () => {
    const sub = subscriptionObject();
    (sub.items.data[0].price.recurring as { interval: string }).interval = "week";
    expect(() => toSubscriptionSnapshot(sub, 1)).toThrow(/Unsupported billing interval/);
  });
});

describe("toInvoiceSnapshot", () => {
  it("maps a paid subscription invoice", () => {
    expect(toInvoiceSnapshot(invoiceObject())).toEqual({
      stripeInvoiceId: "in_test_1",
      stripeCustomerId: "cus_test_1",
      stripeSubscriptionId: "sub_test_1",
      amountPaise: 49_900,
      paidAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("is null for an invoice with no subscription (a one-off donation)", () => {
    expect(toInvoiceSnapshot(invoiceObject({ subscriptionId: null }))).toBeNull();
  });

  it("is null when nothing was actually paid", () => {
    expect(toInvoiceSnapshot(invoiceObject({ amountPaid: 0 }))).toBeNull();
  });

  it("falls back to the invoice's created time when paid_at is missing", () => {
    const invoice = invoiceObject({ paidAt: UNIX_2026_10_01 });
    (invoice as { status_transitions: unknown }).status_transitions = { paid_at: null };
    expect(toInvoiceSnapshot(invoice)?.paidAt).toBe("2026-10-01T00:00:00.000Z");
  });
});
