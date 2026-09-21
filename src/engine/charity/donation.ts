import { DONATION } from "@/config/constants";
import { ValidationError } from "@/engine/errors";
import { formatInr, type Paise } from "@/engine/money/paise";

const RUPEE = 100;

/**
 * A one-off gift (PRD §08.1 "not tied to gameplay"): whole rupees, at least the minimum, under a
 * sanity cap. The field name lets the form show the message beside the amount.
 */
export function validateDonationAmount(paise: number): Paise {
  if (!Number.isInteger(paise) || paise % RUPEE !== 0) {
    throw new ValidationError("Enter a whole number of rupees.", "amount");
  }
  if (paise < DONATION.MIN_PAISE) {
    throw new ValidationError(`The minimum is ${formatInr(DONATION.MIN_PAISE)}.`, "amount");
  }
  if (paise > DONATION.MAX_PAISE) {
    throw new ValidationError(`Up to ${formatInr(DONATION.MAX_PAISE)} per donation.`, "amount");
  }
  return paise;
}

/** "250" (rupees, from a form) → 25,000 paise; anything unparseable → NaN so validation refuses it. */
export function rupeesToPaise(rupees: string | number): number {
  const value = typeof rupees === "number" ? rupees : Number(String(rupees).trim());
  return Number.isFinite(value) ? Math.round(value * RUPEE) : Number.NaN;
}
