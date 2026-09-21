import { describe, expect, it } from "vitest";
import { deriveAccess } from "@/lib/auth/derive";
import type { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

const now = new Date("2026-09-21T12:00:00Z");

function profile(role: "member" | "admin" = "member"): ProfileRow {
  return {
    id: "u1",
    email: "u1@kindscore.test",
    full_name: "U One",
    role,
    charity_id: null,
    charity_bps: 1000,
    stripe_customer_id: null,
    created_at: "",
    updated_at: "",
  };
}

function subscription(status: SubscriptionRow["status"], end: string): SubscriptionRow {
  return {
    id: "s1",
    user_id: "u1",
    stripe_subscription_id: "sub_1",
    stripe_price_id: "price_m",
    plan_interval: "month",
    status,
    current_period_start: "2026-09-05T00:00:00Z",
    current_period_end: end,
    cancel_at_period_end: false,
    last_event_at: null,
    canceled_at: null,
    source: "stripe",
    created_at: "",
    updated_at: "",
  };
}

describe("deriveAccess", () => {
  it("is anonymous without a user or profile", () => {
    expect(deriveAccess(null, null, null, now)).toEqual({ kind: "anonymous" });
    expect(deriveAccess("u1", null, null, now)).toEqual({ kind: "anonymous" });
  });

  it("is a locked member with no subscription", () => {
    const access = deriveAccess("u1", profile(), null, now);
    expect(access.kind).toBe("member");
    if (access.kind === "anonymous") throw new Error();
    expect(access.subscription).toMatchObject({ status: "none", hasAccess: false });
  });

  it("has access when active and inside the period", () => {
    const access = deriveAccess(
      "u1",
      profile(),
      subscription("active", "2026-10-05T00:00:00Z"),
      now,
    );
    if (access.kind === "anonymous") throw new Error();
    expect(access.subscription.hasAccess).toBe(true);
  });

  it("loses access once the period has ended even if status is stale", () => {
    const access = deriveAccess(
      "u1",
      profile(),
      subscription("active", "2026-09-20T00:00:00Z"),
      now,
    );
    if (access.kind === "anonymous") throw new Error();
    expect(access.subscription.hasAccess).toBe(false);
  });

  it("recognises admins", () => {
    expect(deriveAccess("u1", profile("admin"), null, now).kind).toBe("admin");
  });
});
