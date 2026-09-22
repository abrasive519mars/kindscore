import type { ProofFigure } from "@/engine/landing/figures";
import { cn } from "@/lib/cn";
import { JackpotOdometer } from "@/components/draw/JackpotOdometer";
import { CountUp } from "@/components/motion/CountUp";
import { FadeIn } from "@/components/motion/FadeIn";

/** DESIGN.md §3 step 2 — real ledger figures on one hairline. Renders nothing when there is nothing honest to show. */
export function ProofStrip({ figures }: { figures: readonly ProofFigure[] }) {
  if (figures.length === 0) return null;
  return (
    <section className="border-y border-line" aria-label="Kindscore so far">
      <dl className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
        {figures.map((f, i) => (
          <FadeIn key={f.label} delay={i * 0.06} className="flex flex-col gap-1">
            <dd
              className={cn(
                "num font-display text-4xl",
                f.accent === "saffron" ? "text-saffron" : "text-pool",
              )}
            >
              {f.kind === "money" ? (
                <JackpotOdometer paise={f.value} />
              ) : (
                <CountUp value={f.value} />
              )}
            </dd>
            <dt className="text-sm text-ink-2">{f.label}</dt>
          </FadeIn>
        ))}
      </dl>
    </section>
  );
}
