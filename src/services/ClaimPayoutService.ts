import { NotFoundError } from "@/engine/errors";
import { formatMonth } from "@/engine/time/dates";
import { transition } from "@/engine/verification/stateMachine";
import type { PayoutGateway } from "@/lib/stripe/PayoutGateway";
import type {
  BillingProfile,
  ProfileRepository,
} from "@/repositories/interfaces/ProfileRepository";
import type { WinnerRepository, WinningRecord } from "@/repositories/interfaces/WinnerRepository";

export interface ClaimPayoutDeps {
  /** Scoped to the caller: the RPC checks auth.uid() against the row. */
  readonly winners: WinnerRepository;
  /** Service role: stripe_customer_id is revoked from members at the column level. */
  readonly profiles: ProfileRepository;
  readonly gateway: PayoutGateway;
}

/**
 * PRD §09's last step, owned by the winner: an approved prize is credited to their Stripe customer
 * (created on the spot if they never checked out) and the row is flipped to paid with Stripe's
 * transaction id. Ownership and state are checked before any money moves; the RPC checks again.
 */
export class ClaimPayoutService {
  constructor(private readonly deps: ClaimPayoutDeps) {}

  async claim(userId: string, verificationId: string): Promise<WinningRecord> {
    const record = await this.deps.winners.findForUser(userId, verificationId);
    if (!record) throw new NotFoundError("That win isn't yours to claim.");
    transition(
      { review: record.review, payout: record.payout, resubmissions: record.resubmissions },
      "claim_payout",
    );
    const profile = await this.deps.profiles.findById(userId);
    if (!profile) throw new NotFoundError("We couldn't find your profile.");

    const customerId = await this.customerFor(profile);
    const { reference } = await this.deps.gateway.creditCustomer({
      customerId,
      amountPaise: record.prizePaise,
      verificationId,
      description: `Kindscore prize · ${formatMonth(record.drawMonth)} draw · ${record.matchCount} matches`,
    });
    return this.deps.winners.claimPayout(verificationId, "stripe_credit", reference);
  }

  /** A member who subscribed through Checkout already has a customer; a seeded one gets one now. */
  private async customerFor(profile: BillingProfile): Promise<string> {
    if (profile.stripeCustomerId) return profile.stripeCustomerId;
    const { customerId } = await this.deps.gateway.createCustomer({
      userId: profile.id,
      email: profile.email,
      fullName: profile.fullName,
    });
    await this.deps.profiles.setStripeCustomerId(profile.id, customerId);
    return customerId;
  }
}
