import { DRAW } from "@/config/constants";
import { smoothFrequency, type FrequencyMap } from "@/engine/draw/frequency";
import type { Rng } from "@/engine/draw/rng";

export type DrawMode = "random" | "algorithmic";

/** Index = the number itself (1..45); index 0 is unused so weights[n] reads naturally. */
export type Weights = readonly number[];

const BPS_WHOLE = 10_000;

/**
 * Random: every number weighs 1. Algorithmic: baseline + strength × smoothed frequency
 * (GAME.md §3) — strength 0 collapses to uniform, 100% follows the scores in full.
 * Both modes feed the same sampler; the mode only changes the weights.
 */
export function buildWeights(
  mode: DrawMode,
  frequency: FrequencyMap,
  strengthBps: number = DRAW.WEIGHT_STRENGTH_DEFAULT_BPS,
): Weights {
  if (mode === "random") return uniformWeights();
  const strength = strengthBps / BPS_WHOLE;
  return smoothFrequency(frequency).map((count, n) =>
    n < DRAW.NUMBER_MIN ? 0 : DRAW.ALGORITHMIC_BASELINE_WEIGHT + strength * count,
  );
}

/** The same weights from a holders tally (index = the number) — the shape histograms receive. */
export function weightsFromHolders(
  mode: DrawMode,
  holders: readonly number[],
  strengthBps?: number,
): Weights {
  const frequency = new Map<number, number>();
  holders.forEach((count, n) => {
    if (n >= DRAW.NUMBER_MIN && count > 0) frequency.set(n, count);
  });
  return buildWeights(mode, frequency, strengthBps);
}

function uniformWeights(): Weights {
  const weights = new Array<number>(DRAW.NUMBER_MAX + 1).fill(1);
  weights[0] = 0;
  return weights;
}

/** Scale `r ∈ [0,1)` to the total weight and walk the cumulative sums until we pass it. */
export function pickWeightedIndex(weights: Weights, r: number): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = r * total;
  for (let n = 0; n < weights.length; n++) {
    if (weights[n] <= 0) continue;
    cursor -= weights[n];
    if (cursor < 0) return n;
  }
  return lastPositiveIndex(weights); // r rounded to exactly total; hand back the final candidate
}

function lastPositiveIndex(weights: Weights): number {
  for (let n = weights.length - 1; n >= 0; n--) {
    if (weights[n] > 0) return n;
  }
  throw new Error("No drawable numbers left");
}

/** Draw `count` distinct indices: pick, remove the pick from the drum, repeat. */
export function sampleWithoutReplacement(weights: Weights, count: number, rng: Rng): number[] {
  const drum = [...weights];
  const picks: number[] = [];
  while (picks.length < count) {
    const pick = pickWeightedIndex(drum, rng());
    picks.push(pick);
    drum[pick] = 0;
  }
  return picks;
}

export function generateNumbers(
  mode: DrawMode,
  frequency: FrequencyMap,
  rng: Rng,
  strengthBps?: number,
): number[] {
  const weights = buildWeights(mode, frequency, strengthBps);
  return sampleWithoutReplacement(weights, DRAW.NUMBERS_DRAWN, rng).sort((a, b) => a - b);
}
