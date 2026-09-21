import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { StripeBillingGateway } from "@/lib/stripe/StripeBillingGateway";
import { SupabaseCharityRepository } from "@/repositories/supabase/SupabaseCharityRepository";
import { SupabaseDonationRepository } from "@/repositories/supabase/SupabaseDonationRepository";
import { DonationService } from "@/services/DonationService";

/**
 * Starting a donation runs on the member's own client (RLS: insert own, unpaid). Marking it paid
 * moves money into the ledger, which only the service role may do — so the success-page sync
 * gets a service-role-backed DonationService, exactly like the webhook. Both call one idempotent
 * markPaid; whichever arrives first wins.
 */
export async function createDonationService(): Promise<DonationService> {
  const db = await createSupabaseServerClient();
  return new DonationService(
    new SupabaseDonationRepository(db),
    new SupabaseCharityRepository(db),
    new StripeBillingGateway(getStripe()),
  );
}

export function createDonationSyncService(): DonationService {
  const db = createSupabaseAdminClient();
  return new DonationService(
    new SupabaseDonationRepository(db),
    new SupabaseCharityRepository(db),
    new StripeBillingGateway(getStripe()),
  );
}
