import { DRAW, TIER_SHARE_BPS } from "@/config/constants";
import type { MatchedEntry, WinningTier } from "@/engine/draw/match";
import { applyBps, assertPaise, splitEqualPaise, type Paise } from "@/engine/money/paise";

export type TierPools = Readonly<Record<WinningTier, Paise>>;

export interface Prize {
  readonly userId: string;
  readonly tier: WinningTier;
  readonly prizePaise: Paise;
}

export interface PrizeAllocation {
  readonly tierPools: TierPools;
  readonly prizes: readonly Prize[];
  /** Unclaimed jackpot carried into next month's jackpot. */
  readonly rolloverOutPaise: Paise;
  /** Unclaimed 4- and 3-match pools; these do not roll over (GAME.md §6 decision). */
  readonly unclaimedRetainedPaise: Paise;
}

/**
 * 40% jackpot · 35% four-match · 25% three-match. The jackpot is computed as the
 * remainder so the three tiers always sum to pool + rollover-in to the paisa; last month's
 * unclaimed jackpot lands in this month's jackpot only.
 */
export function splitTierPools(poolPaise: Paise, rolloverInPaise: Paise): TierPools {
  assertPaise(poolPaise, "pool");
  assertPaise(rolloverInPaise, "rollover");
  const four = applyBps(poolPaise, TIER_SHARE_BPS[4]);
  const three = applyBps(poolPaise, TIER_SHARE_BPS[3]);
  const jackpot = poolPaise - four - three + rolloverInPaise;
  return { 5: jackpot, 4: four, 3: three };
}

function winnersByTier(matched: readonly MatchedEntry[]): Readonly<Record<WinningTier, string[]>> {
  const groups: Record<WinningTier, string[]> = { 5: [], 4: [], 3: [] };
  for (const entry of matched) {
    if (entry.tier !== null) groups[entry.tier].push(entry.userId);
  }
  for (const tier of DRAW.WINNING_MATCH_COUNTS) groups[tier].sort();
  return groups;
}

function prizesForTier(tier: WinningTier, tierPool: Paise, userIds: readonly string[]): Prize[] {
  const shares = splitEqualPaise(tierPool, userIds.length);
  return userIds.map((userId, index) => ({ userId, tier, prizePaise: shares[index] }));
}

export interface AllocateInput {
  readonly poolPaise: Paise;
  readonly rolloverInPaise: Paise;
  readonly matched: readonly MatchedEntry[];
}

export function allocatePrizes({
  poolPaise,
  rolloverInPaise,
  matched,
}: AllocateInput): PrizeAllocation {
  const tierPools = splitTierPools(poolPaise, rolloverInPaise);
  const winners = winnersByTier(matched);

  const prizes = DRAW.WINNING_MATCH_COUNTS.flatMap((tier) =>
    prizesForTier(tier, tierPools[tier], winners[tier]),
  );
  const rolloverOutPaise = winners[DRAW.JACKPOT_MATCH_COUNT].length === 0 ? tierPools[5] : 0;
  const unclaimedRetainedPaise = ([4, 3] as const)
    .filter((tier) => winners[tier].length === 0)
    .reduce((sum, tier) => sum + tierPools[tier], 0);

  return { tierPools, prizes, rolloverOutPaise, unclaimedRetainedPaise };
}
