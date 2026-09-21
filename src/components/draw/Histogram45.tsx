import { DRAW } from "@/config/constants";
import { cn } from "@/lib/cn";

interface Histogram45Props {
  /** Index = the number (1–45); how many eligible members hold it. Index 0 unused. */
  readonly holders: readonly number[];
  /** Same indexing; the draw weight per number for the chosen mode. */
  readonly weights: readonly number[];
  readonly mode: "random" | "algorithmic";
  readonly className?: string;
}

const NUMBERS = Array.from({ length: DRAW.NUMBER_MAX }, (_, i) => i + 1);

/**
 * What members actually score, 1–45, as ink bars; the chosen mode's weight as a saffron line
 * above. Random mode's line is flat; algorithmic mode's follows the bars with a floor so nothing
 * is impossible (GAME.md §3). Pure SVG, no chart library — it is one picture, not a dashboard.
 */
export function Histogram45({ holders, weights, mode, className }: Histogram45Props) {
  const maxHolders = Math.max(1, ...NUMBERS.map((n) => holders[n] ?? 0));
  const maxWeight = Math.max(1, ...NUMBERS.map((n) => weights[n] ?? 0));
  const barWidth = 100 / DRAW.NUMBER_MAX;
  const points = NUMBERS.map((n) => {
    const x = (n - 0.5) * barWidth;
    const y = 100 - ((weights[n] ?? 0) / maxWeight) * 90;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label={describe(holders, mode)}
      >
        {NUMBERS.map((n) => {
          const height = ((holders[n] ?? 0) / maxHolders) * 90;
          return (
            <rect
              key={n}
              x={(n - 1) * barWidth + barWidth * 0.15}
              y={100 - height}
              width={barWidth * 0.7}
              height={height}
              className="fill-ink/25"
            />
          );
        })}
        <polyline
          points={points}
          fill="none"
          className="stroke-saffron"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex justify-between text-xs text-ink-2">
        <span>1</span>
        <span>
          bars: members holding each number · line:{" "}
          {mode === "random"
            ? "equal chance for every number"
            : "draw weight (follows the bars, never zero)"}
        </span>
        <span>45</span>
      </figcaption>
    </figure>
  );
}

function describe(holders: readonly number[], mode: string): string {
  const most = NUMBERS.reduce(
    (best, n) => ((holders[n] ?? 0) > (holders[best] ?? 0) ? n : best),
    1,
  );
  return `Score distribution 1 to 45; most-held number is ${most}; ${mode} mode weights`;
}
