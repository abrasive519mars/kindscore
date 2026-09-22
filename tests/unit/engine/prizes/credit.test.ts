import { describe, expect, it } from "vitest";
import { creditMonths, describeCredit } from "@/engine/prizes/credit";

describe("creditMonths", () => {
  it("divides the prize by the monthly price, to one decimal", () => {
    expect(creditMonths(156_520, 49_900)).toBe(3.1);
    expect(creditMonths(49_900, 49_900)).toBe(1);
  });

  it("is zero for a zero prize or a nonsense price", () => {
    expect(creditMonths(0, 49_900)).toBe(0);
    expect(creditMonths(1_000, 0)).toBe(0);
  });
});

describe("describeCredit", () => {
  it("reads as whole months, singular when one", () => {
    expect(describeCredit(156_520, 49_900)).toBe("about 3 months free");
    expect(describeCredit(52_000, 49_900)).toBe("about 1 month free");
  });

  it("says part of a month below one", () => {
    expect(describeCredit(20_000, 49_900)).toBe("part of a month free");
  });
});
