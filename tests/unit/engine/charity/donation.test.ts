import { describe, expect, it } from "vitest";
import { DONATION } from "@/config/constants";
import { ValidationError } from "@/engine/errors";
import { rupeesToPaise, validateDonationAmount } from "@/engine/charity/donation";

describe("validateDonationAmount", () => {
  it("accepts the minimum, presets and the cap", () => {
    expect(validateDonationAmount(DONATION.MIN_PAISE)).toBe(DONATION.MIN_PAISE);
    for (const preset of DONATION.PRESET_PAISE) expect(validateDonationAmount(preset)).toBe(preset);
    expect(validateDonationAmount(DONATION.MAX_PAISE)).toBe(DONATION.MAX_PAISE);
  });

  it("refuses below the minimum and above the cap", () => {
    expect(() => validateDonationAmount(DONATION.MIN_PAISE - 100)).toThrow(/minimum/);
    expect(() => validateDonationAmount(DONATION.MAX_PAISE + 100)).toThrow(/Up to/);
  });

  it("refuses fractions of a rupee and non-integers", () => {
    expect(() => validateDonationAmount(25_050)).toThrow(/whole number/);
    expect(() => validateDonationAmount(25_000.5)).toThrow(ValidationError);
    expect(() => validateDonationAmount(Number.NaN)).toThrow(ValidationError);
  });

  it("names the field", () => {
    try {
      validateDonationAmount(1);
    } catch (error) {
      expect((error as ValidationError).field).toBe("amount");
    }
  });
});

describe("rupeesToPaise", () => {
  it("converts form input", () => {
    expect(rupeesToPaise("250")).toBe(25_000);
    expect(rupeesToPaise(" 10 ")).toBe(1_000);
    expect(rupeesToPaise(99.99)).toBe(9_999);
    expect(rupeesToPaise("abc")).toBeNaN();
    expect(rupeesToPaise("")).toBe(0);
  });
});
