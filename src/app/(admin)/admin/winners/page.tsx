import type { Metadata } from "next";
import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import { createWinnerService } from "@/lib/winners";
import { cn } from "@/lib/cn";
import type { ClaimRow } from "@/repositories/interfaces/WinnerRepository";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { claimStatus } from "@/components/winners/claimSteps";

export const metadata: Metadata = { title: "Winners" };

type Filter = "all" | "review" | "awaiting" | "unpaid" | "paid" | "rejected";

const FILTERS: ReadonlyArray<{ key: Filter; label: string; match: (c: ClaimRow) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "review", label: "To review", match: (c) => c.review === "submitted" },
  { key: "awaiting", label: "Awaiting proof", match: (c) => c.review === "awaiting_proof" },
  { key: "unpaid", label: "Approved · unpaid", match: (c) => c.review === "approved" && c.payout === "pending" },
  { key: "paid", label: "Paid", match: (c) => c.payout === "paid" },
  { key: "rejected", label: "Rejected", match: (c) => c.review === "rejected" },
];

/** PRD §11.04 — every claim, filtered by where it stands. Rows open the claim to verify or pay. */
export default async function AdminWinnersPage({ searchParams }: PageProps<"/admin/winners">) {
  const { filter: raw } = (await searchParams) as { filter?: string };
  const filter = FILTERS.find((f) => f.key === raw) ?? FILTERS[0];
  const claims = await (await createWinnerService()).listQueue();
  const rows = claims.filter(filter.match);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Winners</h1>
        <p className="text-ink-2">Verify the screenshot, approve or reject, then mark paid once the money has gone.</p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map((f) => {
          const count = claims.filter(f.match).length;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/admin/winners" : `/admin/winners?filter=${f.key}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                f.key === filter.key ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2",
              )}
            >
              {f.label} <span className="num opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="Nothing to verify" body="Claims appear here the moment a draw is published." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Draw</th>
                <th className="px-4 py-3 font-medium">Matches</th>
                <th className="px-4 py-3 text-right font-medium">Prize</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => {
                const status = claimStatus(c);
                return (
                  <tr key={c.verificationId}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/winners/${c.verificationId}`} className="font-medium hover:text-saffron">
                        {c.fullName}
                      </Link>
                      <span className="block text-xs text-ink-2">{c.email}</span>
                    </td>
                    <td className="px-4 py-3">{formatMonth(c.drawMonth)}</td>
                    <td className="num px-4 py-3">{c.matchCount}</td>
                    <td className="num px-4 py-3 text-right">{formatInr(c.prizePaise)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
