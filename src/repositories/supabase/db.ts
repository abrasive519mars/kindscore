import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The one client type every Supabase repository accepts. Both the per-request user client
 * (RLS applies) and the service-role client (RLS bypassed) satisfy it, so the same repository
 * class serves pages and the webhook — which rows it may touch is decided by the caller's client.
 */
export type Db = SupabaseClient<Database>;

/** Postgres SQLSTATE codes the repositories translate into app errors. */
export const PG_UNIQUE_VIOLATION = "23505";

/** PostgREST silently truncates any select to `max_rows` (1000 in supabase/config.toml). */
const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/**
 * Reads a whole result set by walking `.range()` pages until a short page comes back.
 * Every list that feeds arithmetic (entrants, payments, members) must go through this: a capped
 * list would not fail, it would quietly compute the wrong pool.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
