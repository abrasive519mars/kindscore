/**
 * Webhook idempotency at the storage layer: the event id is the primary key, so two deliveries of
 * the same event can never both be processed, whatever the timing.
 */
export interface StripeEventRepository {
  /** Insert-first. False means the id already exists — the caller answers 200 and does nothing. */
  claim(eventId: string, type: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}
