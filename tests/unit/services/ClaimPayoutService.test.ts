import { beforeEach, describe, expect, it } from "vitest";
import { ExternalServiceError, NotFoundError, RuleViolationError } from "@/engine/errors";
import { ClaimPayoutService } from "@/services/ClaimPayoutService";
import { FakeProfileRepository } from "../../fakes/billing";
import { FakePayoutGateway } from "../../fakes/payouts";
import { claim, FakeWinnerRepository } from "../../fakes/winners";

let winners: FakeWinnerRepository;
let profiles: FakeProfileRepository;
let gateway: FakePayoutGateway;
let service: ClaimPayoutService;

beforeEach(() => {
  winners = new FakeWinnerRepository();
  profiles = new FakeProfileRepository();
  gateway = new FakePayoutGateway();
  service = new ClaimPayoutService({ winners, profiles, gateway });
  winners.rows = [claim({ review: "approved", payout: "pending", prizePaise: 156_520 })];
  profiles.profiles = [
    {
      id: "user-1",
      email: "priya@kindscore.test",
      fullName: "Priya Test",
      charityId: null,
      charityBps: 1500,
      stripeCustomerId: null,
    },
  ];
});

describe("claim", () => {
  it("creates the Stripe customer once, credits the prize and records the reference", async () => {
    const paid = await service.claim("user-1", "ver-1");
    expect(gateway.customers).toHaveLength(1);
    expect(profiles.customerIdWrites).toEqual([{ userId: "user-1", customerId: "cus_fake_1" }]);
    expect(gateway.credits[0]).toMatchObject({
      customerId: "cus_fake_1",
      amountPaise: 156_520,
      verificationId: "ver-1",
    });
    expect(paid).toMatchObject({
      payout: "paid",
      payoutMethod: "stripe_credit",
      payoutReference: "cbtxn_fake_ver-1",
    });
  });

  it("reuses an existing Stripe customer", async () => {
    profiles.profiles = [{ ...profiles.profiles[0], stripeCustomerId: "cus_existing" }];
    await service.claim("user-1", "ver-1");
    expect(gateway.customers).toEqual([]);
    expect(gateway.credits[0].customerId).toBe("cus_existing");
  });

  it("refuses before approval, and nothing is credited", async () => {
    winners.rows = [claim({ review: "submitted" })];
    await expect(service.claim("user-1", "ver-1")).rejects.toBeInstanceOf(RuleViolationError);
    expect(gateway.credits).toEqual([]);
  });

  it("refuses a win that is not the caller's", async () => {
    await expect(service.claim("user-2", "ver-1")).rejects.toBeInstanceOf(NotFoundError);
    expect(gateway.credits).toEqual([]);
  });

  it("leaves the row pending when the provider fails, so the claim can be retried", async () => {
    gateway.failNext = new ExternalServiceError("Stripe payouts");
    await expect(service.claim("user-1", "ver-1")).rejects.toBeInstanceOf(ExternalServiceError);
    expect(winners.rows[0].payout).toBe("pending");
  });

  it("refuses a second claim of a paid prize", async () => {
    await service.claim("user-1", "ver-1");
    await expect(service.claim("user-1", "ver-1")).rejects.toBeInstanceOf(RuleViolationError);
    expect(gateway.credits).toHaveLength(1);
  });
});
