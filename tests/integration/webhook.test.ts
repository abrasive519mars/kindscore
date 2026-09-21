import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processWebhook, type WebhookDeps } from "@/lib/stripe/webhook";
import { SupabaseDonationRepository } from "@/repositories/supabase/SupabaseDonationRepository";
import { SupabasePaymentRepository } from "@/repositories/supabase/SupabasePaymentRepository";
import { SupabaseProfileRepository } from "@/repositories/supabase/SupabaseProfileRepository";
import { SupabaseStripeEventRepository } from "@/repositories/supabase/SupabaseStripeEventRepository";
import { SupabaseSubscriptionRepository } from "@/repositories/supabase/SupabaseSubscriptionRepository";
import { SubscriptionSyncService } from "@/services/SubscriptionSyncService";
import {
  eventOf,
  invoiceObject,
  subscriptionObject,
  UNIX_2026_09_01,
  type SubscriptionOverrides,
} from "../fixtures/stripe";
import { admin, CHARITY, createUser, deleteUser, type TestUser } from "./setup";

/**
 * The webhook end to end against real Postgres: real signature check (Stripe's own signing
 * helper, an arbitrary secret), real service-role repositories, real triggers and RLS functions.
 * Only the one Stripe *retrieve* is stubbed, so the suite runs offline.
 */
const WEBHOOK_SECRET = "whsec_integration_test_secret";
const stripe = new Stripe("sk_test_not_used_offline");

let member: TestUser;
let customerId: string;
let subscriptionId: string;
let deps: WebhookDeps;

beforeAll(async () => {
  member = await createUser("member", CHARITY.udaan);
  customerId = `cus_${member.id.slice(0, 8)}`;
  subscriptionId = `sub_${member.id.slice(0, 8)}`;
  deps = {
    verify: (body, signature) => stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET),
    events: new SupabaseStripeEventRepository(admin),
    fetcher: { retrieveSubscription: async (id) => subscription({ id }) },
    donations: new SupabaseDonationRepository(admin),
    sync: new SubscriptionSyncService({
      subscriptions: new SupabaseSubscriptionRepository(admin),
      payments: new SupabasePaymentRepository(admin),
      profiles: new SupabaseProfileRepository(admin),
    }),
  };
});

afterAll(async () => {
  await deleteUser(member);
});

function subscription(overrides: SubscriptionOverrides = {}) {
  return subscriptionObject({
    id: subscriptionId,
    customer: customerId,
    userId: member.id,
    ...overrides,
  });
}

/** Signs the body exactly as Stripe would and runs the pipeline. */
async function deliver(event: Stripe.Event, signature?: string) {
  const payload = JSON.stringify(event);
  const header =
    signature ?? stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const response = await processWebhook(payload, header, deps);
  return { status: response.status, body: await response.json() };
}

async function storedSubscription() {
  const { data } = await admin
    .from("subscriptions")
    .select("status, plan_interval, current_period_end, cancel_at_period_end, last_event_at")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return data;
}

async function hasAccess() {
  const { data } = await admin.rpc("has_active_access", { uid: member.id });
  return data;
}

describe("Stripe webhook against the real database", () => {
  it("refuses a body signed with the wrong secret and writes nothing", async () => {
    const event = eventOf("customer.subscription.created", subscription());
    const forged = stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(event),
      secret: "whsec_someone_else",
    });
    expect((await deliver(event, forged)).status).toBe(400);
    const { count } = await admin
      .from("stripe_events")
      .select("id", { count: "exact", head: true })
      .eq("id", event.id);
    expect(count).toBe(0);
  });

  it("activates the member from customer.subscription.created and stores the customer id", async () => {
    const created = UNIX_2026_09_01 + 10;
    const { status, body } = await deliver(
      eventOf("customer.subscription.created", subscription(), created),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ handled: true });
    const stored = await storedSubscription();
    expect(stored).toMatchObject({
      status: "active",
      plan_interval: "month",
      cancel_at_period_end: false,
    });
    expect(new Date(stored!.last_event_at!).getTime()).toBe(created * 1000);
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", member.id)
      .single();
    expect(profile?.stripe_customer_id).toBe(customerId);
  });

  it("invoice.paid writes exactly one payment and one ledger row with the split", async () => {
    const invoice = invoiceObject({
      id: `in_${member.id.slice(0, 8)}`,
      customer: customerId,
      subscriptionId,
    });
    const { status } = await deliver(eventOf("invoice.paid", invoice, UNIX_2026_09_01 + 20));
    expect(status).toBe(200);
    const { data: payments } = await admin.from("payments").select("*").eq("user_id", member.id);
    expect(payments).toHaveLength(1);
    expect(payments![0]).toMatchObject({
      amount_paise: 49_900,
      charity_id: CHARITY.udaan,
      charity_bps: 1000,
      charity_paise: 4_990,
      pool_paise: 14_970,
      platform_paise: 29_940,
    });
    const { data: ledger } = await admin
      .from("charity_contributions")
      .select("amount_paise")
      .eq("user_id", member.id);
    expect(ledger).toEqual([{ amount_paise: 4_990 }]);
  });

  it("replaying the same event id answers 200 and changes nothing", async () => {
    const invoice = invoiceObject({
      id: `in_${member.id.slice(0, 8)}`,
      customer: customerId,
      subscriptionId,
    });
    const event = eventOf("invoice.paid", invoice, UNIX_2026_09_01 + 30);
    await deliver(event);
    const replay = await deliver(event);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ received: true, duplicate: true });
    const { count } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", member.id);
    expect(count).toBe(1);
  });

  it("an event older than the stored one is ignored", async () => {
    const stale = eventOf(
      "customer.subscription.updated",
      subscription({ status: "unpaid" }),
      UNIX_2026_09_01 + 5,
    );
    const { body } = await deliver(stale);
    expect(body.summary).toMatch(/skipped: stale/);
    expect((await storedSubscription())?.status).toBe("active");
  });

  it("invoice.payment_failed → past_due, and the database gate closes at once", async () => {
    deps = {
      ...deps,
      fetcher: { retrieveSubscription: async () => subscription({ status: "past_due" }) },
    };
    const invoice = invoiceObject({
      id: "in_failed",
      customer: customerId,
      subscriptionId,
      amountPaid: 0,
    });
    await deliver(eventOf("invoice.payment_failed", invoice, UNIX_2026_09_01 + 40));
    expect((await storedSubscription())?.status).toBe("past_due");
    expect(await hasAccess()).toBe(false);
  });

  it("customer.subscription.deleted → cancelled when the member had chosen to end it", async () => {
    const ended = subscription({
      status: "canceled",
      cancelAtPeriodEnd: true,
      canceledAt: UNIX_2026_09_01,
    });
    await deliver(eventOf("customer.subscription.deleted", ended, UNIX_2026_09_01 + 50));
    expect((await storedSubscription())?.status).toBe("cancelled");
    expect(await hasAccess()).toBe(false);
  });

  it("a subscription for a customer we do not know is acknowledged, not stored", async () => {
    const stranger = subscriptionObject({
      id: "sub_stranger",
      customer: "cus_stranger",
      userId: null,
    });
    const { status, body } = await deliver(eventOf("customer.subscription.created", stranger));
    expect(status).toBe(200);
    expect(body.summary).toMatch(/unknown_customer/);
    const { data } = await admin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", "sub_stranger");
    expect(data).toEqual([]);
  });
});
