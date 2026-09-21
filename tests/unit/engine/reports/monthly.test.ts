import { describe, expect, it } from "vitest";
import { summarisePaymentsByMonth } from "@/engine/reports/monthly";

const line = (paidAt: string, amount = 49_900) => ({
  paidAt,
  amountPaise: amount,
  poolPaise: Math.floor(amount * 0.3),
  charityPaise: Math.floor(amount * 0.1),
  platformPaise: amount - Math.floor(amount * 0.3) - Math.floor(amount * 0.1),
});

describe("summarisePaymentsByMonth", () => {
  it("groups by Indian calendar month, newest first, and sums every column", () => {
    const rows = summarisePaymentsByMonth([
      line("2026-08-15T10:00:00Z"),
      line("2026-09-02T10:00:00Z"),
      line("2026-09-20T10:00:00Z", 499_900),
    ]);
    expect(rows.map((r) => r.month)).toEqual(["2026-09", "2026-08"]);
    expect(rows[0]).toEqual({
      month: "2026-09",
      payments: 2,
      amountPaise: 549_800,
      poolPaise: 14_970 + 149_970,
      charityPaise: 4_990 + 49_990,
      platformPaise: 29_940 + 299_940,
    });
    expect(rows[1].payments).toBe(1);
  });

  it("uses the Indian date, not UTC, at the month boundary", () => {
    // 31 Aug 20:00 UTC is 1 Sep 01:30 IST.
    expect(summarisePaymentsByMonth([line("2026-08-31T20:00:00Z")])[0].month).toBe("2026-09");
  });

  it("is empty for no payments", () => {
    expect(summarisePaymentsByMonth([])).toEqual([]);
  });
});
