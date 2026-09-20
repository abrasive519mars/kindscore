import { describe, expect, it } from "vitest";
import { ValidationError } from "@/engine/errors";
import { applyBps, assertPaise, formatInr, splitEqualPaise } from "@/engine/money/paise";

describe("assertPaise", () => {
  it("accepts whole non-negative amounts", () => {
    expect(assertPaise(0)).toBe(0);
    expect(assertPaise(49_900)).toBe(49_900);
  });

  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])("rejects %s", (value) => {
    expect(() => assertPaise(value)).toThrow(ValidationError);
  });
});

describe("applyBps", () => {
  it("computes 30% of ₹499 as 14,970 paise", () => {
    expect(applyBps(49_900, 3_000)).toBe(14_970);
  });

  it("rounds down, never up", () => {
    expect(applyBps(1_001, 3_500)).toBe(350); // 350.35
    expect(applyBps(1, 9_999)).toBe(0);
  });
});

describe("splitEqualPaise", () => {
  it("splits 3,750,000 among 7 so the first two carry the remainder and the sum is exact", () => {
    const shares = splitEqualPaise(3_750_000, 7);
    expect(shares).toEqual([535_715, 535_715, 535_714, 535_714, 535_714, 535_714, 535_714]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(3_750_000);
  });

  it("returns an empty list for zero or negative winners", () => {
    expect(splitEqualPaise(1_000, 0)).toEqual([]);
    expect(splitEqualPaise(1_000, -3)).toEqual([]);
  });

  it("gives the whole amount to a single winner", () => {
    expect(splitEqualPaise(6_000_000, 1)).toEqual([6_000_000]);
  });

  it("always sums to the total across a sweep of amounts and counts", () => {
    for (let total = 0; total < 500; total += 7) {
      for (let count = 1; count <= 13; count++) {
        const shares = splitEqualPaise(total, count);
        expect(shares).toHaveLength(count);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("formatInr", () => {
  it("uses Indian digit grouping and drops paise for whole rupees", () => {
    expect(formatInr(18_000_000)).toBe("₹1,80,000");
    expect(formatInr(49_900)).toBe("₹499");
  });

  it("shows two decimals when there are loose paise", () => {
    expect(formatInr(250_050)).toBe("₹2,500.50");
    expect(formatInr(1)).toBe("₹0.01");
  });
});
