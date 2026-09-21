import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseDrawRepository } from "@/repositories/supabase/SupabaseDrawRepository";
import { DrawService } from "@/services/DrawService";

/**
 * Composition root for draws, on the *user* client: RLS decides what each caller may read
 * (drafts for admins only, own entries for members, published statistics for everyone), and the
 * RPCs decide who may write. No service role anywhere in this feature.
 */
export async function createDrawService(): Promise<DrawService> {
  return new DrawService(new SupabaseDrawRepository(await createSupabaseServerClient()));
}

export async function createDrawRepository(): Promise<SupabaseDrawRepository> {
  return new SupabaseDrawRepository(await createSupabaseServerClient());
}
