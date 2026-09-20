import { DRAW } from "@/config/constants";
import type { EligibleEntry } from "@/engine/draw/eligibility";

/** number (1..45) → how many eligible members hold it. Missing keys mean zero. */
export type FrequencyMap = ReadonlyMap<number, number>;

/** Each member votes once per distinct score: `33, 33, 28, …` adds 1 to 33, not 2. */
export function buildFrequencyMap(entries: readonly EligibleEntry[]): FrequencyMap {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    for (const score of new Set(entry.scores)) {
      counts.set(score, (counts.get(score) ?? 0) + 1);
    }
  }
  return counts;
}

const KERNEL = DRAW.SMOOTHING_KERNEL;
const KERNEL_RADIUS = (KERNEL.length - 1) / 2;

function isDrawableNumber(n: number): boolean {
  return n >= DRAW.NUMBER_MIN && n <= DRAW.NUMBER_MAX;
}

/** Dense: index = the number (1..45); index 0 is unused so `smoothed[n]` reads naturally. */
export type SmoothedFrequency = readonly number[];

/**
 * Blend each number's count with its neighbours (GAME.md §3 decision):
 *   smoothed(n) = Σ KERNEL[k + radius] · count(n + k)   for k in −radius..radius
 * Neighbours outside 1..45 are skipped, so edge numbers simply have fewer contributors.
 */
export function smoothFrequency(frequency: FrequencyMap): SmoothedFrequency {
  const smoothed = new Array<number>(DRAW.NUMBER_MAX + 1).fill(0);
  for (let n = DRAW.NUMBER_MIN; n <= DRAW.NUMBER_MAX; n++) {
    smoothed[n] = smoothedCountAt(n, frequency);
  }
  return smoothed;
}

function smoothedCountAt(n: number, frequency: FrequencyMap): number {
  let total = 0;
  for (let offset = -KERNEL_RADIUS; offset <= KERNEL_RADIUS; offset++) {
    const neighbour = n + offset;
    if (!isDrawableNumber(neighbour)) continue;
    total += KERNEL[offset + KERNEL_RADIUS] * (frequency.get(neighbour) ?? 0);
  }
  return total;
}
