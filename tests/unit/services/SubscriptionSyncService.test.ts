import { beforeEach, describe, expect, it } from "vitest";
import { toInvoiceSnapshot, toSubscriptionSnapshot } from "@/lib/stripe/snapshots";
import { SubscriptionSyncService } from "@/services/SubscriptionSyncService";
import {
  billingProfile,
  FakePaymentRepository,
  FakeProfileRepository,
  FakeSubscriptionRepository,
} from "../../fakes/billing";
import { invoiceObject, subscriptionObject, UNIX_2026_09_01 } from "../../fixtures/stripe";

let profiles: FakeProfileRepository;
let subscriptions: FakeSubscriptionRepository;
let payments: FakePaymentRepository;
let service: SubscriptionSyncService;

beforeEach(() => {
  profiles = new FakeProfileRepository();
  subscriptions = new FakeSubscriptionRepository();
  payments = new FakePaymentRepository();
  service = new SubscriptionSyncService({ profiles, subscriptions, payments });
});

const snap = (overrides = {}, created = UNIX_2026_09_01) =>
  toSubscriptionSnapshot(subscriptionObject(overrides), created);

describe("applySubscription", () => {
  it("mirrors an active subscription and remembers the Stripe customer", async () => {
    profiles.profiles = [billingProfile()];
    const outcome = await service.applySubscription(snap());
    expect(outcome).toEqual({ applied: true, userId: "user_test_1", status: "active" });
    expect(subscriptions.rows).toHaveLength(1);
    expect(subscriptions.rows[0]).toMatchObject({ status: "active", interval: "month" });
    expect(profiles.customerIdWrites).toEqual([
      { userId: "user_test_1", customerId: "cus_test_1" },
    ]);
  });

  it("does not rewrite a customer id that is already stored", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
    await service.applySubscription(snap());
    expect(profiles.customerIdWrites).toEqual([]);
  });

  it.each([
    ["past_due", "past_due"],
    ["canceled", "cancelled"],
    ["unpaid", "lapsed"],
    ["incomplete_expired", "lapsed"],
    ["trialing", "active"],
  ])("translates Stripe status %s → %s", async (stripeStatus, ours) => {
    profiles.profiles = [billingProfile()];
    const outcome = await service.applySubscription(snap({ status: stripeStatus as "active" }));
    expect(outcome).toMatchObject({ applied: true, status: ours });
  });

  it("matches by customer id when the subscription carries no user metadata", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
    const outcome = await service.applySubscription(snap({ userId: null }));
    expect(outcome).toMatchObject({ applied: true, userId: "user_test_1" });
  });

  it("prefers the user in metadata over the customer lookup", async () => {
    profiles.profiles = [
      billingProfile({ id: "user_meta" }),
      billingProfile({ id: "user_cus", stripeCustomerId: "cus_test_1" }),
    ];
    const outcome = await service.applySubscription(snap({ userId: "user_meta" }));
    expect(outcome).toMatchObject({ applied: true, userId: "user_meta" });
  });

  it("reports an unknown customer instead of failing", async () => {
    const outcome = await service.applySubscription(snap());
    expect(outcome).toEqual({ applied: false, reason: "unknown_customer" });
    expect(subscriptions.rows).toEqual([]);
  });

  it("ignores an event older than the one already mirrored", async () => {
    profiles.profiles = [billingProfile()];
    await service.applySubscription(snap({ status: "canceled" }, UNIX_2026_09_01 + 100));
    const stale = await service.applySubscription(snap({ status: "active" }, UNIX_2026_09_01 + 50));
    expect(stale).toEqual({ applied: false, reason: "stale" });
    expect(subscriptions.rows[0].status).toBe("cancelled");
  });
});

describe("applyInvoice", () => {
  const invoice = () => toInvoiceSnapshot(invoiceObject())!;

  it("records one payment with the exact three-way split and the charity frozen", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1", charityBps: 1000 })];
    await service.applySubscription(snap());
    const outcome = await service.applyInvoice(invoice());
    expect(outcome).toEqual({ recorded: true, userId: "user_test_1" });
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0]).toMatchObject({
      subscriptionId: subscriptions.rows[0].id,
      stripeInvoiceId: "in_test_1",
      amountPaise: 49_900,
      charityId: "charity_1",
      charityBps: 1000,
      split: { charityPaise: 4_990, poolPaise: 14_970, platformPaise: 29_940 },
    });
  });

  it("uses the member's current percentage — 70% leaves the platform nothing", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1", charityBps: 7000 })];
    await service.applyInvoice(invoice());
    expect(payments.rows[0].split).toEqual({
      charityPaise: 34_930,
      poolPaise: 14_970,
      platformPaise: 0,
    });
  });

  it("is a no-op for a replayed invoice", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
    await service.applyInvoice(invoice());
    expect(await service.applyInvoice(invoice())).toEqual({ recorded: false, reason: "duplicate" });
    expect(payments.rows).toHaveLength(1);
  });

  it("reports an unknown customer", async () => {
    expect(await service.applyInvoice(invoice())).toEqual({
      recorded: false,
      reason: "unknown_customer",
    });
  });

  it("refuses to record a payment for a member with no charity chosen", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1", charityId: null })];
    expect(await service.applyInvoice(invoice())).toEqual({
      recorded: false,
      reason: "no_charity",
    });
  });
});
