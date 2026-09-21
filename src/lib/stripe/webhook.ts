import type Stripe from "stripe";
import { ValidationError } from "@/engine/errors";
import { toResponse } from "@/lib/errors/http";
import {
  handleStripeEvent,
  type DonationMarker,
  type SubscriptionFetcher,
} from "@/lib/stripe/handleEvent";
import type { StripeEventRepository } from "@/repositories/interfaces/StripeEventRepository";
import type { SubscriptionSyncService } from "@/services/SubscriptionSyncService";

export interface WebhookDeps {
  /** Throws when the signature does not match — nothing below runs. */
  readonly verify: (rawBody: string, signature: string) => Stripe.Event;
  readonly events: StripeEventRepository;
  readonly fetcher: SubscriptionFetcher;
  readonly sync: SubscriptionSyncService;
  readonly donations: DonationMarker;
}

function verifyOrThrow(deps: WebhookDeps, rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new ValidationError("Missing Stripe signature");
  try {
    return deps.verify(rawBody, signature);
  } catch {
    throw new ValidationError("Invalid Stripe signature");
  }
}

/**
 * The webhook, minus HTTP plumbing and minus construction — so an integration test can run it
 * against a real database with a stubbed Stripe. Order matters: verify → claim the event id
 * (duplicates stop here with a 200) → apply → mark processed. Any failure after the claim is a
 * 500, which makes Stripe retry; the claim row is left unprocessed as the audit trail.
 */
export async function processWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<Response> {
  let event: Stripe.Event;
  try {
    event = verifyOrThrow(deps, rawBody, signature);
  } catch (error) {
    return toResponse(error);
  }

  const fresh = await deps.events.claim(event.id, event.type);
  if (!fresh) return Response.json({ received: true, duplicate: true });

  const result = await handleStripeEvent(event, deps.fetcher, deps.sync, deps.donations);
  await deps.events.markProcessed(event.id);
  return Response.json({ received: true, ...result });
}
