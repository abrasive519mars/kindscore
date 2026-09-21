import "server-only";

import { serverEnv } from "@/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { StripeBillingGateway } from "@/lib/stripe/StripeBillingGateway";
import { SupabasePaymentRepository } from "@/repositories/supabase/SupabasePaymentRepository";
import { SupabaseProfileRepository } from "@/repositories/supabase/SupabaseProfileRepository";
import { SupabaseSubscriptionRepository } from "@/repositories/supabase/SupabaseSubscriptionRepository";
import { CheckoutService } from "@/services/CheckoutService";
import { SubscriptionSyncService } from "@/services/SubscriptionSyncService";

/**
 * Composition root for member-initiated billing. Lives in lib, not in the actions file, because
 * it needs the service-role client (only the webhook and this may write the subscription mirror)
 * and app code is lint-barred from importing that client directly. Actions get a CheckoutService
 * whose every method is scoped to the authenticated user — never the raw client.
 */
export function createCheckoutService(): CheckoutService {
  const db = createSupabaseAdminClient();
  const env = serverEnv();
  const profiles = new SupabaseProfileRepository(db);
  const subscriptions = new SupabaseSubscriptionRepository(db);
  return new CheckoutService({
    gateway: new StripeBillingGateway(getStripe()),
    profiles,
    subscriptions,
    sync: new SubscriptionSyncService({
      subscriptions,
      profiles,
      payments: new SupabasePaymentRepository(db),
    }),
    priceIds: { month: env.STRIPE_PRICE_MONTHLY, year: env.STRIPE_PRICE_YEARLY },
  });
}
