import { validateDonationAmount } from "@/engine/charity/donation";
import { NotFoundError, RuleViolationError } from "@/engine/errors";
import type { BillingGateway } from "@/lib/stripe/BillingGateway";
import type { CharityRepository } from "@/repositories/interfaces/CharityRepository";
import type {
  DonationRepository,
  MarkPaidOutcome,
} from "@/repositories/interfaces/DonationRepository";

export interface StartDonation {
  readonly userId: string;
  readonly email: string;
  readonly charityId: string;
  readonly amountPaise: number;
  /** Where Stripe sends the member back; `{CHECKOUT_SESSION_ID}` is filled in by Stripe. */
  readonly returnPath: string;
}

/**
 * One-off gifts (PRD §08.1). The donation id is generated here, before Checkout, so the Stripe
 * session carries it in metadata and the row carries the session id — the webhook and the
 * success-page sync then both resolve to one idempotent markPaid, and the ledger trigger fires once.
 */
export class DonationService {
  constructor(
    private readonly donations: DonationRepository,
    private readonly charities: CharityRepository,
    private readonly gateway: BillingGateway,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async start(input: StartDonation): Promise<{ url: string }> {
    const amountPaise = validateDonationAmount(input.amountPaise);
    const charity = await this.charities.findById(input.charityId);
    if (!charity) throw new NotFoundError("That charity isn't listed.");
    if (!charity.isActive)
      throw new RuleViolationError("That charity is no longer taking donations.");

    const id = this.newId();
    const session = await this.gateway.createDonationCheckout({
      donationId: id,
      userId: input.userId,
      email: input.email,
      charityName: charity.name,
      amountPaise,
      returnPath: input.returnPath,
    });
    await this.donations.create({
      id,
      userId: input.userId,
      charityId: charity.id,
      amountPaise,
      stripeCheckoutSessionId: session.id,
    });
    return { url: session.url };
  }

  /** Webhook path: the event names the donation. */
  markPaid(donationId: string): Promise<MarkPaidOutcome> {
    return this.donations.markPaid(donationId);
  }

  /** Success-page path: ask Stripe whether the session completed, then the same markPaid. */
  async syncFromCheckout(sessionId: string): Promise<MarkPaidOutcome | "not_complete"> {
    const completed = await this.gateway.retrieveCompletedDonation(sessionId);
    if (!completed) return "not_complete";
    return this.donations.markPaid(completed.donationId);
  }
}
