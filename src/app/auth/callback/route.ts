import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where Supabase sends the browser after an email link or OAuth round-trip. Exchanges the
 * one-time `code` for a session cookie, then continues to `next`. Not used by password login,
 * but required for password-reset links later and registered in the Auth redirect allow-list.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
