import { LOCALE, SPLIT } from "@/config/constants";
import { ValidationError } from "@/engine/errors";

/**
 * Money in Kindscore is always an integer number of paise (₹1 = 100 paise).
 * Integers make every split exact; floats would drift by fractions of a paisa.
 */
export type Paise = number;

/** Basis points: 1% = 100 bps, 100% = 10 000 bps. */
export type Bps = number;

const PAISE_PER_RUPEE = 100;

export function assertPaise(value: number, label = "amount"): Paise {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a whole, non-negative number of paise`, label);
  }
  return value;
}

/** `amount × bps / 10 000`, rounded down. Rounding down never creates money. */
export function applyBps(amountPaise: Paise, bps: Bps): Paise {
  assertPaise(amountPaise);
  return Math.floor((amountPaise * bps) / SPLIT.BPS_DENOMINATOR);
}

/**
 * Divide `totalPaise` into `count` shares that sum to exactly `totalPaise`.
 * Each share is floor(total / count); the first `total mod count` shares get one extra paisa.
 */
export function splitEqualPaise(totalPaise: Paise, count: number): readonly Paise[] {
  assertPaise(totalPaise, "total");
  if (count <= 0) return [];

  const base = Math.floor(totalPaise / count);
  const remainder = totalPaise % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** `₹1,80,000` for whole rupees, `₹2,500.50` otherwise — Indian digit grouping. */
export function formatInr(paise: Paise): string {
  assertPaise(paise);
  const rupees = paise / PAISE_PER_RUPEE;
  const isWhole = paise % PAISE_PER_RUPEE === 0;
  return new Intl.NumberFormat(LOCALE.NUMBER_LOCALE, {
    style: "currency",
    currency: LOCALE.CURRENCY,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
