import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database.types";

export interface SessionCheck {
  /** Carry this response forward: it holds any refreshed auth cookies. */
  readonly response: NextResponse;
  readonly isSignedIn: boolean;
}

/**
 * Runs in proxy.ts on every matched request. Verifies the access token (locally, no network),
 * refreshes it if it is about to expire, and writes the refreshed cookies onto the response
 * so the rendered page and the browser both see a valid session. No database access here.
 */
export async function updateSession(request: NextRequest): Promise<SessionCheck> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  return { response, isSignedIn: Boolean(data?.claims) };
}
