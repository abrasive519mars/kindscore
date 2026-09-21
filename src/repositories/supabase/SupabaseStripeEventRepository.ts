import { ExternalServiceError } from "@/engine/errors";
import type { StripeEventRepository } from "@/repositories/interfaces/StripeEventRepository";
import { PG_UNIQUE_VIOLATION, type Db } from "@/repositories/supabase/db";

export class SupabaseStripeEventRepository implements StripeEventRepository {
  constructor(private readonly db: Db) {}

  async claim(eventId: string, type: string): Promise<boolean> {
    const { error } = await this.db.from("stripe_events").insert({ id: eventId, type });
    if (!error) return true;
    if (error.code === PG_UNIQUE_VIOLATION) return false;
    throw new ExternalServiceError("Stripe events", error);
  }

  async markProcessed(eventId: string): Promise<void> {
    const { error } = await this.db
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) throw new ExternalServiceError("Stripe events", error);
  }
}
