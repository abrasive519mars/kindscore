import Link from "next/link";
import type { CharityListing } from "@/services/CharityService";
import { CharityCard } from "@/components/charity/CharityCard";
import { CharitySpotlight } from "@/components/charity/CharitySpotlight";
import { FadeIn } from "@/components/motion/FadeIn";
import { SplitSlider } from "@/components/ui/Split";
import { Button } from "@/components/ui/Button";

/** DESIGN.md §3 step 4 — the emotional core: the slider you control, the face it reaches, three more. */
export function CharityImpact({
  featured,
  cards,
}: {
  featured: CharityListing | null;
  cards: readonly CharityListing[];
}) {
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="impact-heading">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20">
        <FadeIn>
          <header className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">
              Charity impact
            </p>
            <h2 id="impact-heading" className="text-4xl md:text-5xl">
              Where the saffron goes.
            </h2>
            <p className="max-w-prose text-lg text-ink-2">
              The saffron part of every payment is your charity&apos;s. Ten percent is the floor.
              Seventy is the ceiling — at seventy, Kindscore keeps nothing.
            </p>
          </header>
        </FadeIn>
        <FadeIn delay={0.08} className="max-w-xl">
          <SplitSlider name="preview-bps" outcomeLine={featured?.outcomeLine} />
        </FadeIn>
        {featured && (
          <FadeIn>
            <CharitySpotlight charity={featured} />
          </FadeIn>
        )}
        {cards.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="More charities">
            {cards.map((c, i) => (
              <li key={c.id}>
                <FadeIn delay={i * 0.06} className="h-full">
                  <CharityCard charity={c} />
                </FadeIn>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Link href="/charities">
            <Button variant="ghost">See all charities →</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
