import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The one client type every Supabase repository accepts. Both the per-request user client
 * (RLS applies) and the service-role client (RLS bypassed) satisfy it, so the same repository
 * class serves pages and the webhook — which rows it may touch is decided by the caller's client.
 */
export type Db = SupabaseClient<Database>;

/** Postgres SQLSTATE codes the repositories translate into app errors. */
export const PG_UNIQUE_VIOLATION = "23505";
