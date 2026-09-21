import { LOCALE } from "@/config/constants";
import type { Paise } from "@/engine/money/paise";

/** One successful payment as the reports see it. */
export interface PaymentLine {
  readonly paidAt: string;
  readonly amountPaise: Paise;
  readonly poolPaise: Paise;
  readonly charityPaise: Paise;
  readonly platformPaise: Paise;
}

export interface MonthlyTotals {
  /** "2026-09" — the calendar month in India. */
  readonly month: string;
  readonly payments: number;
  readonly amountPaise: Paise;
  readonly poolPaise: Paise;
  readonly charityPaise: Paise;
  readonly platformPaise: Paise;
}

function monthOf(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LOCALE.TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/** PRD §11.05 "total prize pool" over time: payments grouped by Indian calendar month, newest first. */
export function summarisePaymentsByMonth(payments: readonly PaymentLine[]): MonthlyTotals[] {
  const byMonth = new Map<string, MonthlyTotals>();
  for (const line of payments) {
    const month = monthOf(line.paidAt);
    const current = byMonth.get(month) ?? {
      month,
      payments: 0,
      amountPaise: 0,
      poolPaise: 0,
      charityPaise: 0,
      platformPaise: 0,
    };
    byMonth.set(month, {
      month,
      payments: current.payments + 1,
      amountPaise: current.amountPaise + line.amountPaise,
      poolPaise: current.poolPaise + line.poolPaise,
      charityPaise: current.charityPaise + line.charityPaise,
      platformPaise: current.platformPaise + line.platformPaise,
    });
  }
  return [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
}
