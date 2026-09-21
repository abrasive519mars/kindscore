import type { PaymentSplit } from "@/engine/charity/splitPayment";

/** One successful Stripe invoice with its three-way split frozen at payment time. */
export interface PaymentWrite {
  readonly userId: string;
  readonly subscriptionId: string | null;
  readonly stripeInvoiceId: string;
  readonly amountPaise: number;
  readonly charityId: string;
  readonly charityBps: number;
  readonly split: PaymentSplit;
  readonly paidAt: string;
}

export interface PaymentRepository {
  /** False when this invoice was already recorded (unique `stripe_invoice_id`) — a replayed webhook. */
  recordIfNew(write: PaymentWrite): Promise<boolean>;
}
