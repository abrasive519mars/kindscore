import { cn } from "@/lib/cn";

interface DrawNumbersProps {
  readonly numbers: readonly number[];
  /** Numbers the viewer's own scores match — drawn with the pool ring. */
  readonly matched?: ReadonlySet<number>;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZE = {
  sm: "h-9 w-9 text-lg",
  md: "h-12 w-12 text-2xl",
  lg: "h-16 w-16 text-4xl",
} as const;

/**
 * The five drawn numbers as square tiles on a hairline — the product's second numeral
 * (DESIGN.md §2.4). Static; DrawReveal animates the same tiles client-side.
 */
export function DrawNumbers({ numbers, matched, size = "md", className }: DrawNumbersProps) {
  return (
    <ol
      className={cn("num flex items-center gap-2 font-display", className)}
      aria-label="Drawn numbers"
    >
      {numbers.map((n) => (
        <li
          key={n}
          className={cn(
            "flex items-center justify-center rounded-md border border-line bg-surface",
            SIZE[size],
            matched?.has(n) && "border-pool text-pool ring-2 ring-pool/30",
          )}
        >
          {n}
        </li>
      ))}
    </ol>
  );
}
