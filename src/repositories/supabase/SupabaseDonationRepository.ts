import { ExternalServiceError } from "@/engine/errors";
import type {
  ContributionRecord,
  DonationRecord,
  DonationRepository,
  DonationWrite,
  MarkPaidOutcome,
} from "@/repositories/interfaces/DonationRepository";
import type { Db } from "@/repositories/supabase/db";
import type { Database } from "@/types/database.types";

type Row = Database["public"]["Tables"]["donations"]["Row"];

function toRecord(row: Row): DonationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    charityId: row.charity_id,
    amountPaise: row.amount_paise,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    paid: row.paid,
    createdAt: row.created_at,
  };
}

/**
 * Member client for create/list (RLS: own rows, unpaid inserts only); service-role client for
 * markPaid — the one write that moves money into the ledger.
 */
export class SupabaseDonationRepository implements DonationRepository {
  constructor(private readonly db: Db) {}

  async create(write: DonationWrite): Promise<DonationRecord> {
    const { data, error } = await this.db
      .from("donations")
      .insert({
        id: write.id,
        user_id: write.userId,
        charity_id: write.charityId,
        amount_paise: write.amountPaise,
        stripe_checkout_session_id: write.stripeCheckoutSessionId,
        paid: false,
      })
      .select("*")
      .single();
    if (error) throw new ExternalServiceError("Donations", error);
    return toRecord(data);
  }

  async markPaid(id: string): Promise<MarkPaidOutcome> {
    const existing = await this.findById(id);
    if (!existing) return "not_found";
    if (existing.paid) return "already_paid";
    const { error } = await this.db
      .from("donations")
      .update({ paid: true })
      .eq("id", id)
      .eq("paid", false);
    if (error) throw new ExternalServiceError("Donations", error);
    return "paid";
  }

  async findById(id: string): Promise<DonationRecord | null> {
    const { data, error } = await this.db.from("donations").select("*").eq("id", id).maybeSingle();
    if (error) throw new ExternalServiceError("Donations", error);
    return data ? toRecord(data) : null;
  }

  async listForUser(userId: string): Promise<DonationRecord[]> {
    const { data, error } = await this.db
      .from("donations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new ExternalServiceError("Donations", error);
    return data.map(toRecord);
  }

  /** The ledger, joined to charity names — every rupee this member has directed anywhere. */
  async listContributionsForUser(userId: string): Promise<ContributionRecord[]> {
    const { data, error } = await this.db
      .from("charity_contributions")
      .select("id, charity_id, source, amount_paise, created_at, charities!inner(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new ExternalServiceError("Donations", error);
    return data.map((row) => ({
      id: row.id,
      charityId: row.charity_id,
      charityName: row.charities.name,
      source: row.source,
      amountPaise: row.amount_paise,
      createdAt: row.created_at,
    }));
  }
}
