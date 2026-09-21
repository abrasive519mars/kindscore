import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, RuleViolationError, ValidationError } from "@/engine/errors";
import { DonationService } from "@/services/DonationService";
import { FakeBillingGateway } from "../../fakes/billing";
import { charity, FakeCharityRepository, FakeDonationRepository } from "../../fakes/charities";

let donations: FakeDonationRepository;
let charities: FakeCharityRepository;
let gateway: FakeBillingGateway;
let service: DonationService;

const input = {
  userId: "user-1",
  email: "member@kindscore.test",
  charityId: "c-1",
  amountPaise: 25_000,
  returnPath: "/charities/neer-jal?session_id={CHECKOUT_SESSION_ID}",
};

beforeEach(() => {
  donations = new FakeDonationRepository();
  charities = new FakeCharityRepository();
  charities.charities = [charity()];
  gateway = new FakeBillingGateway();
  let n = 0;
  service = new DonationService(donations, charities, gateway, () => `don-${++n}`);
});

describe("start", () => {
  it("creates the Checkout session with the donation id in metadata, then the unpaid row with the session id", async () => {
    const { url } = await service.start(input);
    expect(url).toBe("https://checkout.stripe.test/donate/don-1");
    expect(gateway.donationRequests[0]).toMatchObject({
      donationId: "don-1",
      userId: "user-1",
      charityName: "Neer Jal Trust",
      amountPaise: 25_000,
      returnPath: input.returnPath,
    });
    expect(donations.rows[0]).toMatchObject({
      id: "don-1",
      charityId: "c-1",
      amountPaise: 25_000,
      stripeCheckoutSessionId: "cs_don-1",
      paid: false,
    });
  });

  it("refuses below the minimum before touching Stripe", async () => {
    await expect(service.start({ ...input, amountPaise: 500 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(gateway.donationRequests).toEqual([]);
    expect(donations.rows).toEqual([]);
  });

  it("refuses a hidden or unknown charity", async () => {
    charities.charities = [charity({ isActive: false })];
    await expect(service.start(input)).rejects.toBeInstanceOf(RuleViolationError);
    await expect(service.start({ ...input, charityId: "nope" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(gateway.donationRequests).toEqual([]);
  });
});

describe("marking paid", () => {
  it("is idempotent from the webhook", async () => {
    await service.start(input);
    expect(await service.markPaid("don-1")).toBe("paid");
    expect(await service.markPaid("don-1")).toBe("already_paid");
    expect(await service.markPaid("ghost")).toBe("not_found");
  });

  it("from the success page: only when Stripe says the session completed", async () => {
    await service.start(input);
    expect(await service.syncFromCheckout("cs_don-1")).toBe("not_complete");
    gateway.completedDonations.set("cs_don-1", { donationId: "don-1", amountPaise: 25_000 });
    expect(await service.syncFromCheckout("cs_don-1")).toBe("paid");
    expect(await service.syncFromCheckout("cs_don-1")).toBe("already_paid");
    expect(donations.rows[0].paid).toBe(true);
  });
});
