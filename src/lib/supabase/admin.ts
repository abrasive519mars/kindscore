import "server-only";

import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Service-role client: bypasses row-level security entirely.
 *
 * Allowed callers: the Stripe webhook (writes subscriptions/payments nobody else may write) and
 * scripts/seed.ts. Nothing under src/app or src/components may import this — ESLint enforces it —
 * and `server-only` makes any client-bundle import a build error.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
