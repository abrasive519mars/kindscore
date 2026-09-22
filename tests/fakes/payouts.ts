import type { CreditRequest, CustomerRequest, PayoutGateway } from "@/lib/stripe/PayoutGateway";

/** In-memory payout rail: records every customer created and every credit asked for. */
export class FakePayoutGateway implements PayoutGateway {
  customers: CustomerRequest[] = [];
  credits: CreditRequest[] = [];
  failNext: Error | null = null;

  async createCustomer(request: CustomerRequest) {
    this.customers.push(request);
    return { customerId: `cus_fake_${this.customers.length}` };
  }

  async creditCustomer(request: CreditRequest) {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    this.credits.push(request);
    return { reference: `cbtxn_fake_${request.verificationId}` };
  }
}
