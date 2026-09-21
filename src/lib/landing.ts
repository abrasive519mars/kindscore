import { LOCALE } from "@/config/constants";
import { jackpotLadder, type LadderStep } from "@/engine/draw/practice";
import { proofFigures, type ProofFigure } from "@/engine/landing/figures";
import { nextDrawMonth, todayInTimezone, type IsoDate } from "@/engine/time/dates";
import { createCharityService } from "@/lib/charities";
import { createDrawRepository, createDrawService } from "@/lib/draws";
import type { DrawSummary } from "@/repositories/interfaces/DrawRepository";
import type { CharityListing } from "@/services/CharityService";

export interface LandingData {
  readonly featured: CharityListing | null;
  /** Three more charities for the impact section, the featured one excluded. */
  readonly cards: CharityListing[];
  readonly proof: ProofFigure[];
  readonly jackpotPaise: number;
  readonly ladder: LadderStep[];
  readonly upcomingMonth: IsoDate;
  readonly draws: DrawSummary[];
}

/**
 * Everything the landing page shows, from public reads only (charity_totals, draw_statistics,
 * active_subscriber_counts). Nothing here needs a session; the same data would render for a
 * search engine.
 */
export async function loadLanding(now = new Date()): Promise<LandingData> {
  const [charities, drawRepo, drawService] = await Promise.all([
    createCharityService(),
    createDrawRepository(),
    createDrawService(),
  ]);
  const [directory, draws, counts, jackpotPaise, lastMonth] = await Promise.all([
    charities.directory({}),
    drawRepo.listSummaries(),
    drawRepo.activeSubscriberCounts(),
    drawService.projectedJackpot(),
    drawRepo.lastPublishedMonth(),
  ]);
  const featured =
    directory.charities.find((c) => c.featuredRank === 1) ?? directory.charities[0] ?? null;
  const cards = directory.charities.filter((c) => c.id !== featured?.id).slice(0, 3);
  const charityTotalPaise = directory.charities.reduce((sum, c) => sum + c.totals.totalPaise, 0);
  const upcomingMonth = nextDrawMonth(lastMonth, todayInTimezone(now, LOCALE.TIMEZONE));
  return {
    featured,
    cards,
    proof: proofFigures({
      charityTotalPaise,
      jackpotPaise,
      activeMembers: counts.month + counts.year,
    }),
    jackpotPaise,
    ladder: jackpotLadder(
      draws.map((d) => ({ drawMonth: d.drawMonth, jackpotPaise: d.tierPools[5] })),
      upcomingMonth,
    ),
    upcomingMonth,
    draws,
  };
}
