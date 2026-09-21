import { ExternalServiceError } from "@/engine/errors";
import type { PaymentRepository, PaymentWrite } from "@/repositories/interfaces/PaymentRepository";
import { PG_UNIQUE_VIOLATION, type Db } from "@/repositories/supabase/db";

export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly db: Db) {}

  async recordIfNew(write: PaymentWrite): Promise<boolean> {
    const { error } = await this.db.from("payments").insert({
      user_id: write.userId,
      subscription_id: write.subscriptionId,
      stripe_invoice_id: write.stripeInvoiceId,
      amount_paise: write.amountPaise,
      charity_id: write.charityId,
      charity_bps: write.charityBps,
      charity_paise: write.split.charityPaise,
      pool_paise: write.split.poolPaise,
      platform_paise: write.split.platformPaise,
      paid_at: write.paidAt,
    });
    if (!error) return true;
    if (error.code === PG_UNIQUE_VIOLATION) return false;
    throw new ExternalServiceError("Payments", error);
  }
}
