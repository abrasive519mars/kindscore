import { summarisePaymentsByMonth, type MonthlyTotals } from "@/engine/reports/monthly";
import { toCsv } from "@/lib/csv";
import type { AdminUserRepository } from "@/repositories/interfaces/AdminUserRepository";
import type { DrawRepository, DrawSummary } from "@/repositories/interfaces/DrawRepository";
import type {
  CharityTotalRow,
  ReportSummary,
  ReportsRepository,
} from "@/repositories/interfaces/ReportsRepository";

export interface ReportsOverview {
  readonly summary: ReportSummary;
  readonly byMonth: MonthlyTotals[];
  readonly charities: CharityTotalRow[];
  readonly draws: DrawSummary[];
}

export type ReportKind = "charities" | "draws" | "payments" | "members";
export const REPORT_KINDS: readonly ReportKind[] = ["charities", "draws", "payments", "members"];

const rupees = (paise: number) => (paise / 100).toFixed(2);

/** PRD §11.05 — every figure from the ledger and the published draws; nothing recomputed by hand. */
export class ReportsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly draws: DrawRepository,
    private readonly users: AdminUserRepository,
  ) {}

  async overview(): Promise<ReportsOverview> {
    const [summary, payments, charities, draws] = await Promise.all([
      this.reports.summary(),
      this.reports.payments(),
      this.reports.charityTotals(),
      this.draws.listSummaries(),
    ]);
    return { summary, byMonth: summarisePaymentsByMonth(payments), charities, draws };
  }

  /** Plain-rupee CSVs (two decimals), so a spreadsheet sums them without paise arithmetic. */
  async csv(kind: ReportKind): Promise<string> {
    switch (kind) {
      case "charities":
        return toCsv(
          ["charity", "slug", "listed", "total_inr", "contributors"],
          (await this.reports.charityTotals()).map((c) => [
            c.name,
            c.slug,
            c.isActive,
            rupees(c.totalPaise),
            c.contributorCount,
          ]),
        );
      case "draws":
        return toCsv(
          [
            "month",
            "mode",
            "numbers",
            "active_subscribers",
            "pool_inr",
            "rollover_in_inr",
            "jackpot_inr",
            "five_winners",
            "four_winners",
            "three_winners",
            "prizes_inr",
            "rollover_out_inr",
          ],
          (await this.draws.listSummaries()).map((d) => [
            d.drawMonth.slice(0, 7),
            d.mode,
            d.numbers.join(" "),
            d.activeSubscriberCount,
            rupees(d.poolPaise),
            rupees(d.rolloverInPaise),
            rupees(d.tierPools[5]),
            d.winners[5],
            d.winners[4],
            d.winners[3],
            rupees(d.prizesPaise),
            rupees(d.rolloverOutPaise),
          ]),
        );
      case "payments":
        return toCsv(
          ["month", "payments", "amount_inr", "pool_inr", "charity_inr", "platform_inr"],
          summarisePaymentsByMonth(await this.reports.payments()).map((m) => [
            m.month,
            m.payments,
            rupees(m.amountPaise),
            rupees(m.poolPaise),
            rupees(m.charityPaise),
            rupees(m.platformPaise),
          ]),
        );
      case "members":
        return toCsv(
          [
            "name",
            "email",
            "charity",
            "charity_share",
            "subscription",
            "period_end",
            "source",
            "scores",
            "joined",
          ],
          (await this.users.listMembers({})).map((m) => [
            m.fullName,
            m.email,
            m.charityName,
            `${m.charityBps / 100}%`,
            m.subscription?.status ?? "none",
            m.subscription?.currentPeriodEnd ?? "",
            m.subscription?.source ?? "",
            m.scoreCount,
            m.createdAt,
          ]),
        );
    }
  }
}
