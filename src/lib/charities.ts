import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseCharityMediaStorage } from "@/lib/storage/SupabaseCharityMediaStorage";
import { SupabaseCharityRepository } from "@/repositories/supabase/SupabaseCharityRepository";
import { SupabaseDonationRepository } from "@/repositories/supabase/SupabaseDonationRepository";
import { SupabaseProfileRepository } from "@/repositories/supabase/SupabaseProfileRepository";
import { CharityService } from "@/services/CharityService";
import { MemberCharityService } from "@/services/MemberCharityService";

/**
 * Composition roots for the charity feature, on the caller's own client: visitors read what RLS
 * lets them, members update their own profile, admins write through the same service and RLS
 * refuses everyone else. No service role anywhere here.
 */
export async function createCharityService(): Promise<CharityService> {
  const db = await createSupabaseServerClient();
  return new CharityService(new SupabaseCharityRepository(db), new SupabaseCharityMediaStorage(db));
}

export async function createMemberCharityService(): Promise<MemberCharityService> {
  const db = await createSupabaseServerClient();
  return new MemberCharityService(
    new SupabaseProfileRepository(db),
    new SupabaseCharityRepository(db),
    new SupabaseDonationRepository(db),
  );
}
