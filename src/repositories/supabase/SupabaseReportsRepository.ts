import { ExternalServiceError } from "@/engine/errors";
import type { PaymentLine } from "@/engine/reports/monthly";
import type {
  CharityTotalRow,
  ReportSummary,
  ReportsRepository,
} from "@/repositories/interfaces/ReportsRepository";
import type { Db } from "@/repositories/supabase/db";

/** Admin client only — the views are security_invoker and the tables are admin-readable. */
export class SupabaseReportsRepository implements ReportsRepository {
  constructor(private readonly db: Db) {}

  async summary(): Promise<ReportSummary> {
    const { data, error } = await this.db.from("reports_summary").select("*").single();
    if (error) throw new ExternalServiceError("Reports", error);
    return {
      totalMembers: data.total_members ?? 0,
      activeSubscribers: data.active_subscribers ?? 0,
      poolThisMonthPaise: data.pool_this_month_paise ?? 0,
      charityTotalPaise: data.charity_total_paise ?? 0,
      prizesAwardedPaise: data.prizes_awarded_paise ?? 0,
      prizesPaidPaise: data.prizes_paid_paise ?? 0,
      proofsAwaitingReview: data.proofs_awaiting_review ?? 0,
      currentRolloverPaise: data.current_rollover_paise ?? 0,
    };
  }

  async charityTotals(): Promise<CharityTotalRow[]> {
    const { data, error } = await this.db
      .from("charity_totals")
      .select("*")
      .order("total_paise", { ascending: false });
    if (error) throw new ExternalServiceError("Reports", error);
    return data.map((row) => ({
      charityId: row.charity_id!,
      name: row.name ?? "",
      slug: row.slug ?? "",
      isActive: row.is_active ?? true,
      totalPaise: row.total_paise ?? 0,
      contributorCount: row.contributor_count ?? 0,
    }));
  }

  async payments(): Promise<PaymentLine[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("paid_at, amount_paise, pool_paise, charity_paise, platform_paise")
      .order("paid_at", { ascending: false });
    if (error) throw new ExternalServiceError("Reports", error);
    return data.map((p) => ({
      paidAt: p.paid_at,
      amountPaise: p.amount_paise,
      poolPaise: p.pool_paise,
      charityPaise: p.charity_paise,
      platformPaise: p.platform_paise,
    }));
  }
}
