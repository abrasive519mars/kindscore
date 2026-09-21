import { DRAW } from "@/config/constants";
import type { EligibleEntry } from "@/engine/draw/eligibility";

export type WinningTier = (typeof DRAW.WINNING_MATCH_COUNTS)[number];

export interface MatchedEntry extends EligibleEntry {
  readonly matchCount: number;
  readonly tier: WinningTier | null;
}

/** Set semantics: a repeated score counts once, so `33, 33, 28, 36, 29` can match at most 4. */
export function countMatches(scores: readonly number[], drawn: readonly number[]): number {
  const drawnSet = new Set(drawn);
  let matches = 0;
  for (const score of new Set(scores)) {
    if (drawnSet.has(score)) matches++;
  }
  return matches;
}

export function winningTierFor(matchCount: number): WinningTier | null {
  const tier = DRAW.WINNING_MATCH_COUNTS.find((count) => count === matchCount);
  return tier ?? null;
}

export function matchEntries(
  drawn: readonly number[],
  entries: readonly EligibleEntry[],
): MatchedEntry[] {
  return entries.map((entry) => {
    const matchCount = countMatches(entry.scores, drawn);
    return { ...entry, matchCount, tier: winningTierFor(matchCount) };
  });
}
