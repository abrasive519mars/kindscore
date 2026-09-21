import { describe, expect, it } from "vitest";
import { sequenceRng } from "@/engine/draw/rng";
import {
  describePracticeOutcome,
  jackpotLadder,
  PRACTICE_SAMPLE,
  practiceDraw,
} from "@/engine/draw/practice";
import { proofFigures } from "@/engine/landing/figures";

describe("practiceDraw", () => {
  it("draws five distinct numbers with the real engine and counts matches on the sample row", () => {
    const result = practiceDraw("random", sequenceRng([0, 0, 0, 0, 0]));
    expect(result.numbers).toEqual([1, 2, 3, 4, 5]);
    expect(result.matches).toBe(0);
    expect(result.tier).toBeNull();
  });

  it("weighted mode still yields five distinct numbers in range, ×200", () => {
    for (let i = 0; i < 200; i++) {
      const { numbers } = practiceDraw("algorithmic");
      expect(new Set(numbers).size).toBe(5);
      expect(numbers.every((n) => n >= 1 && n <= 45)).toBe(true);
    }
  });

  it("describes every outcome", () => {
    const sample = [...PRACTICE_SAMPLE];
    expect(describePracticeOutcome({ numbers: sample, matches: 5, tier: 5 })).toMatch(/jackpot/);
    expect(describePracticeOutcome({ numbers: sample, matches: 4, tier: 4 })).toMatch(/35%/);
    expect(describePracticeOutcome({ numbers: sample, matches: 3, tier: 3 })).toMatch(
      /Three is all it takes/,
    );
    expect(describePracticeOutcome({ numbers: sample, matches: 2, tier: null })).toMatch(
      /Two matches/,
    );
    expect(describePracticeOutcome({ numbers: sample, matches: 0, tier: null })).toMatch(
      /No match/,
    );
  });
});

describe("jackpotLadder", () => {
  it("keeps the last three published months in order and appends the next month", () => {
    const ladder = jackpotLadder(
      [
        { drawMonth: "2026-08-01", jackpotPaise: 18_000_000 },
        { drawMonth: "2026-05-01", jackpotPaise: 3_000_000 },
        { drawMonth: "2026-06-01", jackpotPaise: 6_000_000 },
        { drawMonth: "2026-07-01", jackpotPaise: 12_000_000 },
      ],
      "2026-09-01",
    );
    expect(ladder.map((s) => [s.month, s.jackpotPaise, s.upcoming])).toEqual([
      ["2026-06-01", 6_000_000, false],
      ["2026-07-01", 12_000_000, false],
      ["2026-08-01", 18_000_000, false],
      ["2026-09-01", null, true],
    ]);
  });

  it("is just the upcoming month before any draw", () => {
    expect(jackpotLadder([], "2026-09-01")).toEqual([
      { month: "2026-09-01", jackpotPaise: null, upcoming: true },
    ]);
  });
});

describe("proofFigures", () => {
  it("omits anything that would read zero", () => {
    expect(proofFigures({ charityTotalPaise: 0, jackpotPaise: 0, activeMembers: 0 })).toEqual([]);
    const figures = proofFigures({
      charityTotalPaise: 24_130_000,
      jackpotPaise: 0,
      activeMembers: 312,
    });
    expect(figures.map((f) => f.label)).toEqual(["given to charities", "golfers playing"]);
    expect(
      proofFigures({ charityTotalPaise: 0, jackpotPaise: 100, activeMembers: 1 })[1].label,
    ).toBe("golfer playing");
  });
});
