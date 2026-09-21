import { describe, expect, it } from "vitest";
import type { MatchedEntry } from "@/engine/draw/match";
import { allocatePrizes, splitTierPools, type PrizeAllocation } from "@/engine/prizes/allocate";
import { computePoolPaise, monthlyEquivalentPoolPaise } from "@/engine/prizes/pool";

function winner(userId: string, matchCount: 5 | 4 | 3 | 0): MatchedEntry {
  const tier = matchCount === 0 ? null : matchCount;
  return { userId, scores: [], matchCount, tier };
}

function totalPaidOut(allocation: PrizeAllocation): number {
  return allocation.prizes.reduce((sum, prize) => sum + prize.prizePaise, 0);
}

/** Every paisa in is paid, carried or retained. */
function assertConserved(allocation: PrizeAllocation, poolPaise: number, rolloverInPaise: number) {
  expect(
    totalPaidOut(allocation) + allocation.rolloverOutPaise + allocation.unclaimedRetainedPaise,
  ).toBe(poolPaise + rolloverInPaise);
}

describe("pool", () => {
  it("prices a month at 14,970 paise and a year at 12,497 paise per month", () => {
    expect(monthlyEquivalentPoolPaise("month")).toBe(14_970);
    expect(monthlyEquivalentPoolPaise("year")).toBe(12_497);
  });

  it("sums a mixed subscriber base", () => {
    const subs = [
      ...Array.from({ length: 200 }, () => ({ interval: "month" as const })),
      ...Array.from({ length: 100 }, () => ({ interval: "year" as const })),
    ];
    expect(computePoolPaise(subs)).toBe(200 * 14_970 + 100 * 12_497);
    expect(computePoolPaise([])).toBe(0);
  });
});

describe("splitTierPools", () => {
  it("splits 1,50,00,000 paise 40/35/25 exactly", () => {
    expect(splitTierPools(15_000_000, 0)).toEqual({ 5: 6_000_000, 4: 5_250_000, 3: 3_750_000 });
  });

  it("lets the jackpot absorb rounding so the tiers sum exactly", () => {
    const pools = splitTierPools(1_001, 0);
    expect(pools).toEqual({ 5: 401, 4: 350, 3: 250 });
    expect(pools[5] + pools[4] + pools[3]).toBe(1_001);
  });

  it("adds rollover to the jackpot only", () => {
    const pools = splitTierPools(4_500_000, 1_800_000);
    expect(pools).toEqual({ 5: 3_600_000, 4: 1_575_000, 3: 1_125_000 });
  });
});

describe("allocatePrizes", () => {
  it("pays two four-match and seven three-match winners, rolls the jackpot", () => {
    const matched = [
      winner("u1", 4),
      winner("u2", 4),
      ...["u3", "u4", "u5", "u6", "u7", "u8", "u9"].map((id) => winner(id, 3)),
      winner("nobody", 0),
    ];
    const allocation = allocatePrizes({
      poolPaise: 4_500_000,
      rolloverInPaise: 1_800_000,
      matched,
    });

    expect(allocation.prizes.filter((p) => p.tier === 4).map((p) => p.prizePaise)).toEqual([
      787_500, 787_500,
    ]);
    const threes = allocation.prizes.filter((p) => p.tier === 3).map((p) => p.prizePaise);
    expect(threes).toEqual([160_715, 160_715, 160_714, 160_714, 160_714, 160_714, 160_714]);
    expect(allocation.rolloverOutPaise).toBe(3_600_000);
    expect(allocation.unclaimedRetainedPaise).toBe(0);
    expect(allocation.prizes.some((p) => p.userId === "nobody")).toBe(false);
    assertConserved(allocation, 4_500_000, 1_800_000);
  });

  it("assigns the remainder paise in userId order for auditability", () => {
    const allocation = allocatePrizes({
      poolPaise: 10,
      rolloverInPaise: 0,
      matched: [winner("zed", 3), winner("amy", 3)],
    });
    // three-tier pool = floor(10 × 0.25) = 2 → 1 each; no remainder. Use a pool that leaves one.
    const odd = allocatePrizes({
      poolPaise: 12,
      rolloverInPaise: 0,
      matched: [winner("zed", 3), winner("amy", 3)],
    });
    expect(allocation.prizes.map((p) => p.userId)).toEqual(["amy", "zed"]);
    expect(odd.prizes.map((p) => [p.userId, p.prizePaise])).toEqual([
      ["amy", 2],
      ["zed", 1],
    ]);
  });

  it("with zero eligible members rolls the jackpot and retains the other tiers", () => {
    const allocation = allocatePrizes({ poolPaise: 15_000_000, rolloverInPaise: 0, matched: [] });
    expect(allocation.prizes).toEqual([]);
    expect(allocation.rolloverOutPaise).toBe(6_000_000);
    expect(allocation.unclaimedRetainedPaise).toBe(9_000_000);
    assertConserved(allocation, 15_000_000, 0);
  });

  it("splits a jackpot won by two people equally, including the rollover", () => {
    const allocation = allocatePrizes({
      poolPaise: 4_500_000,
      rolloverInPaise: 1_800_000,
      matched: [winner("a", 5), winner("b", 5)],
    });
    expect(allocation.prizes.map((p) => p.prizePaise)).toEqual([1_800_000, 1_800_000]);
    expect(allocation.rolloverOutPaise).toBe(0);
    expect(allocation.unclaimedRetainedPaise).toBe(1_575_000 + 1_125_000);
    assertConserved(allocation, 4_500_000, 1_800_000);
  });

  it("chains rollover across months exactly as GAME.md §6 describes", () => {
    const pool = 15_000_000; // jackpot base 6,000,000 = ₹60,000
    const jan = allocatePrizes({ poolPaise: pool, rolloverInPaise: 0, matched: [winner("x", 3)] });
    expect(jan.rolloverOutPaise).toBe(6_000_000);

    const feb = allocatePrizes({
      poolPaise: pool,
      rolloverInPaise: jan.rolloverOutPaise,
      matched: [],
    });
    expect(feb.tierPools[5]).toBe(12_000_000);
    expect(feb.rolloverOutPaise).toBe(12_000_000);

    const mar = allocatePrizes({
      poolPaise: pool,
      rolloverInPaise: feb.rolloverOutPaise,
      matched: [winner("w", 5)],
    });
    expect(mar.tierPools[5]).toBe(18_000_000);
    expect(mar.prizes[0]).toEqual({ userId: "w", tier: 5, prizePaise: 18_000_000 });
    expect(mar.rolloverOutPaise).toBe(0);

    const apr = allocatePrizes({
      poolPaise: pool,
      rolloverInPaise: mar.rolloverOutPaise,
      matched: [],
    });
    expect(apr.tierPools[5]).toBe(6_000_000);
  });

  it("conserves every paisa across a sweep of pools, rollovers and winner mixes", () => {
    const mixes = [
      [],
      [winner("a", 5)],
      [winner("a", 4), winner("b", 4), winner("c", 4)],
      [winner("a", 3), winner("b", 5), winner("c", 3), winner("d", 4)],
    ];
    for (let pool = 1; pool < 3_000; pool += 97) {
      for (const rollover of [0, 1, 999, 12_345]) {
        for (const matched of mixes) {
          assertConserved(
            allocatePrizes({ poolPaise: pool, rolloverInPaise: rollover, matched }),
            pool,
            rollover,
          );
        }
      }
    }
  });
});
