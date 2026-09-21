import Image from "next/image";
import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { charityImageUrl } from "@/lib/charityImages";
import type { CharityListing } from "@/services/CharityService";
import { Badge } from "@/components/ui/primitives";

/**
 * Directory card (DESIGN.md §5): photo, name, city, the outcome line, and what has been given.
 * The whole card is the link; the photo is the only colour on the page.
 */
export function CharityCard({ charity }: { charity: CharityListing }) {
  const cover = charityImageUrl(charity.coverPath);
  return (
    <Link
      href={`/charities/${charity.slug}`}
      className="group flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-ink/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 px-1 pb-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xl">{charity.name}</h3>
          {charity.featuredRank === 1 && <Badge tone="saffron">Spotlight</Badge>}
        </div>
        <p className="text-sm text-ink-2">
          {charity.category} · {charity.city}
        </p>
        <p className="font-display text-lg text-saffron">{charity.outcomeLine}</p>
        <p className="text-sm text-ink-2">
          {charity.totals.totalPaise > 0
            ? `${formatInr(charity.totals.totalPaise)} given by ${charity.totals.contributorCount} ${charity.totals.contributorCount === 1 ? "member" : "members"}`
            : "Be the first to give"}
        </p>
      </div>
    </Link>
  );
}
