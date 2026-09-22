import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/engine/errors";
import { toInvoiceSnapshot, toSubscriptionSnapshot } from "@/lib/stripe/snapshots";
import { CheckoutService } from "@/services/CheckoutService";
import { SubscriptionSyncService } from "@/services/SubscriptionSyncService";
import {
  billingProfile,
  FakeBillingGateway,
  FakePaymentRepository,
  FakeProfileRepository,
  FakeSubscriptionRepository,
} from "../../fakes/billing";
import { invoiceObject, subscriptionObject, UNIX_2026_09_01 } from "../../fixtures/stripe";

const PRICES = { month: "price_month", year: "price_year" };

let gateway: FakeBillingGateway;
let profiles: FakeProfileRepository;
let subscriptions: FakeSubscriptionRepository;
let payments: FakePaymentRepository;
let service: CheckoutService;

beforeEach(() => {
  gateway = new FakeBillingGateway();
  profiles = new FakeProfileRepository();
  subscriptions = new FakeSubscriptionRepository();
  payments = new FakePaymentRepository();
  const sync = new SubscriptionSyncService({ profiles, subscriptions, payments });
  service = new CheckoutService({ gateway, profiles, subscriptions, sync, priceIds: PRICES });
});

describe("startCheckout", () => {
  it("refuses a second checkout while a subscription is live (past_due included)", async () => {
    profiles.profiles = [billingProfile()];
    subscriptions.rows = [
      {
        id: "row-live",
        userId: "user_test_1",
        stripeSubscriptionId: "sub_live",
        status: "past_due",
        interval: "month",
        currentPeriodEnd: "2026-10-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        lastEventAt: null,
      },
    ];
    await expect(service.startCheckout("user_test_1", "month")).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(gateway.checkoutRequests).toEqual([]);
  });

  it("sends the member to Stripe with the right price and their identity attached", async () => {
    profiles.profiles = [billingProfile()];
    const { url } = await service.startCheckout("user_test_1", "year");
    expect(url).toBe("https://checkout.stripe.test/price_year");
    expect(gateway.checkoutRequests[0]).toEqual({
      userId: "user_test_1",
      email: "member@kindscore.test",
      customerId: null,
      priceId: "price_year",
      interval: "year",
    });
  });

  it("reuses an existing Stripe customer", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_existing" })];
    await service.startCheckout("user_test_1", "month");
    expect(gateway.checkoutRequests[0].customerId).toBe("cus_existing");
  });

  it("fails cleanly when the profile is missing", async () => {
    await expect(service.startCheckout("ghost", "month")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("syncAfterCheckout", () => {
  const snapshot = toSubscriptionSnapshot(subscriptionObject(), UNIX_2026_09_01);
  const invoice = toInvoiceSnapshot(invoiceObject());

  it("mirrors the subscription and records the first payment from a completed session", async () => {
    profiles.profiles = [billingProfile()];
    gateway.completedCheckouts.set("cs_1", {
      userId: "user_test_1",
      customerId: "cus_test_1",
      subscription: snapshot,
      invoice,
    });
    const outcome = await service.syncAfterCheckout("user_test_1", "cs_1");
    expect(outcome).toMatchObject({ applied: true, status: "active" });
    expect(subscriptions.rows).toHaveLength(1);
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0].split).toEqual({
      charityPaise: 4_990,
      poolPaise: 14_970,
      platformPaise: 29_940,
    });
  });

  it("does not record the payment twice when the webhook got there first", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
    await payments.recordIfNew({
      ...invoice!,
      userId: "user_test_1",
      subscriptionId: null,
      charityId: "c",
      charityBps: 1000,
      split: { charityPaise: 0, poolPaise: 0, platformPaise: 0 },
    });
    gateway.completedCheckouts.set("cs_1", {
      userId: "user_test_1",
      customerId: "cus_test_1",
      subscription: snapshot,
      invoice,
    });
    await service.syncAfterCheckout("user_test_1", "cs_1");
    expect(payments.rows).toHaveLength(1);
  });

  it("refuses a session that belongs to another member", async () => {
    gateway.completedCheckouts.set("cs_1", {
      userId: "someone_else",
      customerId: null,
      subscription: snapshot,
      invoice: null,
    });
    await expect(service.syncAfterCheckout("user_test_1", "cs_1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("returns null while the session is not complete yet", async () => {
    expect(await service.syncAfterCheckout("user_test_1", "cs_unknown")).toBeNull();
  });
});

describe("cancel / resume", () => {
  beforeEach(async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
    await subscriptions.upsertFromSnapshot(
      "user_test_1",
      toSubscriptionSnapshot(subscriptionObject(), UNIX_2026_09_01),
      "active",
    );
    gateway.snapshotForCancel = (id, cancel) =>
      toSubscriptionSnapshot(
        subscriptionObject({ id, cancelAtPeriodEnd: cancel }),
        UNIX_2026_09_01 + 10,
      );
  });

  it("flags the live subscription and mirrors the result at once", async () => {
    await service.setCancelAtPeriodEnd("user_test_1", true);
    expect(gateway.cancelCalls).toEqual([{ id: "sub_test_1", cancel: true }]);
    expect(subscriptions.rows[0]).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
  });

  it("resumes the same way", async () => {
    await service.setCancelAtPeriodEnd("user_test_1", true);
    await service.setCancelAtPeriodEnd("user_test_1", false);
    expect(subscriptions.rows[0].cancelAtPeriodEnd).toBe(false);
  });

  it("refuses when there is nothing live to cancel", async () => {
    await expect(service.setCancelAtPeriodEnd("nobody", true)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(gateway.cancelCalls).toEqual([]);
  });
});

describe("openBillingPortal", () => {
  it("opens the portal for the member's own customer", async () => {
    profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
    expect(await service.openBillingPortal("user_test_1")).toEqual({
      url: "https://portal.stripe.test/cus_test_1",
    });
  });

  it("refuses before the member has ever paid", async () => {
    profiles.profiles = [billingProfile()];
    await expect(service.openBillingPortal("user_test_1")).rejects.toBeInstanceOf(NotFoundError);
  });
});
