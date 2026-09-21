import type { SubscriptionStatus } from "@/engine/subscription/status";
import type {
  BillingGateway,
  CheckoutRequest,
  CompletedCheckout,
} from "@/lib/stripe/BillingGateway";
import type { SubscriptionSnapshot } from "@/lib/stripe/snapshots";
import type { PaymentRepository, PaymentWrite } from "@/repositories/interfaces/PaymentRepository";
import type {
  BillingProfile,
  ProfileRepository,
} from "@/repositories/interfaces/ProfileRepository";
import type { StripeEventRepository } from "@/repositories/interfaces/StripeEventRepository";
import type {
  SubscriptionRecord,
  SubscriptionRepository,
  UpsertOutcome,
} from "@/repositories/interfaces/SubscriptionRepository";

/** In-memory doubles for every billing port. Each records what was asked of it. */

export class FakeProfileRepository implements ProfileRepository {
  profiles: BillingProfile[] = [];
  customerIdWrites: Array<{ userId: string; customerId: string }> = [];

  async findById(userId: string) {
    return this.profiles.find((p) => p.id === userId) ?? null;
  }
  async findByStripeCustomerId(customerId: string) {
    return this.profiles.find((p) => p.stripeCustomerId === customerId) ?? null;
  }
  async setStripeCustomerId(userId: string, customerId: string) {
    this.customerIdWrites.push({ userId, customerId });
    this.profiles = this.profiles.map((p) =>
      p.id === userId ? { ...p, stripeCustomerId: customerId } : p,
    );
  }
}

export class FakeSubscriptionRepository implements SubscriptionRepository {
  rows: SubscriptionRecord[] = [];
  private seq = 0;

  async upsertFromSnapshot(
    userId: string,
    snapshot: SubscriptionSnapshot,
    status: SubscriptionStatus,
  ): Promise<UpsertOutcome> {
    const existing = this.rows.find(
      (r) => r.stripeSubscriptionId === snapshot.stripeSubscriptionId,
    );
    if (existing?.lastEventAt && snapshot.eventCreatedAt < existing.lastEventAt) return "stale";
    const record: SubscriptionRecord = {
      id: existing?.id ?? `sub-row-${++this.seq}`,
      userId,
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      status,
      interval: snapshot.interval,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      lastEventAt: snapshot.eventCreatedAt,
    };
    this.rows = [...this.rows.filter((r) => r.id !== record.id), record];
    return "applied";
  }
  async findByStripeId(id: string) {
    return this.rows.find((r) => r.stripeSubscriptionId === id) ?? null;
  }
  async findLiveForUser(userId: string) {
    return (
      this.rows.find(
        (r) => r.userId === userId && (r.status === "active" || r.status === "past_due"),
      ) ?? null
    );
  }
}

export class FakePaymentRepository implements PaymentRepository {
  rows: PaymentWrite[] = [];
  async recordIfNew(write: PaymentWrite) {
    if (this.rows.some((r) => r.stripeInvoiceId === write.stripeInvoiceId)) return false;
    this.rows.push(write);
    return true;
  }
}

export class FakeStripeEventRepository implements StripeEventRepository {
  claimed = new Map<string, string>();
  processed: string[] = [];
  async claim(id: string, type: string) {
    if (this.claimed.has(id)) return false;
    this.claimed.set(id, type);
    return true;
  }
  async markProcessed(id: string) {
    this.processed.push(id);
  }
}

export class FakeBillingGateway implements BillingGateway {
  checkoutRequests: CheckoutRequest[] = [];
  portalCustomers: string[] = [];
  cancelCalls: Array<{ id: string; cancel: boolean }> = [];
  completedCheckouts = new Map<string, CompletedCheckout>();
  snapshotForCancel: (id: string, cancel: boolean) => SubscriptionSnapshot = () => {
    throw new Error("snapshotForCancel not configured");
  };

  async createCheckoutSession(request: CheckoutRequest) {
    this.checkoutRequests.push(request);
    return { url: `https://checkout.stripe.test/${request.priceId}` };
  }
  async retrieveCompletedCheckout(sessionId: string) {
    return this.completedCheckouts.get(sessionId) ?? null;
  }
  async createPortalSession(customerId: string) {
    this.portalCustomers.push(customerId);
    return { url: `https://portal.stripe.test/${customerId}` };
  }
  async setCancelAtPeriodEnd(id: string, cancel: boolean) {
    this.cancelCalls.push({ id, cancel });
    return this.snapshotForCancel(id, cancel);
  }
}

export function billingProfile(overrides: Partial<BillingProfile> = {}): BillingProfile {
  return {
    id: "user_test_1",
    email: "member@kindscore.test",
    fullName: "Test Member",
    charityId: "charity_1",
    charityBps: 1000,
    stripeCustomerId: null,
    ...overrides,
  };
}
