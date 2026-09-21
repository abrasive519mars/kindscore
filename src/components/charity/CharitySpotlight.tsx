import Image from "next/image";
import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { charityImageUrl } from "@/lib/charityImages";
import type { CharityListing } from "@/services/CharityService";
import { Button } from "@/components/ui/Button";

/**
 * PRD §08.2 homepage spotlight: the featured charity, photo first, outcome line second, then one
 * action. Used on the landing page (Phase 10) and the top of the directory.
 */
export function CharitySpotlight({ charity }: { charity: CharityListing }) {
  const cover = charityImageUrl(charity.coverPath);
  return (
    <section
      className="grid gap-6 overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-[1.1fr_1fr]"
      aria-label="Charity spotlight"
    >
      <div className="relative aspect-[4/3] bg-surface-2 md:aspect-auto md:min-h-[22rem]">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">
          Spotlight · {charity.city}
        </p>
        <h2 className="text-4xl">{charity.name}</h2>
        <p className="font-display text-2xl text-saffron">{charity.outcomeLine}</p>
        <p className="text-ink-2">{charity.tagline}</p>
        {charity.totals.totalPaise > 0 && (
          <p className="num text-sm text-ink-2">
            {formatInr(charity.totals.totalPaise)} given so far by {charity.totals.contributorCount}{" "}
            members
          </p>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href={`/charities/${charity.slug}`}>
            <Button variant="saffron">Read their story</Button>
          </Link>
          <Link href="/charities">
            <Button variant="ghost">All charities</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
