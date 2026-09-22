import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import type { DrawSummary } from "@/repositories/interfaces/DrawRepository";
import { describeMode } from "@/components/draw/describeMode";
import { DrawNumbers } from "@/components/draw/DrawNumbers";
import { Badge, Card } from "@/components/ui/primitives";

interface DrawCardProps {
  readonly draw: DrawSummary;
  /** Where the month title links, if anywhere. */
  readonly href?: string;
  /** The viewer's own numbers to highlight, when they were in this draw. */
  readonly matched?: ReadonlySet<number>;
  readonly footer?: React.ReactNode;
}

/** One published draw: month, the five numbers, who won at each tier, and what carried forward. */
export function DrawCard({ draw, href, matched, footer }: DrawCardProps) {
  const title = formatMonth(draw.drawMonth);
  return (
    <Card className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-2xl">
          {href ? (
            <Link href={href} className="hover:text-saffron">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <span className="flex items-center gap-2 text-sm text-ink-2">
          {describeMode(draw.mode, draw.weightStrengthBps)}
          {draw.rolloverOutPaise > 0 && (
            <Badge tone="saffron">{formatInr(draw.rolloverOutPaise)} rolled over</Badge>
          )}
        </span>
      </header>
      <DrawNumbers numbers={draw.numbers} matched={matched} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Stat label="Jackpot" value={formatInr(draw.tierPools[5])} won={draw.winners[5]} />
        <Stat label="4 matches" value={formatInr(draw.tierPools[4])} won={draw.winners[4]} />
        <Stat label="3 matches" value={formatInr(draw.tierPools[3])} won={draw.winners[3]} />
        <div>
          <dt className="text-ink-2">Paid out</dt>
          <dd className="num font-medium">{formatInr(draw.prizesPaise)}</dd>
        </div>
      </dl>
      {footer}
    </Card>
  );
}

function Stat({ label, value, won }: { label: string; value: string; won: number }) {
  return (
    <div>
      <dt className="text-ink-2">{label}</dt>
      <dd className="num font-medium">
        {value}{" "}
        <span className="font-normal text-ink-2">
          · {won === 0 ? "unclaimed" : `${won} ${won === 1 ? "winner" : "winners"}`}
        </span>
      </dd>
    </div>
  );
}
