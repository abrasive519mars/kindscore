import { describe, expect, it } from "vitest";
import { DRAW } from "@/config/constants";
import { buildFrequencyMap, smoothFrequency } from "@/engine/draw/frequency";

describe("buildFrequencyMap", () => {
  it("counts each member once per distinct score", () => {
    const freq = buildFrequencyMap([
      { userId: "u1", scores: [33, 33, 28, 36, 29] },
      { userId: "u2", scores: [33, 12, 29, 36, 41] },
    ]);
    expect(freq.get(33)).toBe(2); // u1's repeat counts once
    expect(freq.get(29)).toBe(2);
    expect(freq.get(28)).toBe(1);
    expect(freq.get(12)).toBe(1);
    expect(freq.get(7)).toBeUndefined();
  });

  it("is empty for no entries", () => {
    expect(buildFrequencyMap([]).size).toBe(0);
  });
});

describe("smoothFrequency", () => {
  it("spreads a lone spike to ±2 neighbours in kernel ratios", () => {
    const smoothed = smoothFrequency(new Map([[30, 40]]));
    expect(smoothed[30]).toBe(40);
    expect(smoothed[29]).toBe(20);
    expect(smoothed[31]).toBe(20);
    expect(smoothed[28]).toBe(10);
    expect(smoothed[32]).toBe(10);
    expect(smoothed[27]).toBe(0);
    expect(smoothed[33]).toBe(0);
  });

  it("fills a single-number gap between popular neighbours", () => {
    const raw = new Map([
      [28, 25],
      [29, 40],
      [30, 41],
      [31, 9],
      [32, 38],
      [33, 30],
    ]);
    const smoothed = smoothFrequency(raw);
    // 31: ¼·40 + ½·41 + 9 + ½·38 + ¼·30 = 66
    expect(smoothed[31]).toBe(66);
    // 30: ¼·25 + ½·40 + 41 + ½·9 + ¼·38 = 81.25
    expect(smoothed[30]).toBe(81.25);
    expect(smoothed[31] / smoothed[30]).toBeGreaterThan(0.75);
  });

  it("clips at the edges instead of wrapping", () => {
    const low = smoothFrequency(new Map([[1, 8]]));
    expect(low[1]).toBe(8);
    expect(low[2]).toBe(4);
    expect(low[3]).toBe(2);
    expect(low[0]).toBe(0); // index 0 is never a drawable number

    const high = smoothFrequency(new Map([[45, 8]]));
    expect(high[45]).toBe(8);
    expect(high[44]).toBe(4);
    expect(high).toHaveLength(DRAW.NUMBER_MAX + 1);
  });

  it("returns every drawable number, all zero, for an empty map", () => {
    const smoothed = smoothFrequency(new Map());
    expect(smoothed).toHaveLength(DRAW.NUMBER_MAX + 1);
    expect(smoothed.every((v) => v === 0)).toBe(true);
  });
});
