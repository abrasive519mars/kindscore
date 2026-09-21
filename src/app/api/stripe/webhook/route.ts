import { serverEnv } from "@/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { processWebhook, type WebhookDeps } from "@/lib/stripe/webhook";
import { SupabaseDonationRepository } from "@/repositories/supabase/SupabaseDonationRepository";
import { SupabasePaymentRepository } from "@/repositories/supabase/SupabasePaymentRepository";
import { SupabaseProfileRepository } from "@/repositories/supabase/SupabaseProfileRepository";
import { SupabaseStripeEventRepository } from "@/repositories/supabase/SupabaseStripeEventRepository";
import { SupabaseSubscriptionRepository } from "@/repositories/supabase/SupabaseSubscriptionRepository";
import { SubscriptionSyncService } from "@/services/SubscriptionSyncService";

// Signature verification needs the exact raw bytes and the Node crypto module.
export const runtime = "nodejs";

/** Composition root: the only place the real Stripe SDK meets the service-role database. */
function buildDeps(): WebhookDeps {
  const stripe = getStripe();
  const db = createSupabaseAdminClient();
  return {
    verify: (body, signature) =>
      stripe.webhooks.constructEvent(body, signature, serverEnv().STRIPE_WEBHOOK_SECRET),
    events: new SupabaseStripeEventRepository(db),
    fetcher: { retrieveSubscription: (id) => stripe.subscriptions.retrieve(id) },
    donations: new SupabaseDonationRepository(db),
    sync: new SubscriptionSyncService({
      subscriptions: new SupabaseSubscriptionRepository(db),
      payments: new SupabasePaymentRepository(db),
      profiles: new SupabaseProfileRepository(db),
    }),
  };
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  try {
    return await processWebhook(rawBody, signature, buildDeps());
  } catch (error) {
    // A 500 makes Stripe retry with backoff; the claimed event row stays unprocessed as evidence.
    console.error("[stripe webhook]", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
