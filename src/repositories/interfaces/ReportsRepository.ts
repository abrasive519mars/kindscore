import type { Paise } from "@/engine/money/paise";
import type { PaymentLine } from "@/engine/reports/monthly";

/** The reports_summary view — the admin overview and the top of the reports page. */
export interface ReportSummary {
  readonly totalMembers: number;
  readonly activeSubscribers: number;
  readonly poolThisMonthPaise: Paise;
  /** Every pool slice ever collected (§11.05 "total prize pool"). */
  readonly poolTotalPaise: Paise;
  readonly charityTotalPaise: Paise;
  readonly prizesAwardedPaise: Paise;
  readonly prizesPaidPaise: Paise;
  readonly proofsAwaitingReview: number;
  readonly currentRolloverPaise: Paise;
}

export interface CharityTotalRow {
  readonly charityId: string;
  readonly name: string;
  readonly slug: string;
  readonly isActive: boolean;
  readonly totalPaise: Paise;
  readonly contributorCount: number;
}

export interface ReportsRepository {
  summary(): Promise<ReportSummary>;
  charityTotals(): Promise<CharityTotalRow[]>;
  /** Every successful payment, for the monthly aggregation (small: one row per member per month). */
  payments(): Promise<PaymentLine[]>;
}
