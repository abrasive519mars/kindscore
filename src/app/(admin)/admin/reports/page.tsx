import type { Metadata } from "next";
import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import { createReportsService } from "@/lib/admin";
import { REPORT_KINDS } from "@/services/ReportsService";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Figure } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Reports" };

const CSV_LABEL: Record<(typeof REPORT_KINDS)[number], string> = {
  charities: "Charity totals",
  draws: "Draw statistics",
  payments: "Payments by month",
  members: "Members",
};

/** PRD §11.05 — total users, total prize pool, charity totals, draw statistics. Every number from the ledger. */
export default async function AdminReportsPage() {
  const { summary, byMonth, charities, draws } = await (await createReportsService()).overview();
  const maxCharity = Math.max(1, ...charities.map((c) => c.totalPaise));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl">Reports</h1>
          <p className="text-ink-2">
            Sums over the ledger and the published draws. Nothing here is typed in by hand.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Download CSV">
          {REPORT_KINDS.map((kind) => (
            <Link key={kind} href={`/admin/reports/export?report=${kind}`} prefetch={false}>
              <Button size="sm" variant="ghost">
                CSV · {CSV_LABEL[kind]}
              </Button>
            </Link>
          ))}
        </nav>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
        <Card>
          <Figure
            label="Members"
            value={summary.totalMembers}
            hint={`${summary.activeSubscribers} active subscribers`}
          />
        </Card>
        <Card>
          <Figure
            label="Pool this month"
            value={formatInr(summary.poolThisMonthPaise)}
            hint={`+ ${formatInr(summary.currentRolloverPaise)} carried jackpot`}
          />
        </Card>
        <Card>
          <Figure label="Given to charities" value={formatInr(summary.charityTotalPaise)} accent />
        </Card>
        <Card>
          <Figure
            label="Prizes awarded"
            value={formatInr(summary.prizesAwardedPaise)}
            hint={`${formatInr(summary.prizesPaidPaise)} paid out`}
          />
        </Card>
      </section>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">By month</h2>
        {byMonth.length === 0 ? (
          <EmptyState title="No payments yet" body="Each successful Stripe invoice adds a row." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
              <tr>
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 text-right font-medium">Payments</th>
                <th className="py-2 text-right font-medium">Collected</th>
                <th className="py-2 text-right font-medium">Pool</th>
                <th className="py-2 text-right font-medium">Charity</th>
                <th className="py-2 text-right font-medium">Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="py-2">{formatMonth(`${m.month}-01`)}</td>
                  <td className="num py-2 text-right">{m.payments}</td>
                  <td className="num py-2 text-right">{formatInr(m.amountPaise)}</td>
                  <td className="num py-2 text-right text-pool">{formatInr(m.poolPaise)}</td>
                  <td className="num py-2 text-right text-saffron">{formatInr(m.charityPaise)}</td>
                  <td className="num py-2 text-right text-ink-2">{formatInr(m.platformPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Charity totals</h2>
        <ol className="flex flex-col gap-3">
          {charities.map((c) => (
            <li key={c.charityId} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={c.isActive ? "font-medium" : "text-ink-3"}>
                  {c.name}
                  {!c.isActive && " · hidden"}
                </span>
                <span className="num">
                  {formatInr(c.totalPaise)}{" "}
                  <span className="text-ink-2">
                    · {c.contributorCount} {c.contributorCount === 1 ? "member" : "members"}
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-2" aria-hidden>
                <div
                  className="h-2 rounded-full bg-saffron"
                  style={{ width: `${Math.max(2, (c.totalPaise / maxCharity) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Draw statistics</h2>
        {draws.length === 0 ? (
          <EmptyState
            title="Publish a draw to see statistics"
            body="Winners per tier, prizes and rollovers appear per published month."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
                <tr>
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 font-medium">Mode</th>
                  <th className="py-2 font-medium">Numbers</th>
                  <th className="py-2 text-right font-medium">Subscribers</th>
                  <th className="py-2 text-right font-medium">Pool</th>
                  <th className="py-2 text-right font-medium">Jackpot</th>
                  <th className="py-2 text-right font-medium">5 / 4 / 3</th>
                  <th className="py-2 text-right font-medium">Prizes</th>
                  <th className="py-2 text-right font-medium">Rolled over</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {draws.map((d) => (
                  <tr key={d.drawId}>
                    <td className="py-2">
                      <Link href={`/admin/draws/${d.drawId}`} className="hover:text-saffron">
                        {formatMonth(d.drawMonth)}
                      </Link>
                    </td>
                    <td className="py-2 capitalize">{d.mode}</td>
                    <td className="num py-2">{d.numbers.join(" · ")}</td>
                    <td className="num py-2 text-right">{d.activeSubscriberCount}</td>
                    <td className="num py-2 text-right">{formatInr(d.poolPaise)}</td>
                    <td className="num py-2 text-right">{formatInr(d.tierPools[5])}</td>
                    <td className="num py-2 text-right">
                      {d.winners[5]} / {d.winners[4]} / {d.winners[3]}
                    </td>
                    <td className="num py-2 text-right">{formatInr(d.prizesPaise)}</td>
                    <td className="num py-2 text-right">
                      {d.rolloverOutPaise ? formatInr(d.rolloverOutPaise) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
