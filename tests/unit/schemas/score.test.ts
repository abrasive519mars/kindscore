import { describe, expect, it } from "vitest";
import { LOCALE } from "@/config/constants";
import { todayInTimezone } from "@/engine/time/dates";
import { scoreInputSchema } from "@/schemas/score";

const today = todayInTimezone(new Date(), LOCALE.TIMEZONE);
const tomorrow = new Date(`${today}T12:00:00Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const tomorrowIso = tomorrow.toISOString().slice(0, 10);

describe("scoreInputSchema", () => {
  it("accepts the boundaries and today", () => {
    expect(scoreInputSchema.parse({ score: "1", playedOn: today }).score).toBe(1);
    expect(scoreInputSchema.parse({ score: "45", playedOn: "2026-09-01" }).score).toBe(45);
  });

  it.each(["0", "46", "1.5", "abc", ""])("rejects score %s", (score) => {
    expect(scoreInputSchema.safeParse({ score, playedOn: "2026-09-01" }).success).toBe(false);
  });

  it("rejects a malformed or impossible date and a future date", () => {
    expect(scoreInputSchema.safeParse({ score: "30", playedOn: "2026-02-30" }).success).toBe(false);
    expect(scoreInputSchema.safeParse({ score: "30", playedOn: "12/09/2026" }).success).toBe(false);
    expect(scoreInputSchema.safeParse({ score: "30", playedOn: tomorrowIso }).success).toBe(false);
  });
});
