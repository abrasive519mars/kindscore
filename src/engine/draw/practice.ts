import { buildFrequencyMap } from "@/engine/draw/frequency";
import { generateNumbers, type DrawMode } from "@/engine/draw/generateNumbers";
import { countMatches, winningTierFor, type WinningTier } from "@/engine/draw/match";
import { secureRng, type Rng } from "@/engine/draw/rng";
import type { Paise } from "@/engine/money/paise";
import { addOneMonth, type IsoDate } from "@/engine/time/dates";

/** Priya's five — the named golfer of the landing page (DESIGN.md §3 step 3). */
export const PRACTICE_SAMPLE: readonly number[] = [28, 33, 31, 36, 29];

/** A plausible "what golfers score" shape for the practice histogram: a bell around 30. */
export const PRACTICE_HOLDERS: readonly number[] = Array.from({ length: 46 }, (_, n) =>
  n === 0 ? 0 : Math.max(0, Math.round(40 * Math.exp(-((n - 31) ** 2) / 40))),
);

export interface PracticeResult {
  readonly numbers: number[];
  readonly matches: number;
  readonly tier: WinningTier | null;
}

/**
 * The landing page's practice draw: the real engine, no database. Weighted mode uses the sample
 * bell so the histogram and the odds are the same thing the admin would see.
 */
export function practiceDraw(mode: DrawMode = "random", rng: Rng = secureRng): PracticeResult {
  const frequency = buildFrequencyMap(
    PRACTICE_HOLDERS.flatMap((count, n) =>
      Array.from({ length: count }, (_, i) => ({ userId: `p${n}-${i}`, scores: [n] })),
    ),
  );
  const numbers = generateNumbers(mode, frequency, rng);
  const matches = countMatches(PRACTICE_SAMPLE, numbers);
  return { numbers, matches, tier: winningTierFor(matches) };
}

export function describePracticeOutcome(result: PracticeResult): string {
  if (result.tier === 5) return "All five — the jackpot. This is why it rolls over for months.";
  if (result.tier === 4) return "Four matches — a share of 35% of the pool.";
  if (result.tier === 3)
    return "Three matches — a share of 25% of the pool. Three is all it takes.";
  if (result.matches === 0)
    return "No match this time. Most months look like this — the jackpot grows.";
  return `${result.matches === 1 ? "One match" : "Two matches"} — close. Three wins.`;
}

export interface LadderStep {
  readonly month: IsoDate;
  readonly jackpotPaise: Paise | null;
  readonly upcoming: boolean;
}

/** The last three published jackpots in calendar order, then the month that is next. */
export function jackpotLadder(
  published: readonly { drawMonth: IsoDate; jackpotPaise: Paise }[],
  upcomingMonth: IsoDate,
): LadderStep[] {
  const recent = [...published]
    .sort((a, b) => (a.drawMonth < b.drawMonth ? -1 : 1))
    .slice(-3)
    .map((d) => ({ month: d.drawMonth, jackpotPaise: d.jackpotPaise, upcoming: false }));
  const next = recent.length ? addOneMonth(recent[recent.length - 1].month) : upcomingMonth;
  return [...recent, { month: next, jackpotPaise: null, upcoming: true }];
}
