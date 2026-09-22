import { cache } from "react";
import { deriveAccess, type Access } from "@/lib/auth/derive";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { Access, SignedInAccess, SubscriptionState } from "@/lib/auth/derive";
export { deriveAccess } from "@/lib/auth/derive";

/**
 * Who is asking, and what may they do — resolved once per request (React cache) no matter how
 * many layouts, pages and actions call it. One auth check + two indexed selects.
 */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { kind: "anonymous" };

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
    // The latest row whatever its status: a lapsed or ended subscription is a state the member
    // must see (PRD §04), not an absence. The engine decides access from it.
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return deriveAccess(auth.user.id, profile, subscription, new Date());
});
