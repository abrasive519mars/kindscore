import type { Metadata } from "next";
import Link from "next/link";
import { LOCALE } from "@/config/constants";
import { formatMonth, nextDrawMonth, todayInTimezone } from "@/engine/time/dates";
import { createDrawRepository, createDrawService } from "@/lib/draws";
import { DrawCard } from "@/components/draw/DrawCard";
import { JackpotOdometer } from "@/components/draw/JackpotOdometer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Draws",
  description:
    "Every published Kindscore draw: the five numbers, who won at each tier, and the growing jackpot.",
};
export const revalidate = 60;

/** Public history (PRD §06 "results visible to all users"). Counts only — never who. */
export default async function PublicDrawsPage() {
  const [repo, service] = await Promise.all([createDrawRepository(), createDrawService()]);
  const [draws, lastMonth, jackpot] = await Promise.all([
    repo.listSummaries(),
    repo.lastPublishedMonth(),
    service.projectedJackpot(),
  ]);
  const upcoming = nextDrawMonth(lastMonth, todayInTimezone(new Date(), LOCALE.TIMEZONE));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-5xl">Every draw, in the open.</h1>
        <p className="max-w-prose text-lg text-ink-2">
          Five numbers from 1 to 45, once a month. Match three, four or five of your own scores and
          you share the pool.
        </p>
      </header>

      <section className="flex flex-col gap-2 border-y border-line py-6" aria-label="Next jackpot">
        <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">
          {formatMonth(upcoming)} jackpot · estimate
        </p>
        <JackpotOdometer paise={jackpot} className="text-6xl" />
        <p className="text-sm text-ink-2">
          40% of this month&apos;s pool plus whatever rolled over. It grows until someone matches
          all five.
        </p>
        <div className="pt-2">
          <Link href="/signup">
            <Button variant="saffron">Be in it</Button>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-label="Published draws">
        {draws.length === 0 ? (
          <EmptyState
            title={`First draw: ${formatMonth(upcoming)}`}
            body="The numbers and the winners at each tier will be published here."
          />
        ) : (
          draws.map((draw) => <DrawCard key={draw.drawId} draw={draw} />)
        )}
      </section>
    </div>
  );
}
