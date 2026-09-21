import Link from "next/link";
import type { LadderStep } from "@/engine/draw/practice";
import { formatInr } from "@/engine/money/paise";
import { formatMonth, type IsoDate } from "@/engine/time/dates";
import { JackpotOdometer } from "@/components/draw/JackpotOdometer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface JackpotProps {
  readonly jackpotPaise: number;
  readonly ladder: readonly LadderStep[];
  readonly upcomingMonth: IsoDate;
}

function shortMonth(month: IsoDate): string {
  return formatMonth(month).split(" ")[0].slice(0, 3);
}

/** DESIGN.md §3 step 6 — the one legitimate urgency device: a jackpot that climbs until someone takes it. */
export function Jackpot({ jackpotPaise, ladder, upcomingMonth }: JackpotProps) {
  return (
    <section className="border-t border-line" aria-labelledby="jackpot-heading">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-20">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">Jackpot</p>
          <h2 id="jackpot-heading" className="text-4xl md:text-5xl">
            It grows until someone takes it.
          </h2>
        </header>
        {jackpotPaise > 0 ? (
          <div className="flex flex-col gap-2">
            <JackpotOdometer paise={jackpotPaise} className="text-6xl md:text-7xl" />
            <p className="text-sm text-ink-2">
              {formatMonth(upcomingMonth)}&apos;s jackpot, estimated from today&apos;s members — 40%
              of the pool plus what rolled over. Nobody matches all five most months, so it carries.
            </p>
          </div>
        ) : (
          <p className="max-w-prose text-lg text-ink-2">
            Forty percent of every month&apos;s pool is the five-match prize. When nobody matches
            all five — most months — it rolls into the next draw. First draw:{" "}
            {formatMonth(upcomingMonth)}.
          </p>
        )}
        <ol className="flex flex-wrap gap-3" aria-label="Recent jackpots">
          {ladder.map((step) => (
            <li
              key={step.month}
              className={cn(
                "flex flex-col gap-0.5 rounded-md border px-4 py-3",
                step.upcoming ? "border-saffron" : "border-line",
              )}
            >
              <span className="text-xs font-medium uppercase tracking-[0.06em] text-ink-2">
                {step.upcoming ? "Next draw" : shortMonth(step.month)}
              </span>
              <span className="num font-display text-2xl">
                {step.upcoming ? formatMonth(step.month) : formatInr(step.jackpotPaise ?? 0)}
              </span>
            </li>
          ))}
        </ol>
        <div>
          <Link href="/draws">
            <Button variant="ghost">Every published draw →</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
