import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { StripePayoutGateway } from "@/lib/stripe/StripePayoutGateway";
import { SupabaseProfileRepository } from "@/repositories/supabase/SupabaseProfileRepository";
import { SupabaseWinnerRepository } from "@/repositories/supabase/SupabaseWinnerRepository";
import { ClaimPayoutService } from "@/services/ClaimPayoutService";

/**
 * Composition root for a winner claiming their payout. Two clients on purpose: the winner rows go
 * through the caller's own client so the claim RPC sees auth.uid(); the profile's Stripe customer
 * id needs the service role (members may not write that column). Stripe is the payout rail.
 */
export async function createClaimPayoutService(): Promise<ClaimPayoutService> {
  const userDb = await createSupabaseServerClient();
  const adminDb = createSupabaseAdminClient();
  return new ClaimPayoutService({
    winners: new SupabaseWinnerRepository(userDb),
    profiles: new SupabaseProfileRepository(adminDb),
    gateway: new StripePayoutGateway(getStripe()),
  });
}
