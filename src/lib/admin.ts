import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseAdminUserRepository } from "@/repositories/supabase/SupabaseAdminUserRepository";
import { SupabaseCharityRepository } from "@/repositories/supabase/SupabaseCharityRepository";
import { SupabaseDrawRepository } from "@/repositories/supabase/SupabaseDrawRepository";
import { SupabaseReportsRepository } from "@/repositories/supabase/SupabaseReportsRepository";
import { SupabaseScoreRepository } from "@/repositories/supabase/SupabaseScoreRepository";
import { AdminUserService } from "@/services/AdminUserService";
import { ReportsService } from "@/services/ReportsService";
import { ScoreService } from "@/services/ScoreService";

/**
 * Composition roots for the admin area, on the admin's own client. RLS grants admins the rows,
 * the column grant keeps role/email out of reach, and the one write RLS forbids everyone
 * (subscriptions) is an admin-checked RPC. No service role.
 */
export async function createAdminUserService(): Promise<AdminUserService> {
  const db = await createSupabaseServerClient();
  return new AdminUserService(
    new SupabaseAdminUserRepository(db),
    new SupabaseCharityRepository(db),
    new ScoreService(new SupabaseScoreRepository(db)),
  );
}

export async function createReportsService(): Promise<ReportsService> {
  const db = await createSupabaseServerClient();
  return new ReportsService(
    new SupabaseReportsRepository(db),
    new SupabaseDrawRepository(db),
    new SupabaseAdminUserRepository(db),
  );
}
