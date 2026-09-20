import { MONTHS_PER_YEAR, PLANS, SPLIT, type PlanInterval } from "@/config/constants";
import { applyBps, type Paise } from "@/engine/money/paise";

export interface ActiveSubscription {
  readonly interval: PlanInterval;
}

/**
 * What one active subscriber adds to a single month's pool (GAME.md §5 decision):
 * a monthly payer contributes their full pool slice; a yearly payer's slice is spread over twelve draws.
 */
export function monthlyEquivalentPoolPaise(interval: PlanInterval): Paise {
  const yearlyOrMonthlySlice = applyBps(PLANS[interval].pricePaise, SPLIT.POOL_SHARE_BPS);
  if (interval === "month") return yearlyOrMonthlySlice;
  return Math.floor(yearlyOrMonthlySlice / MONTHS_PER_YEAR);
}

/** PRD §07 "auto-calculation … based on active subscriber count": the pool is the sum over everyone active at draw time. */
export function computePoolPaise(subscriptions: readonly ActiveSubscription[]): Paise {
  return subscriptions.reduce((total, sub) => total + monthlyEquivalentPoolPaise(sub.interval), 0);
}
