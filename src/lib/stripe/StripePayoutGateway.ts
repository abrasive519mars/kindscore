import type Stripe from "stripe";
import { BILLING } from "@/config/constants";
import { ExternalServiceError } from "@/engine/errors";
import type { CreditRequest, CustomerRequest, PayoutGateway } from "@/lib/stripe/PayoutGateway";

/**
 * Stripe's customer balance as the payout rail: a negative balance transaction is a credit that
 * Stripe applies to the customer's next invoices. The idempotency key makes a retried claim return
 * the original transaction instead of crediting again.
 */
export class StripePayoutGateway implements PayoutGateway {
  constructor(private readonly stripe: Stripe) {}

  async createCustomer(request: CustomerRequest): Promise<{ customerId: string }> {
    const customer = await this.call(() =>
      this.stripe.customers.create({
        email: request.email,
        name: request.fullName,
        metadata: { user_id: request.userId },
      }),
    );
    return { customerId: customer.id };
  }

  async creditCustomer(request: CreditRequest): Promise<{ reference: string }> {
    const transaction = await this.call(() =>
      this.stripe.customers.createBalanceTransaction(
        request.customerId,
        {
          amount: -request.amountPaise,
          currency: BILLING.CURRENCY,
          description: request.description,
          metadata: { verification_id: request.verificationId },
        },
        { idempotencyKey: `claim_${request.verificationId}` },
      ),
    );
    return { reference: transaction.id };
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw new ExternalServiceError("Stripe payouts", error);
    }
  }
}
