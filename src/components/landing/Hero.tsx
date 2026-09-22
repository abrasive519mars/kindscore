import Image from "next/image";
import Link from "next/link";
import { PLANS, SPLIT } from "@/config/constants";
import { applyBps, formatInr } from "@/engine/money/paise";
import { charityImageUrl } from "@/lib/charityImages";
import type { CharityListing } from "@/services/CharityService";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";

const MIN_CHARITY = applyBps(PLANS.month.pricePaise, SPLIT.CHARITY_MIN_BPS);

/**
 * DESIGN.md §3 step 1 — impact first: a person and an outcome before any number, price or rule.
 * The portrait is the featured charity's cover; the only colour on the page.
 */
export function Hero({ featured }: { featured: CharityListing | null }) {
  const cover = charityImageUrl(featured?.coverPath);
  return (
    <section
      className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-10 pb-16 md:grid-cols-[55fr_45fr] md:items-center md:pt-16"
      aria-label="Introduction"
    >
      <div
        id="hero-sentinel"
        className="relative aspect-[4/5] overflow-hidden rounded-md bg-surface-2 md:aspect-[4/3]"
      >
        {cover && (
          <Image
            src={cover}
            alt={featured ? `${featured.name}, ${featured.city}` : ""}
            fill
            priority
            fetchPriority="high"
            decoding="sync"
            quality={60}
            sizes="(min-width: 768px) 55vw, 100vw"
            className="object-cover"
          />
        )}
        {featured && (
          <p className="absolute bottom-3 left-3 rounded-sm bg-bg/90 px-2 py-1 text-xs text-ink backdrop-blur">
            {featured.name} · {featured.city}
          </p>
        )}
      </div>
      <FadeIn delay={0.1} className="flex flex-col gap-6">
        <h1 className="text-5xl leading-[1.05] md:text-6xl">
          Your last five rounds <em className="text-saffron">could fund a classroom.</em>
        </h1>
        <p className="max-w-xl text-lg text-ink-2">
          Every Kindscore subscription sends at least {formatInr(MIN_CHARITY)} a month to a charity
          you choose — and enters your five most recent Stableford scores into a monthly draw. Match
          three, four or all five and you share the prize pool.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/signup">
            <Button variant="saffron" size="lg">
              Subscribe &amp; fund a cause
            </Button>
          </Link>
          <Link
            href="#draw"
            className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            See how the draw works →
          </Link>
        </div>
        <p className="text-sm text-ink-2">
          {formatInr(PLANS.month.pricePaise)}/month or {formatInr(PLANS.year.pricePaise)}/year ·
          cancel anytime · at least {formatInr(MIN_CHARITY)} to your charity · payments by Stripe
        </p>
      </FadeIn>
    </section>
  );
}
