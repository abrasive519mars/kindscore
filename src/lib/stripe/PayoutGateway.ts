export interface CustomerRequest {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
}

export interface CreditRequest {
  readonly customerId: string;
  readonly amountPaise: number;
  /** The verification id: doubles as the idempotency key, so a retried claim never credits twice. */
  readonly verificationId: string;
  readonly description: string;
}

/**
 * How a prize leaves Kindscore. Today: Stripe customer-balance credit (applied to the winner's next
 * renewals). A cash rail (RazorpayX, Stripe Connect) is another implementation of the same port;
 * the claim service and the pages never learn which one is behind it.
 */
export interface PayoutGateway {
  createCustomer(request: CustomerRequest): Promise<{ customerId: string }>;
  /** Credits the customer and returns the provider's transaction reference. */
  creditCustomer(request: CreditRequest): Promise<{ reference: string }>;
}
