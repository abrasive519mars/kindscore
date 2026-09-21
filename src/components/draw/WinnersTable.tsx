import { DRAW } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import type { WinningTier } from "@/engine/draw/match";
import { cn } from "@/lib/cn";
import type { DrawResultRow } from "@/repositories/interfaces/DrawRepository";

interface WinnersTableProps {
  readonly rows: readonly DrawResultRow[];
  readonly numbers: readonly number[];
  readonly tierPools: Readonly<Record<WinningTier, number>>;
}

const TIER_LABEL: Record<WinningTier, string> = {
  5: "Jackpot · 5 matches",
  4: "4 matches",
  3: "3 matches",
};

/** Admin-only: who won what, grouped by tier, with each winner's five scores and the matches in saffron. */
export function WinnersTable({ rows, numbers, tierPools }: WinnersTableProps) {
  const drawn = new Set(numbers);
  return (
    <div className="flex flex-col gap-6">
      {DRAW.WINNING_MATCH_COUNTS.map((tier) => {
        const winners = rows.filter((r) => r.matchCount === tier);
        return (
          <section key={tier} className="flex flex-col gap-2" aria-label={TIER_LABEL[tier]}>
            <header className="flex items-baseline justify-between">
              <h3 className="text-lg">{TIER_LABEL[tier]}</h3>
              <span className="text-sm text-ink-2">
                {formatInr(tierPools[tier])} ·{" "}
                {winners.length === 0
                  ? "no winners"
                  : `${winners.length} ${winners.length === 1 ? "winner" : "winners"}`}
              </span>
            </header>
            {winners.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
                  <tr>
                    <th className="py-1 font-medium">Member</th>
                    <th className="py-1 font-medium">Scores</th>
                    <th className="py-1 text-right font-medium">Prize</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {winners.map((w) => (
                    <tr key={w.userId}>
                      <td className="py-2">
                        <span className="font-medium">{w.fullName}</span>
                        <span className="block text-xs text-ink-2">{w.email}</span>
                      </td>
                      <td className="num py-2 font-display text-lg">
                        {w.scores.map((s, i) => (
                          <span key={i} className={cn("mr-3", drawn.has(s) && "text-saffron")}>
                            {s}
                          </span>
                        ))}
                      </td>
                      <td className="num py-2 text-right font-medium">{formatInr(w.prizePaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
