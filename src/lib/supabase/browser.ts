"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Supabase client for client components. Reads/writes the auth cookies through document.cookie,
 * so it shares the session the server established. Create once per module, not per render.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
