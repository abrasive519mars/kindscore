/** The slice of a profile that billing needs: who to charge, and where their money goes. */
export interface BillingProfile {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly charityId: string | null;
  readonly charityBps: number;
  readonly stripeCustomerId: string | null;
}

export interface ProfileRepository {
  findById(userId: string): Promise<BillingProfile | null>;
  findByStripeCustomerId(customerId: string): Promise<BillingProfile | null>;
  /** Service role only — `stripe_customer_id` is revoked from members at the column level. */
  setStripeCustomerId(userId: string, customerId: string): Promise<void>;
}
