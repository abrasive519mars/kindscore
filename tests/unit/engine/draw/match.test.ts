import { describe, expect, it } from "vitest";
import { isEligibleTicket, selectEligibleEntries } from "@/engine/draw/eligibility";
import { countMatches, matchEntries, winningTierFor } from "@/engine/draw/match";
import { secureRng, sequenceRng } from "@/engine/draw/rng";

const DRAWN = [33, 12, 29, 36, 41];

describe("countMatches", () => {
  it("counts a repeated score once", () => {
    expect(countMatches([33, 33, 28, 36, 29], DRAWN)).toBe(3);
  });

  it("recognises a full match", () => {
    expect(countMatches([41, 36, 29, 12, 33], DRAWN)).toBe(5);
  });

  it("returns zero when nothing overlaps", () => {
    expect(countMatches([20, 22, 25, 27, 30], DRAWN)).toBe(0);
  });
});

describe("winningTierFor", () => {
  it.each([
    [5, 5],
    [4, 4],
    [3, 3],
    [2, null],
    [1, null],
    [0, null],
  ])("match count %s → tier %s", (count, tier) => {
    expect(winningTierFor(count)).toBe(tier);
  });
});

describe("matchEntries", () => {
  it("annotates every entry with its match count and tier", () => {
    const matched = matchEntries(DRAWN, [
      { userId: "priya", scores: [28, 33, 31, 36, 29] },
      { userId: "raj", scores: [33, 12, 29, 36, 41] },
      { userId: "anita", scores: [20, 22, 25, 27, 30] },
    ]);
    expect(matched.map((m) => [m.userId, m.matchCount, m.tier])).toEqual([
      ["priya", 3, 3],
      ["raj", 5, 5],
      ["anita", 0, null],
    ]);
  });
});

describe("eligibility", () => {
  it("requires exactly five scores", () => {
    expect(isEligibleTicket([1, 2, 3, 4, 5])).toBe(true);
    expect(isEligibleTicket([1, 2, 3, 4])).toBe(false);
    expect(isEligibleTicket([1, 2, 3, 4, 5, 6])).toBe(false);
  });

  it("filters candidates down to eligible entries", () => {
    const eligible = selectEligibleEntries([
      { userId: "full", scores: [1, 2, 3, 4, 5] },
      { userId: "short", scores: [1, 2, 3] },
    ]);
    expect(eligible.map((e) => e.userId)).toEqual(["full"]);
  });
});

describe("rng", () => {
  it("secureRng stays inside [0, 1)", () => {
    for (let i = 0; i < 1_000; i++) {
      const r = secureRng();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it("sequenceRng replays then throws", () => {
    const rng = sequenceRng([0.25]);
    expect(rng()).toBe(0.25);
    expect(() => rng()).toThrow(/exhausted after 1/);
  });
});
