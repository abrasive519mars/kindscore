import { beforeEach, describe, expect, it } from "vitest";
import { processWebhook, type WebhookDeps } from "@/lib/stripe/webhook";
import { SubscriptionSyncService } from "@/services/SubscriptionSyncService";
import {
  billingProfile,
  FakePaymentRepository,
  FakeProfileRepository,
  FakeStripeEventRepository,
  FakeSubscriptionRepository,
} from "../../../fakes/billing";
import {
  checkoutSessionObject,
  eventOf,
  invoiceObject,
  subscriptionObject,
} from "../../../fixtures/stripe";

/**
 * The webhook pipeline with fakes for storage and Stripe. Signature verification is replaced by
 * a JSON parse that throws on the literal body "bad" — the real constructEvent is exercised in
 * tests/integration/webhook.test.ts.
 */
let deps: WebhookDeps;
let events: FakeStripeEventRepository;
let subscriptions: FakeSubscriptionRepository;
let payments: FakePaymentRepository;
let retrieved: string[];

beforeEach(() => {
  events = new FakeStripeEventRepository();
  subscriptions = new FakeSubscriptionRepository();
  payments = new FakePaymentRepository();
  retrieved = [];
  const profiles = new FakeProfileRepository();
  profiles.profiles = [billingProfile({ stripeCustomerId: "cus_test_1" })];
  deps = {
    verify: (body) => {
      if (body === "bad") throw new Error("bad signature");
      return JSON.parse(body);
    },
    events,
    fetcher: {
      retrieveSubscription: async (id) => {
        retrieved.push(id);
        return subscriptionObject({ id });
      },
    },
    sync: new SubscriptionSyncService({ profiles, subscriptions, payments }),
  };
});

const post = (event: unknown, signature: string | null = "sig") =>
  processWebhook(JSON.stringify(event), signature, deps);

describe("processWebhook", () => {
  it("rejects a bad signature with 400 and touches nothing", async () => {
    const response = await processWebhook("bad", "sig", deps);
    expect(response.status).toBe(400);
    expect(events.claimed.size).toBe(0);
  });

  it("rejects a missing signature header", async () => {
    expect((await post(eventOf("invoice.paid", invoiceObject()), null)).status).toBe(400);
  });

  it("mirrors a subscription from customer.subscription.created without calling Stripe", async () => {
    const response = await post(eventOf("customer.subscription.created", subscriptionObject()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      handled: true,
      summary: "subscription sub_test_1 → active",
    });
    expect(subscriptions.rows).toHaveLength(1);
    expect(retrieved).toEqual([]);
  });

  it("retrieves the subscription for checkout.session.completed", async () => {
    await post(eventOf("checkout.session.completed", checkoutSessionObject("sub_from_checkout")));
    expect(retrieved).toEqual(["sub_from_checkout"]);
    expect(subscriptions.rows[0].stripeSubscriptionId).toBe("sub_from_checkout");
  });

  it("ignores a checkout session with no subscription (a one-off payment)", async () => {
    const response = await post(eventOf("checkout.session.completed", checkoutSessionObject(null)));
    expect(await response.json()).toMatchObject({ handled: false, reason: "not_a_subscription" });
  });

  it("records the payment and refreshes the subscription on invoice.paid", async () => {
    await post(eventOf("invoice.paid", invoiceObject()));
    expect(retrieved).toEqual(["sub_test_1"]);
    expect(subscriptions.rows).toHaveLength(1);
    expect(payments.rows).toHaveLength(1);
  });

  it("answers 200 and does nothing for a replayed event id", async () => {
    const event = eventOf("invoice.paid", invoiceObject());
    await post(event);
    const replay = await post(event);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ received: true, duplicate: true });
    expect(payments.rows).toHaveLength(1);
    expect(events.processed).toHaveLength(1);
  });

  it("ignores event types it does not subscribe to", async () => {
    const response = await post(eventOf("customer.created", { id: "cus_x", object: "customer" }));
    expect(await response.json()).toMatchObject({ handled: false, reason: "ignored_type" });
    expect(events.processed).toHaveLength(1);
  });
});
