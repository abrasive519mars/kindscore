import { describe, expect, it } from "vitest";
import { DRAW } from "@/config/constants";
import {
  buildWeights,
  generateNumbers,
  pickWeightedIndex,
  sampleWithoutReplacement,
  type DrawMode,
} from "@/engine/draw/generateNumbers";
import { secureRng, sequenceRng } from "@/engine/draw/rng";

const EMPTY = new Map<number, number>();
const PROPERTY_RUNS = 1_000;

function isValidDraw(numbers: number[]): boolean {
  const distinct = new Set(numbers).size === DRAW.NUMBERS_DRAWN;
  const inRange = numbers.every((n) => n >= DRAW.NUMBER_MIN && n <= DRAW.NUMBER_MAX);
  const sorted = numbers.every((n, i) => i === 0 || numbers[i - 1] < n);
  return distinct && inRange && sorted;
}

describe("buildWeights", () => {
  it("gives every number weight 1 in random mode", () => {
    const weights = buildWeights("random", new Map([[30, 500]]));
    expect(weights[0]).toBe(0);
    for (let n = DRAW.NUMBER_MIN; n <= DRAW.NUMBER_MAX; n++) expect(weights[n]).toBe(1);
  });

  it("uses baseline + smoothed frequency in algorithmic mode", () => {
    const weights = buildWeights("algorithmic", new Map([[30, 40]]));
    expect(weights[30]).toBe(DRAW.ALGORITHMIC_BASELINE_WEIGHT + 40);
    expect(weights[29]).toBe(DRAW.ALGORITHMIC_BASELINE_WEIGHT + 20);
    expect(weights[3]).toBe(DRAW.ALGORITHMIC_BASELINE_WEIGHT);
  });

  it("degrades to uniform when nobody has scored yet", () => {
    expect(buildWeights("algorithmic", EMPTY)).toEqual(buildWeights("random", EMPTY));
  });
});

describe("pickWeightedIndex", () => {
  const weights = [0, 1, 3, 6, 2]; // cumulative 1, 4, 10, 12

  it("walks the cumulative weights", () => {
    expect(pickWeightedIndex(weights, 0)).toBe(1);
    expect(pickWeightedIndex(weights, 0.5)).toBe(3); // 6 of 12 → inside index 3's band (4..10)
    expect(pickWeightedIndex(weights, 0.34)).toBe(3); // 4.08 → just past index 2's band
    expect(pickWeightedIndex(weights, 0.99)).toBe(4);
  });

  it("skips zero-weight slots", () => {
    expect(pickWeightedIndex([0, 0, 0, 5], 0.1)).toBe(3);
  });

  it("hands back the last candidate when r rounds to the total", () => {
    expect(pickWeightedIndex([0, 1, 1], 1)).toBe(2);
  });

  it("throws when nothing is drawable", () => {
    expect(() => pickWeightedIndex([0, 0], 0.5)).toThrow(/No drawable/);
  });
});

describe("sampleWithoutReplacement", () => {
  it("never repeats a pick", () => {
    const picks = sampleWithoutReplacement([0, 1, 1, 1], 3, sequenceRng([0, 0, 0]));
    expect(picks).toEqual([1, 2, 3]);
  });

  it("consumes exactly one random value per pick", () => {
    const rng = sequenceRng([0.2, 0.2]);
    sampleWithoutReplacement([0, 1, 1, 1], 2, rng);
    expect(() => rng()).toThrow(/exhausted/);
  });
});

describe("generateNumbers", () => {
  it.each<DrawMode>(["random", "algorithmic"])(
    `%s mode: ${PROPERTY_RUNS} draws are always 5 distinct sorted numbers in 1..45`,
    (mode) => {
      const freq = new Map([
        [30, 41],
        [31, 9],
        [32, 38],
      ]);
      for (let i = 0; i < PROPERTY_RUNS; i++) {
        expect(isValidDraw(generateNumbers(mode, freq, secureRng))).toBe(true);
      }
    },
  );

  it("is reproducible given the same random sequence", () => {
    const a = generateNumbers("random", EMPTY, sequenceRng([0.1, 0.5, 0.9, 0.3, 0.7]));
    const b = generateNumbers("random", EMPTY, sequenceRng([0.1, 0.5, 0.9, 0.3, 0.7]));
    expect(a).toEqual(b);
    expect(isValidDraw(a)).toBe(true);
  });

  it("draws the heavily weighted number first in algorithmic mode", () => {
    // 30 carries ~40× the weight of any other number; r = 0.5 lands inside its band.
    const rng = sequenceRng([0.5, 0.01, 0.02, 0.03, 0.04]);
    const numbers = generateNumbers("algorithmic", new Map([[30, 2_000]]), rng);
    expect(numbers).toContain(30);
  });

  it("random mode with a fixed sequence matches a hand-computed draw", () => {
    // 45 equal weights: r × 45 → index floor(r·45)+1 when nothing has been removed yet.
    const numbers = generateNumbers("random", EMPTY, sequenceRng([0, 0, 0, 0, 0]));
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });
});
