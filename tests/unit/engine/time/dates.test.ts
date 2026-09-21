import { describe, expect, it } from "vitest";
import { LOCALE } from "@/config/constants";
import {
  addOneMonth,
  compareIsoDates,
  firstOfMonth,
  formatMonth,
  formatShortDate,
  isFutureDate,
  isIsoDate,
  nextDrawMonth,
  todayInTimezone,
} from "@/engine/time/dates";

describe("isIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isIsoDate("2026-09-12")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true); // leap year
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2027-02-29",
    "2026-9-12",
    "12/09/2026",
    "",
    20260912,
    null,
  ])("rejects %s", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("todayInTimezone", () => {
  it("rolls over at IST midnight, not UTC midnight", () => {
    // 19:00 UTC on 12 Sep is 00:30 IST on 13 Sep
    expect(todayInTimezone(new Date("2026-09-12T19:00:00Z"), LOCALE.TIMEZONE)).toBe("2026-09-13");
    // 18:00 UTC on 12 Sep is 23:30 IST on 12 Sep
    expect(todayInTimezone(new Date("2026-09-12T18:00:00Z"), LOCALE.TIMEZONE)).toBe("2026-09-12");
  });

  it("returns the ISO shape", () => {
    expect(isIsoDate(todayInTimezone(new Date(), LOCALE.TIMEZONE))).toBe(true);
  });
});

describe("compareIsoDates / isFutureDate", () => {
  it("orders by calendar date", () => {
    expect(compareIsoDates("2026-09-12", "2026-09-13")).toBe(-1);
    expect(compareIsoDates("2026-09-13", "2026-09-12")).toBe(1);
    expect(compareIsoDates("2026-09-12", "2026-09-12")).toBe(0);
    expect(compareIsoDates("2025-12-31", "2026-01-01")).toBe(-1);
  });

  it("flags tomorrow as future and today as not", () => {
    expect(isFutureDate("2026-09-13", "2026-09-12")).toBe(true);
    expect(isFutureDate("2026-09-12", "2026-09-12")).toBe(false);
  });
});

describe("formatShortDate", () => {
  it("renders day and short month", () => {
    expect(formatShortDate("2026-09-12")).toBe("12 Sept");
  });
});

describe("draw months", () => {
  it("firstOfMonth keys any date to its month", () => {
    expect(firstOfMonth("2026-09-21")).toBe("2026-09-01");
  });

  it("addOneMonth rolls over the year", () => {
    expect(addOneMonth("2026-12-01")).toBe("2027-01-01");
    expect(addOneMonth("2026-01-01")).toBe("2026-02-01");
  });

  it("nextDrawMonth is this month for the first draw, else the month after the last published", () => {
    expect(nextDrawMonth(null, "2026-09-21")).toBe("2026-09-01");
    expect(nextDrawMonth("2026-09-01", "2026-09-21")).toBe("2026-10-01");
    expect(nextDrawMonth("2026-12-01", "2027-03-05")).toBe("2027-01-01");
  });

  it("formatMonth names the month", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
  });
});
