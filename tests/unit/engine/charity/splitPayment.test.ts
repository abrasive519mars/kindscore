import { describe, expect, it } from "vitest";
import { PLANS, SPLIT } from "@/config/constants";
import { splitPayment, validateCharityBps } from "@/engine/charity/splitPayment";
import { ValidationError } from "@/engine/errors";

describe("validateCharityBps", () => {
  it("accepts the floor, the cap and steps between", () => {
    expect(validateCharityBps(1_000)).toBe(1_000);
    expect(validateCharityBps(7_000)).toBe(7_000);
    expect(validateCharityBps(3_500)).toBe(3_500);
  });

  it.each([900, 7_100, 0, 10_000])("rejects %s as out of range", (bps) => {
    expect(() => validateCharityBps(bps)).toThrow(ValidationError);
  });

  it("rejects values that are not on the slider step", () => {
    expect(() => validateCharityBps(1_050)).toThrow(ValidationError);
    expect(() => validateCharityBps(1_000.5)).toThrow(ValidationError);
  });

  it("derives the cap from the pool share", () => {
    expect(SPLIT.CHARITY_MAX_BPS).toBe(10_000 - SPLIT.POOL_SHARE_BPS);
  });
});

describe("splitPayment", () => {
  it("splits ₹499 at the 10% floor into 4,990 / 14,970 / 29,940", () => {
    expect(splitPayment(49_900, 1_000)).toEqual({
      charityPaise: 4_990,
      poolPaise: 14_970,
      platformPaise: 29_940,
    });
  });

  it("leaves the platform nothing at the 70% cap", () => {
    expect(splitPayment(49_900, 7_000)).toEqual({
      charityPaise: 34_930,
      poolPaise: 14_970,
      platformPaise: 0,
    });
  });

  it("works for the yearly plan", () => {
    const split = splitPayment(PLANS.year.pricePaise, 1_000);
    expect(split.poolPaise).toBe(149_970);
    expect(split.charityPaise).toBe(49_990);
  });

  it("always sums to the amount and never goes negative across a sweep", () => {
    for (let amount = 1; amount < 5_000; amount += 37) {
      for (
        let bps = SPLIT.CHARITY_MIN_BPS;
        bps <= SPLIT.CHARITY_MAX_BPS;
        bps += SPLIT.CHARITY_STEP_BPS
      ) {
        const { charityPaise, poolPaise, platformPaise } = splitPayment(amount, bps);
        expect(charityPaise + poolPaise + platformPaise).toBe(amount);
        expect(platformPaise).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rejects an invalid charity share before computing anything", () => {
    expect(() => splitPayment(49_900, 500)).toThrow(ValidationError);
  });
});
