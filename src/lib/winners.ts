import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseProofStorage } from "@/lib/storage/SupabaseProofStorage";
import { SupabaseWinnerRepository } from "@/repositories/supabase/SupabaseWinnerRepository";
import { WinnerService } from "@/services/WinnerService";

/**
 * Composition root for winner verification, on the caller's own client: a member's uploads and
 * reads are bound to their folder and rows by policy, an admin's by is_admin(). No service role.
 */
export async function createWinnerService(): Promise<WinnerService> {
  const db = await createSupabaseServerClient();
  return new WinnerService(new SupabaseWinnerRepository(db), new SupabaseProofStorage(db));
}
