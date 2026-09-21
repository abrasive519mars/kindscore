import Link from "next/link";
import { BRAND } from "@/config/constants";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";

/** DESIGN.md §3 step 8 — the tagline lands last; the demo link is the evaluator's on-ramp. */
export function ClosingCTA({ showDemo }: { showDemo: boolean }) {
  return (
    <section className="border-t border-line" aria-labelledby="closing-heading">
      <FadeIn className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-24">
        <h2 id="closing-heading" className="text-4xl md:text-6xl">
          Play your round. Fund a cause. <em className="text-saffron">{BRAND.tagline}</em>
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/signup">
            <Button variant="saffron" size="lg">
              Subscribe &amp; fund a cause
            </Button>
          </Link>
          {showDemo && (
            <Link
              href="/login?demo=1"
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              Try a demo account →
            </Link>
          )}
        </div>
      </FadeIn>
    </section>
  );
}
