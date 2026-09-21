import { describe, expect, it } from "vitest";
import { hasActiveAccess, mapStripeStatus } from "@/engine/subscription/status";

describe("mapStripeStatus", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["canceled", "cancelled"],
    ["unpaid", "lapsed"],
    ["incomplete", "lapsed"],
    ["incomplete_expired", "lapsed"],
    ["paused", "lapsed"],
    ["something_new", "lapsed"],
  ])("%s → %s", (stripe, local) => {
    expect(mapStripeStatus(stripe)).toBe(local);
  });
});

describe("hasActiveAccess", () => {
  const now = new Date("2026-09-21T12:00:00Z");

  it("grants access to an active subscription inside its period", () => {
    expect(
      hasActiveAccess({ status: "active", currentPeriodEnd: "2026-10-05T00:00:00Z" }, now),
    ).toBe(true);
  });

  it("denies once the paid period has ended, even if status was never updated", () => {
    expect(
      hasActiveAccess({ status: "active", currentPeriodEnd: "2026-09-21T11:59:59Z" }, now),
    ).toBe(false);
    expect(
      hasActiveAccess({ status: "active", currentPeriodEnd: "2026-09-21T12:00:00Z" }, now),
    ).toBe(false);
  });

  it.each(["past_due", "cancelled", "lapsed"] as const)(
    "denies %s regardless of period",
    (status) => {
      expect(hasActiveAccess({ status, currentPeriodEnd: "2099-01-01T00:00:00Z" }, now)).toBe(
        false,
      );
    },
  );

  it("denies when there is no subscription at all", () => {
    expect(hasActiveAccess(null, now)).toBe(false);
  });
});
