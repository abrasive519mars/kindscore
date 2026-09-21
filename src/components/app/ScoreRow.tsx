import { SCORE } from "@/config/constants";
import { cn } from "@/lib/cn";

interface ScoreRowProps {
  /** Newest first. Fewer than five leaves hollow slots. */
  readonly scores: readonly number[];
  readonly matched?: ReadonlySet<number>;
  readonly size?: "md" | "lg";
}

/**
 * The five numerals on a hairline — the product's only decoration (DESIGN.md §2.4).
 * A hollow slot is a round not yet played; a saffron numeral is a match.
 */
export function ScoreRow({ scores, matched, size = "lg" }: ScoreRowProps) {
  const slots = Array.from({ length: SCORE.WINDOW_SIZE }, (_, i) => scores[i]);
  return (
    <ol className={cn("num flex items-baseline gap-4 border-b border-line pb-3 font-display sm:gap-6", size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl")} aria-label="Your last five scores, newest first">
      {slots.map((score, index) =>
        score === undefined ? (
          <li key={index} className="text-ink-3/40" aria-label="No round yet">
            –
          </li>
        ) : (
          <li key={index} className={cn(matched?.has(score) && "text-saffron")}>
            {score}
          </li>
        ),
      )}
    </ol>
  );
}
