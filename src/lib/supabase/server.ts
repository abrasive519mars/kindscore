import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Supabase client for server components, server actions and route handlers.
 * Runs as the signed-in user (anon key + their session cookie), so RLS applies exactly as it
 * would in the browser. Next 16's cookies() is async; this must be awaited per request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          // Server components cannot set cookies; the proxy already refreshed the session.
          // Actions and route handlers can, so we try and ignore the read-only case.
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            /* read-only context */
          }
        },
      },
    },
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
