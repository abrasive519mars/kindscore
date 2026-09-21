import { ExternalServiceError } from "@/engine/errors";
import type { SubscriptionStatus } from "@/engine/subscription/status";
import type { SubscriptionSnapshot } from "@/lib/stripe/snapshots";
import type {
  SubscriptionRecord,
  SubscriptionRepository,
  UpsertOutcome,
} from "@/repositories/interfaces/SubscriptionRepository";
import type { Db } from "@/repositories/supabase/db";
import type { Database } from "@/types/database.types";

type Row = Database["public"]["Tables"]["subscriptions"]["Row"];

function toRecord(row: Row): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    interval: row.plan_interval,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    lastEventAt: row.last_event_at,
  };
}

function isOlderThanStored(snapshot: SubscriptionSnapshot, stored: SubscriptionRecord | null) {
  if (!stored?.lastEventAt) return false;
  return new Date(snapshot.eventCreatedAt) < new Date(stored.lastEventAt);
}

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Db) {}

  async upsertFromSnapshot(
    userId: string,
    snapshot: SubscriptionSnapshot,
    status: SubscriptionStatus,
  ): Promise<UpsertOutcome> {
    // Read-then-write is enough here: Stripe retries serially and volume is tiny.
    const stored = await this.findByStripeId(snapshot.stripeSubscriptionId);
    if (isOlderThanStored(snapshot, stored)) return "stale";

    const { error } = await this.db.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_subscription_id: snapshot.stripeSubscriptionId,
        stripe_price_id: snapshot.stripePriceId,
        plan_interval: snapshot.interval,
        status,
        current_period_start: snapshot.currentPeriodStart,
        current_period_end: snapshot.currentPeriodEnd,
        cancel_at_period_end: snapshot.cancelAtPeriodEnd,
        canceled_at: snapshot.canceledAt,
        last_event_at: snapshot.eventCreatedAt,
        source: "stripe",
      },
      { onConflict: "stripe_subscription_id" },
    );
    if (error) throw new ExternalServiceError("Subscriptions", error);
    return "applied";
  }

  async findByStripeId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("*")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Subscriptions", error);
    return data ? toRecord(data) : null;
  }

  async findLiveForUser(userId: string): Promise<SubscriptionRecord | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "past_due"])
      .maybeSingle();
    if (error) throw new ExternalServiceError("Subscriptions", error);
    return data ? toRecord(data) : null;
  }
}
