import type { Paise } from "@/engine/money/paise";

/**
 * A prize paid as subscription credit is worth this many renewals at the given price — the number
 * the winner reads ("about 3 months free"). Rounded to one decimal; never negative.
 */
export function creditMonths(prizePaise: Paise, monthlyPricePaise: Paise): number {
  if (monthlyPricePaise <= 0 || prizePaise <= 0) return 0;
  return Math.round((prizePaise / monthlyPricePaise) * 10) / 10;
}

/** "about 3 months free" / "about 1 month free" / "part of a month free". */
export function describeCredit(prizePaise: Paise, monthlyPricePaise: Paise): string {
  const months = creditMonths(prizePaise, monthlyPricePaise);
  if (months < 1) return "part of a month free";
  const whole = Math.round(months);
  return `about ${whole} ${whole === 1 ? "month" : "months"} free`;
}
