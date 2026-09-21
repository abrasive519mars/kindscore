import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 proxy (formerly middleware). Two jobs, nothing else:
 *  1. keep the Supabase session fresh on every request (updateSession)
 *  2. coarse routing by *presence* of a session — signed-out users can't reach the app,
 *     signed-in users don't see the auth pages.
 * Role and subscription checks need the database and belong in layouts/guards, not here.
 */
const PROTECTED_PREFIXES = ["/app", "/admin"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { response, isSignedIn } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!isSignedIn && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isSignedIn && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  // Everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|seed/).*)"],
};
