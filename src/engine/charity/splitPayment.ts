import { SPLIT } from "@/config/constants";
import { ValidationError } from "@/engine/errors";
import { applyBps, assertPaise, type Bps, type Paise } from "@/engine/money/paise";

/**
 * How one subscription payment is divided (PRD §07, §08.1; GAME.md §1).
 * The pool takes its fixed share first; the charity takes the member's chosen share;
 * the platform keeps whatever remains. The three always sum to the amount paid.
 */
export interface PaymentSplit {
  readonly charityPaise: Paise;
  readonly poolPaise: Paise;
  readonly platformPaise: Paise;
}

export function validateCharityBps(bps: number): Bps {
  const { CHARITY_MIN_BPS, CHARITY_MAX_BPS, CHARITY_STEP_BPS } = SPLIT;
  if (!Number.isInteger(bps) || bps < CHARITY_MIN_BPS || bps > CHARITY_MAX_BPS) {
    throw new ValidationError(
      `Charity share must be between ${CHARITY_MIN_BPS / 100}% and ${CHARITY_MAX_BPS / 100}%`,
      "charityBps",
    );
  }
  if (bps % CHARITY_STEP_BPS !== 0) {
    throw new ValidationError(`Charity share must be a multiple of ${CHARITY_STEP_BPS / 100}%`, "charityBps");
  }
  return bps;
}

export function splitPayment(amountPaise: Paise, charityBps: Bps): PaymentSplit {
  assertPaise(amountPaise);
  validateCharityBps(charityBps);

  const poolPaise = applyBps(amountPaise, SPLIT.POOL_SHARE_BPS);
  const charityPaise = applyBps(amountPaise, charityBps);
  const platformPaise = amountPaise - poolPaise - charityPaise;

  return { charityPaise, poolPaise, platformPaise };
}
