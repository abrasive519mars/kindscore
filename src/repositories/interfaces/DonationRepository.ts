import type { Paise } from "@/engine/money/paise";

export interface DonationRecord {
  readonly id: string;
  readonly userId: string;
  readonly charityId: string;
  readonly amountPaise: Paise;
  readonly stripeCheckoutSessionId: string | null;
  readonly paid: boolean;
  readonly createdAt: string;
}

export interface DonationWrite {
  /** Generated before Checkout so the Stripe session can name it in metadata. */
  readonly id: string;
  readonly userId: string;
  readonly charityId: string;
  readonly amountPaise: Paise;
  readonly stripeCheckoutSessionId: string;
}

export type MarkPaidOutcome = "paid" | "already_paid" | "not_found";

/**
 * A member opens a donation (unpaid, on their own client — RLS allows exactly that); only the
 * service role flips it to paid, from the webhook or the success-page sync. The ledger trigger
 * fires once, on the flip.
 */
export interface DonationRepository {
  create(write: DonationWrite): Promise<DonationRecord>;
  markPaid(id: string): Promise<MarkPaidOutcome>;
  findById(id: string): Promise<DonationRecord | null>;
  listForUser(userId: string): Promise<DonationRecord[]>;
  /** Every ledger line for this member (subscription slices + donations), newest first. */
  listContributionsForUser(userId: string): Promise<ContributionRecord[]>;
}

/** One line of a member's giving history — a subscription slice or a donation, from the ledger. */
export interface ContributionRecord {
  readonly id: string;
  readonly charityId: string;
  readonly charityName: string;
  readonly source: "subscription" | "donation";
  readonly amountPaise: Paise;
  readonly createdAt: string;
}
