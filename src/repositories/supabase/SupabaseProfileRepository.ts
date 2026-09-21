import { ExternalServiceError } from "@/engine/errors";
import type {
  BillingProfile,
  ProfileRepository,
} from "@/repositories/interfaces/ProfileRepository";
import type { Db } from "@/repositories/supabase/db";
import type { Database } from "@/types/database.types";

type Row = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "email" | "full_name" | "charity_id" | "charity_bps" | "stripe_customer_id"
>;

const COLUMNS = "id, email, full_name, charity_id, charity_bps, stripe_customer_id";

function toProfile(row: Row): BillingProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    charityId: row.charity_id,
    charityBps: row.charity_bps,
    stripeCustomerId: row.stripe_customer_id,
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: Db) {}

  async findById(userId: string): Promise<BillingProfile | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select(COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Profiles", error);
    return data ? toProfile(data) : null;
  }

  async findByStripeCustomerId(customerId: string): Promise<BillingProfile | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select(COLUMNS)
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Profiles", error);
    return data ? toProfile(data) : null;
  }

  async setStripeCustomerId(userId: string, customerId: string): Promise<void> {
    const { error } = await this.db
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
    if (error) throw new ExternalServiceError("Profiles", error);
  }
}
